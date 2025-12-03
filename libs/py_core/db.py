from __future__ import annotations

"""
Lightweight PostgreSQL helpers for recording image generation metadata.

This module is intentionally minimal and synchronous. It is primarily used
from the Celery worker processes, where blocking I/O is acceptable.
"""

from contextlib import contextmanager
import hashlib
import json
from typing import Iterator, Optional
from uuid import UUID, uuid4

import psycopg
from psycopg import sql
from psycopg.errors import UndefinedTable

from .config import get_settings
from .types import GenerationResult, JSONDict


def _get_psycopg_dsn() -> str:
    """
    Normalize the configured DATABASE_URL so it can be used by psycopg.

    We allow SQLAlchemy-style schemes like postgresql+psycopg:// and
    transparently convert them to postgresql:// which psycopg expects.
    """

    settings = get_settings()
    url = settings.database_url
    if url.startswith("postgresql+psycopg://"):
        return "postgresql://" + url.split("postgresql+psycopg://", 1)[1]
    return url


@contextmanager
def _get_cursor() -> Iterator[psycopg.Cursor]:
    """
    Open a short-lived connection + cursor.

    The connection uses autocommit mode to keep the helpers simple and
    resilient for fire-and-forget logging purposes.
    """

    dsn = _get_psycopg_dsn()
    conn = psycopg.connect(dsn, autocommit=True)
    try:
        with conn.cursor() as cur:
            yield cur
    finally:
        conn.close()


@contextmanager
def get_db_cursor() -> Iterator[psycopg.Cursor]:
    """
    Public helper for read-heavy API endpoints that need direct access
    to the PostgreSQL connection. Uses the same configuration and
    autocommit behaviour as the internal helpers.
    """

    with _get_cursor() as cur:
        yield cur


def _safe_execute(fn) -> None:
    """
    Run a DB helper, swallowing missing-table errors so that the worker
    can still function even when migrations have not been applied yet.
    """

    try:
        fn()
    except UndefinedTable:
        # Migrations not applied yet; skip recording instead of failing.
        return
    except psycopg.OperationalError:
        # Database is unavailable; generation should continue.
        return


def _get_or_create_api_client_id(cur: psycopg.Cursor, raw_key: Optional[str]) -> Optional[str]:
    """
    Resolve a stable api_client_id for the given raw API key.

    We never store the raw key in the database, only a SHA-256 hash and a
    derived logical id such as "admin" or "key_<hash8>".
    """

    if not raw_key:
        return None

    settings = get_settings()
    admin_key = settings.api_admin_key

    key_hash = hashlib.sha256(raw_key.encode("utf-8")).hexdigest()

    cur.execute(
        "SELECT id FROM api_clients WHERE api_key_hash = %s",
        (key_hash,),
    )
    row = cur.fetchone()
    if row:
        return row[0]

    if admin_key and raw_key == admin_key:
        client_id = "admin"
        display_name = "Admin"
        role = "admin"
    else:
        suffix = key_hash[:8]
        client_id = f"key_{suffix}"
        display_name = f"API Key {suffix}"
        role = "first_party"

    cur.execute(
        """
        INSERT INTO api_clients (id, display_name, role, api_key_hash)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (id) DO NOTHING
        """,
        (client_id, display_name, role, key_hash),
    )

    return client_id


def get_api_client_id_for_key(raw_key: Optional[str]) -> Optional[str]:
    """
    Resolve (and create if needed) a stable api_client_id for the given
    raw API key. This can be used by the HTTP API layer when querying
    per-client history.
    """

    if not raw_key:
        return None

    with _get_cursor() as cur:
        return _get_or_create_api_client_id(cur, raw_key)


def _extract_batch_info(
    metadata: Optional[JSONDict],
) -> tuple[UUID, int, int]:
    """
    Extract batch_id / batch_index / batch_size from metadata.

    If the caller did not provide these fields, we fall back to a synthetic
    single-image batch.
    """

    batch_id: UUID
    batch_index = 0
    batch_size = 1

    if isinstance(metadata, dict):
        raw_batch_id = metadata.get("batch_id")
        if isinstance(raw_batch_id, str):
            try:
                batch_id = UUID(raw_batch_id)
            except ValueError:
                batch_id = uuid4()
        else:
            batch_id = uuid4()

        if isinstance(metadata.get("batch_index"), int):
            batch_index = int(metadata["batch_index"])
        if isinstance(metadata.get("batch_size"), int):
            size_val = int(metadata["batch_size"])
            if size_val > 0:
                batch_size = size_val
    else:
        batch_id = uuid4()

    return batch_id, batch_index, batch_size


