from __future__ import annotations

import json
from typing import Optional, cast

from celery.result import AsyncResult
from fastapi import APIRouter, Depends, HTTPException

from libs.py_core.celery_app import celery_app
from libs.py_core.tasks import generate_image_task
from libs.py_core.types import GenerationResult

from apps.api.schemas import (
    CancelTaskResponse,
    DeleteTaskResponse,
    GenerateImageRequest,
    GenerateImageResponse,
    TaskStatusResponse,
    TaskSummary,
)
from apps.api.auth import (
    ALL_TASKS_KEY,
    USER_TASKS_KEY_PREFIX,
    AuthContext,
    DELETED_TASKS_KEY,
    build_image_url,
    enforce_task_access,
    get_auth_context,
    get_auth_context_optional,
    redis_client,
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

    return TaskStatusResponse(
        task_id=task_id,
        status=status,
        result=payload,
        error=error,
        error_code=error_code,
        error_hint=error_hint,
        image_url=image_url,
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


@router.delete("/history/{task_id}", response_model=DeleteTaskResponse)
async def soft_delete_history_item(
    task_id: str,
    auth: AuthContext = Depends(get_auth_context),
) -> DeleteTaskResponse:
    """
    Soft delete a history item by task_id.

    This does not remove any underlying files or Celery results; it only
    marks the task as deleted in Redis so that subsequent history queries
    stop returning it. When API auth is enabled, only the task owner or
    an admin key may delete a given task.
    """

    result = AsyncResult(task_id, app=celery_app)
    if result is None:
        raise HTTPException(status_code=404, detail="Task not found")

    enforce_task_access(task_id, auth, result)

    redis_client.sadd(DELETED_TASKS_KEY, task_id)

    return DeleteTaskResponse(
        task_id=task_id,
        status="deleted",
        message="Task hidden from history",
    )


@router.get("/history", response_model=list[TaskSummary])
async def list_history(
    limit: int = 20,
    offset: int = 0,
    auth: AuthContext = Depends(get_auth_context_optional),
) -> list[TaskSummary]:
    """
    Return a simple per-key history of recent tasks.

    - For regular keys: returns the caller's own tasks.
    - For admin key: returns recent tasks across all users.
    """

    limit = max(1, min(limit, 50))
    offset = max(0, offset)

    # Determine which Redis list to read from.
    # - 管理员 key：查看全局历史（ALL_TASKS_KEY）
    # - 未提供 key：也查看全局历史，用于开放式预览场景
    # - 普通 key：只查看自己的任务列表
    if auth.is_admin or not auth.key:
        redis_key = ALL_TASKS_KEY
    else:
        redis_key = f"{USER_TASKS_KEY_PREFIX}{auth.key}"

    # Fetch a window of task IDs for this user/admin.
    start = offset
    end = offset + limit - 1
    task_ids_bytes = redis_client.lrange(redis_key, start, end)
    if not task_ids_bytes:
        return []

    summaries: list[TaskSummary] = []
    for raw in task_ids_bytes:
        task_id = raw.decode("utf-8")

        # Skip tasks that have been soft-deleted from history.
        if redis_client.sismember(DELETED_TASKS_KEY, task_id):
            continue

        result = AsyncResult(task_id, app=celery_app)
        # Skip tasks that no longer exist in the backend.
        if result is None:
            continue

        status = result.status
        created_at: Optional[str] = None
        prompt: Optional[str] = None
        height: Optional[int] = None
        width: Optional[int] = None
        # We keep relative_path pointing at the original PNG path so that
        # callers can still download lossless images, while image_url is
        # used for the (potentially WebP) preview.
        relative_path: Optional[str] = None
        image_url: Optional[str] = None

        if result.successful():
            raw_payload = result.result
            if isinstance(raw_payload, dict):
                payload = cast(GenerationResult, raw_payload)
                created_at = payload["created_at"]
                prompt = payload["prompt"]
                height = payload["height"]
                width = payload["width"]
                # PNG relative path (for downloads).
                relative_path = str(payload.get("relative_path") or "")
                # Prefer WebP preview path when available.
                preview_rel = payload.get("preview_relative_path") or relative_path
                if preview_rel:
                    image_url = build_image_url(str(preview_rel))

        summaries.append(
            TaskSummary(
                task_id=task_id,
                status=status,
                created_at=created_at,
                prompt=prompt,
                height=height,
                width=width,
                relative_path=relative_path,
                image_url=image_url,
            )
        )

    return summaries
