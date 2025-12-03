from __future__ import annotations

import json
from typing import Optional, cast

from celery.result import AsyncResult
from fastapi import APIRouter, Depends, HTTPException

from libs.py_core.celery_app import celery_app
from libs.py_core.db import get_api_client_id_for_key, get_db_cursor
from libs.py_core.tasks import generate_image_task
from libs.py_core.types import GenerationResult

from apps.api.schemas import (
    BatchDetail,
    BatchImageItem,
    CancelTaskResponse,
    DeleteTaskResponse,
    GenerateImageRequest,
    GenerateImageResponse,
    TaskStatusResponse,
    TaskSummary,
)
from apps.api.auth import (
    AuthContext,
    build_image_url,
    enforce_task_access,
    get_auth_context,
    get_auth_context_optional,
    settings,
)


router = APIRouter(tags=["images"])


def _decode_error_payload(raw: object) -> tuple[Optional[str], Optional[str], Optional[str]]:
    """
    Attempt to decode a structured error payload emitted by worker tasks.
    Returns (code, hint, detail).
    """

    if raw is None:
        return None, None, None

    if isinstance(raw, str):
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            return None, None, raw
    elif isinstance(raw, bytes):
        try:
            decoded = raw.decode("utf-8")
        except Exception:
            decoded = str(raw)
        try:
            data = json.loads(decoded)
        except json.JSONDecodeError:
            return None, None, decoded
    elif isinstance(raw, dict):
        data = raw
    else:
        return None, None, str(raw)

    if not isinstance(data, dict):
        return None, None, str(raw)

    code = data.get("code")
    hint = data.get("message")
    detail = data.get("detail") or hint
    return code, hint, detail


@router.post("/images/generate", response_model=GenerateImageResponse)
async def enqueue_image_generation(
    payload: GenerateImageRequest,
    auth: AuthContext = Depends(get_auth_context),
) -> GenerateImageResponse:
    """
    Enqueue an image generation task.

    Returns a task_id that can be polled via /v1/tasks/{task_id}, and
    includes a convenience status_url for front-end usage.
    """

    if settings.api_enable_auth:
        if not auth.key:
            raise HTTPException(status_code=401, detail="Missing API auth key")
        auth_key_for_task: Optional[str] = auth.key
    else:
        # In dev / local mode, auth is optional.
        auth_key_for_task = auth.key

    task = generate_image_task.delay(
        prompt=payload.prompt,
        height=payload.height,
        width=payload.width,
        num_inference_steps=payload.num_inference_steps,
        guidance_scale=payload.guidance_scale,
        seed=payload.seed,
        negative_prompt=payload.negative_prompt,
        cfg_normalization=payload.cfg_normalization,
        cfg_truncation=payload.cfg_truncation,
        max_sequence_length=payload.max_sequence_length,
        auth_key=auth_key_for_task,
        metadata=payload.metadata,
    )

    # Store a lightweight owner mapping for quick access control checks
    # while the task is pending, and update per-key / global history.
    # When auth is disabled and no key is provided, we still record the
    # task in the global history list so that anonymous usage can see
    # recent generations.
    from apps.api.auth import register_task  # local import to avoid cycles

    register_task(task.id, auth_key_for_task)

    status_url = f"/v1/tasks/{task.id}"

    return GenerateImageResponse(task_id=task.id, status_url=status_url, image_url=None)