def record_generation_started(
    task_id: str,
    *,
    prompt: str,
    height: int,
    width: int,
    num_inference_steps: int,
    guidance_scale: float,
    seed: Optional[int],
    negative_prompt: Optional[str],
    cfg_normalization: Optional[bool],
    cfg_truncation: Optional[float],
    max_sequence_length: Optional[int],
    auth_key: Optional[str],
    metadata: Optional[JSONDict],
) -> None:
    """
    Record that a generation task has started (worker picked it up).
    """

    def _impl() -> None:
        with _get_cursor() as cur:
            api_client_id = _get_or_create_api_client_id(cur, auth_key)
            batch_id, batch_index, batch_size = _extract_batch_info(metadata)

            # Derive a "base" seed for the batch when possible.
            base_seed: Optional[int] = None
            if seed is not None:
                try:
                    base_seed = int(seed) - int(batch_index)
                except Exception:
                    base_seed = int(seed)

            # Batch-level upsert.
            batch_metadata: Optional[JSONDict] = None
            if isinstance(metadata, dict):
                batch_metadata = dict(metadata)
                # These fields are tracked in dedicated columns.
                batch_metadata.pop("batch_index", None)
                batch_metadata.pop("batch_size", None)

            cur.execute(
                """
                INSERT INTO image_generation_batches (
                    id,
                    api_client_id,
                    caller_label,
                    prompt,
                    negative_prompt,
                    width,
                    height,
                    num_inference_steps,
                    guidance_scale,
                    base_seed,
                    batch_size,
                    status,
                    metadata
                ) VALUES (
                    %s, %s, NULL,
                    %s, %s,
                    %s, %s,
                    %s, %s,
                    %s,
                    %s,
                    'running',
                    %s
                )
                ON CONFLICT (id) DO UPDATE
                SET
                    api_client_id = COALESCE(image_generation_batches.api_client_id, EXCLUDED.api_client_id),
                    prompt = EXCLUDED.prompt,
                    negative_prompt = EXCLUDED.negative_prompt,
                    width = EXCLUDED.width,
                    height = EXCLUDED.height,
                    num_inference_steps = EXCLUDED.num_inference_steps,
                    guidance_scale = EXCLUDED.guidance_scale,
                    base_seed = COALESCE(image_generation_batches.base_seed, EXCLUDED.base_seed),
                    batch_size = EXCLUDED.batch_size,
                    status = CASE
                        WHEN image_generation_batches.status = 'pending' THEN 'running'
                        ELSE image_generation_batches.status
                    END,
                    metadata = COALESCE(image_generation_batches.metadata, EXCLUDED.metadata)
                ;
                """,
                (
                    str(batch_id),
                    api_client_id,
                    prompt,
                    negative_prompt,
                    width,
                    height,
                    num_inference_steps,
                    guidance_scale,
                    base_seed,
                    batch_size,
                    json.dumps(batch_metadata) if batch_metadata is not None else None,
                ),
            )

            # Per-image row.
            cur.execute(
                """
                INSERT INTO image_generation_tasks (
                    task_id,
                    batch_id,
                    batch_index,
                    seed,
                    status,
                    prompt,
                    negative_prompt,
                    width,
                    height,
                    num_inference_steps,
                    guidance_scale,
                    cfg_normalization,
                    cfg_truncation,
                    max_sequence_length,
                    metadata
                ) VALUES (
                    %s, %s, %s, %s,
                    'running',
                    %s, %s,
                    %s, %s,
                    %s,
                    %s,
                    %s,
                    %s,
                    %s,
                    %s
                )
                ON CONFLICT (task_id) DO UPDATE
                SET
                    status = EXCLUDED.status,
                    seed = EXCLUDED.seed,
                    prompt = EXCLUDED.prompt,
                    negative_prompt = EXCLUDED.negative_prompt,
                    width = EXCLUDED.width,
                    height = EXCLUDED.height,
                    num_inference_steps = EXCLUDED.num_inference_steps,
                    guidance_scale = EXCLUDED.guidance_scale,
                    cfg_normalization = EXCLUDED.cfg_normalization,
                    cfg_truncation = EXCLUDED.cfg_truncation,
                    max_sequence_length = EXCLUDED.max_sequence_length,
                    metadata = EXCLUDED.metadata
                ;
                """,
                (
                    task_id,
                    str(batch_id),
                    batch_index,
                    seed,
                    prompt,
                    negative_prompt,
                    width,
                    height,
                    num_inference_steps,
                    guidance_scale,
                    cfg_normalization,
                    cfg_truncation,
                    max_sequence_length,
                    json.dumps(metadata) if metadata is not None else None,
                ),
            )

    _safe_execute(_impl)