@router.get("/tasks/{task_id}", response_model=TaskStatusResponse)
async def get_task_status(
    task_id: str,
    auth: AuthContext = Depends(get_auth_context),
) -> TaskStatusResponse:
    """
    Get the current status of a generation task.

    When completed successfully, includes the full result payload as well
    as a convenience image_url pointing at the static files mount.
    """

    result = AsyncResult(task_id, app=celery_app)

    if result is None:
        raise HTTPException(status_code=404, detail="Task not found")

    enforce_task_access(task_id, auth, result)

    status = result.status
    payload: GenerationResult | None = None
    error: Optional[str] = None
    image_url: Optional[str] = None
    error_code: Optional[str] = None
    error_hint: Optional[str] = None

    progress: Optional[int] = None

    if result.successful():
        raw_payload = result.result
        if isinstance(raw_payload, dict):
            payload = cast(GenerationResult, raw_payload)
            # Prefer the lightweight WebP preview path when available,
            # but fall back to the original PNG-relative path for older
            # payloads that do not include preview_relative_path.
            rel = payload.get("preview_relative_path") or payload.get("relative_path")
            if rel:
                image_url = build_image_url(str(rel))
    elif result.failed():
        raw_error = result.result
        error_code, error_hint, detail = _decode_error_payload(raw_error)
        error = detail or str(raw_error)
    elif status == "PROGRESS":
        info = result.info
        if isinstance(info, dict):
            progress = info.get("progress")

    return TaskStatusResponse(
        task_id=task_id,
        status=status,
        result=payload,
        error=error,
        error_code=error_code,
        error_hint=error_hint,
        image_url=image_url,
        progress=progress,
    )


@router.post("/tasks/{task_id}/cancel", response_model=CancelTaskResponse)
async def cancel_task(
    task_id: str,
    auth: AuthContext = Depends(get_auth_context),
) -> CancelTaskResponse:
    """
    Request cancellation of a running generation task.
    """

    result = AsyncResult(task_id, app=celery_app)
    if result is None:
        raise HTTPException(status_code=404, detail="Task not found")

    enforce_task_access(task_id, auth, result)

    terminal_states = {"SUCCESS", "FAILURE", "REVOKED"}
    status = result.status or "PENDING"
    if status in terminal_states:
        return CancelTaskResponse(
            task_id=task_id,
            status=status,
            message="Task already completed" if status != "REVOKED" else "Task already cancelled",
        )

    celery_app.control.revoke(task_id, terminate=True, signal="SIGTERM")
    return CancelTaskResponse(
        task_id=task_id,
        status="CANCELLED",
        message="Cancellation requested",
    )


@router.delete("/history/{batch_id}", response_model=DeleteTaskResponse)
async def soft_delete_history_item(
    batch_id: str,
    auth: AuthContext = Depends(get_auth_context_optional),
) -> DeleteTaskResponse:
    """
    Delete a history batch by batch_id.

    This only affects the history metadata stored in PostgreSQL; the
    underlying image files and Celery results are left untouched.
    """

    # Determine which api_client_id this caller is allowed to operate on.
    api_client_id: Optional[str] = None
    if settings.api_enable_auth and not auth.is_admin:
        if not auth.key:
            raise HTTPException(status_code=401, detail="Missing API auth key")
        api_client_id = get_api_client_id_for_key(auth.key)
        if api_client_id is None:
            raise HTTPException(status_code=403, detail="Not allowed to delete this history item")

    deleted = 0
    with get_db_cursor() as cur:
        params: list[object] = [batch_id]
        where_clauses = ["id = %s"]
        if api_client_id is not None:
            where_clauses.append("api_client_id = %s")
            params.append(api_client_id)

        cur.execute(
            f"DELETE FROM image_generation_batches WHERE {' AND '.join(where_clauses)};",
            params,
        )
        deleted = cur.rowcount

    if deleted == 0:
        raise HTTPException(status_code=404, detail="History batch not found")

    return DeleteTaskResponse(
        task_id=batch_id,
        status="deleted",
        message="Batch deleted from history",
    )


@router.get("/history", response_model=list[TaskSummary])
async def list_history(
    limit: int = 20,
    offset: int = 0,
    auth: AuthContext = Depends(get_auth_context_optional),
) -> list[TaskSummary]:
    """
    Return recent generation batches for the current caller.

    - 普通 key：只返回该 key 对应的批次；
    - 管理员 key：返回所有批次；
    - 鉴权关闭且无 key：返回所有批次，用于开发预览。

    注意：此接口现在按“批次”返回，一行代表一次点击生成；
    `task_id` 字段此时等于 `batch_id`。
    """

    limit = max(1, min(limit, 50))
    offset = max(0, offset)

    api_client_id: Optional[str] = None
    if settings.api_enable_auth:
        if auth.is_admin:
            api_client_id = None
        else:
            if not auth.key:
                raise HTTPException(status_code=401, detail="Missing API auth key")
            api_client_id = get_api_client_id_for_key(auth.key)
            if api_client_id is None:
                return []
    else:
        # 鉴权关闭时，如果有 key 就按 key 过滤，否则返回全局历史。
        if auth.key:
            api_client_id = get_api_client_id_for_key(auth.key)

    summaries: list[TaskSummary] = []
    with get_db_cursor() as cur:
        params: list[object] = []
        where_clauses: list[str] = []

        if api_client_id is not None:
            where_clauses.append("b.api_client_id = %s")
            params.append(api_client_id)

        where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

        params.extend([limit, offset])

        cur.execute(
            f"""
            SELECT
                b.id,
                b.status,
                b.created_at,
                b.prompt,
                b.width,
                b.height,
                b.num_inference_steps,
                b.guidance_scale,
                b.base_seed,
                b.batch_size,
                b.success_count,
                b.failed_count,
                t.relative_path,
                t.preview_relative_path,
                t.width,
                t.height,
                t.seed
            FROM image_generation_batches AS b
            LEFT JOIN LATERAL (
                SELECT
                    relative_path,
                    preview_relative_path,
                    width,
                    height,
                    seed
                FROM image_generation_tasks
                WHERE batch_id = b.id AND status = 'success'
                ORDER BY batch_index
                LIMIT 1
            ) AS t ON TRUE
            {where_sql}
            ORDER BY b.created_at DESC
            LIMIT %s OFFSET %s;
            """,
            params,
        )

        rows = cur.fetchall()

    for (
        batch_id,
        raw_status,
        created_at,
        prompt,
        width,
        height,
        num_inference_steps,
        guidance_scale,
        base_seed,
        batch_size,
        success_count,
        failed_count,
        relative_path,
        preview_relative_path,
        item_width,
        item_height,
        seed,
    ) in rows:
        created_at_str = created_at.isoformat() if created_at is not None else None
        rel = preview_relative_path or relative_path
        image_url: Optional[str] = None
        if rel:
            image_url = build_image_url(str(rel))

        # Map internal batch status to a coarse UI-oriented status so
        # existing front-end logic (e.g. SUCCESS filter) keeps working.
        if raw_status in ("success", "partial"):
            status = "SUCCESS"
        elif raw_status in ("error", "cancelled"):
            status = "FAILURE"
        elif raw_status in ("pending", "running"):
            status = "PENDING"
        else:
            status = raw_status

        summaries.append(
            TaskSummary(
                task_id=str(batch_id),
                status=status,
                created_at=created_at_str,
                prompt=prompt,
                height=item_height or height,
                width=item_width or width,
                relative_path=relative_path,
                image_url=image_url,
                num_inference_steps=num_inference_steps,
                guidance_scale=guidance_scale,
                seed=seed if seed is not None else base_seed,
                negative_prompt=None,
                batch_size=batch_size,
                success_count=success_count,
                failed_count=failed_count,
                base_seed=base_seed,
            )
        )

    return summaries