def _update_batch_counters(cur: psycopg.Cursor, batch_id: str) -> None:
    """
    Recompute success/failed counts for a batch and derive its status.
    """

    cur.execute(
        """
        WITH counts AS (
            SELECT
                COUNT(*) FILTER (WHERE status = 'success') AS success_count,
                COUNT(*) FILTER (WHERE status IN ('error', 'cancelled')) AS failed_count
            FROM image_generation_tasks
            WHERE batch_id = %s
        )
        UPDATE image_generation_batches AS b
        SET
            success_count = counts.success_count,
            failed_count = counts.failed_count,
            status = CASE
                WHEN counts.success_count + counts.failed_count >= b.batch_size THEN
                    CASE
                        WHEN counts.failed_count = 0 THEN 'success'
                        ELSE 'partial'
                    END
                ELSE 'running'
            END,
            completed_at = CASE
                WHEN counts.success_count + counts.failed_count >= b.batch_size THEN NOW()
                ELSE b.completed_at
            END
        FROM counts
        WHERE b.id = %s;
        """,
        (batch_id, batch_id),
    )


def record_generation_succeeded(task_id: str, result: GenerationResult) -> None:
    """
    Mark a task as successfully completed and update batch counters.
    """

    def _impl() -> None:
        with _get_cursor() as cur:
            cur.execute(
                """
                UPDATE image_generation_tasks
                SET
                    status = 'success',
                    error_code = NULL,
                    error_hint = NULL,
                    error_message = NULL,
                    width = %s,
                    height = %s,
                    num_inference_steps = %s,
                    guidance_scale = %s,
                    cfg_normalization = %s,
                    cfg_truncation = %s,
                    max_sequence_length = %s,
                    finished_at = NOW(),
                    image_id = %s,
                    output_path = %s,
                    preview_path = %s,
                    relative_path = %s,
                    preview_relative_path = %s,
                    metadata = %s
                WHERE task_id = %s
                RETURNING batch_id;
                """,
                (
                    result["width"],
                    result["height"],
                    result["num_inference_steps"],
                    result["guidance_scale"],
                    result["cfg_normalization"],
                    result["cfg_truncation"],
                    result["max_sequence_length"],
                    result["image_id"],
                    result["output_path"],
                    result["preview_output_path"],
                    result["relative_path"],
                    result["preview_relative_path"],
                    json.dumps(result.get("metadata") or {}),
                    task_id,
                ),
            )
            row = cur.fetchone()
            if row and row[0]:
                _update_batch_counters(cur, str(row[0]))

    _safe_execute(_impl)


def record_generation_failed(
    task_id: str,
    *,
    error_code: str,
    error_hint: str,
    error_message: Optional[str],
) -> None:
    """
    Mark a task as failed and update batch counters.
    """

    def _impl() -> None:
        with _get_cursor() as cur:
            cur.execute(
                """
                UPDATE image_generation_tasks
                SET
                    status = 'error',
                    error_code = %s,
                    error_hint = %s,
                    error_message = %s,
                    finished_at = NOW()
                WHERE task_id = %s
                RETURNING batch_id;
                """,
                (error_code, error_hint, error_message, task_id),
            )
            row = cur.fetchone()
            if row and row[0]:
                _update_batch_counters(cur, str(row[0]))

    _safe_execute(_impl)