@router.get("/history/{batch_id}", response_model=BatchDetail)
async def get_history_batch_detail(
    batch_id: str,
    auth: AuthContext = Depends(get_auth_context_optional),
) -> BatchDetail:
    """
    Get detailed information for a given generation batch, including all
    per-image items. Non-admin callers只能访问自己的批次。
    """

    api_client_id: Optional[str] = None
    if settings.api_enable_auth:
        if auth.is_admin:
            api_client_id = None
        else:
            if not auth.key:
                raise HTTPException(status_code=401, detail="Missing API auth key")
            api_client_id = get_api_client_id_for_key(auth.key)
            if api_client_id is None:
                raise HTTPException(status_code=404, detail="Batch not found")
    else:
        if auth.key:
            api_client_id = get_api_client_id_for_key(auth.key)

    with get_db_cursor() as cur:
        # Fetch batch metadata + a representative preview image.
        params: list[object] = [batch_id]
        where_clauses = ["b.id = %s"]
        if api_client_id is not None:
            where_clauses.append("b.api_client_id = %s")
            params.append(api_client_id)

        where_sql = " AND ".join(where_clauses)

        cur.execute(
            f"""
            SELECT
                b.id,
                b.status,
                b.created_at,
                b.prompt,
                b.width,
                b.height,
                b.num_inference_steps,
                b.guidance_scale,
                b.base_seed,
                b.batch_size,
                b.success_count,
                b.failed_count,
                t.relative_path,
                t.preview_relative_path,
                t.width,
                t.height,
                t.seed
            FROM image_generation_batches AS b
            LEFT JOIN LATERAL (
                SELECT
                    relative_path,
                    preview_relative_path,
                    width,
                    height,
                    seed
                FROM image_generation_tasks
                WHERE batch_id = b.id AND status = 'success'
                ORDER BY batch_index
                LIMIT 1
            ) AS t ON TRUE
            WHERE {where_sql};
            """,
            params,
        )

        batch_row = cur.fetchone()
        if not batch_row:
            raise HTTPException(status_code=404, detail="Batch not found")

        (
            _batch_id,
            status,
            created_at,
            prompt,
            width,
            height,
            num_inference_steps,
            guidance_scale,
            base_seed,
            batch_size,
            success_count,
            failed_count,
            relative_path,
            preview_relative_path,
            item_width,
            item_height,
            seed,
        ) = batch_row

        created_at_str = created_at.isoformat() if created_at is not None else None
        rel = preview_relative_path or relative_path
        image_url: Optional[str] = None
        if rel:
            image_url = build_image_url(str(rel))

        batch_summary = TaskSummary(
            task_id=str(_batch_id),
            status="SUCCESS"
            if status in ("success", "partial")
            else "FAILURE"
            if status in ("error", "cancelled")
            else "PENDING"
            if status in ("pending", "running")
            else status,
            created_at=created_at_str,
            prompt=prompt,
            height=item_height or height,
            width=item_width or width,
            relative_path=relative_path,
            image_url=image_url,
            num_inference_steps=num_inference_steps,
            guidance_scale=guidance_scale,
            seed=seed if seed is not None else base_seed,
            negative_prompt=None,
            batch_size=batch_size,
            success_count=success_count,
            failed_count=failed_count,
            base_seed=base_seed,
        )

        # Fetch all items in this batch.
        cur.execute(
            """
            SELECT
                task_id,
                batch_index,
                status,
                relative_path,
                preview_relative_path,
                width,
                height,
                seed,
                error_code,
                error_hint
            FROM image_generation_tasks
            WHERE batch_id = %s
            ORDER BY batch_index;
            """,
            (batch_id,),
        )

        item_rows = cur.fetchall()

    items: list[BatchImageItem] = []
    for (
        task_id,
        index,
        status,
        relative_path,
        preview_relative_path,
        width,
        height,
        seed,
        error_code,
        error_hint,
    ) in item_rows:
        rel_item = preview_relative_path or relative_path
        image_url: Optional[str] = None
        if rel_item:
            image_url = build_image_url(str(rel_item))

        # 对于正在运行的任务，从 Celery 获取实时进度
        progress: Optional[int] = None
        if status == "running":
            try:
                celery_result = AsyncResult(task_id, app=celery_app)
                if celery_result.status == "PROGRESS" and isinstance(
                    celery_result.info, dict
                ):
                    progress = celery_result.info.get("progress")
            except Exception:
                # 如果 Celery 查询失败，忽略错误，继续返回 progress=None
                pass

        items.append(
            BatchImageItem(
                task_id=task_id,
                index=index,
                status=status,
                image_url=image_url,
                width=width,
                height=height,
                seed=seed,
                error_code=error_code,
                error_hint=error_hint,
                progress=progress,
            )
        )

    return BatchDetail(batch=batch_summary, items=items)
