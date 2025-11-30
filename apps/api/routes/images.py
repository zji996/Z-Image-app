from __future__ import annotations

from typing import Any, Dict, Optional

from celery.result import AsyncResult
from fastapi import APIRouter, Depends, HTTPException

from libs.py_core.celery_app import celery_app
from libs.py_core.tasks import generate_image_task

from apps.api.schemas import (
    GenerateImageRequest,
    GenerateImageResponse,
    TaskStatusResponse,
    TaskSummary,
)
from apps.api.auth import (
    ALL_TASKS_KEY,
    USER_TASKS_KEY_PREFIX,
    AuthContext,
    build_image_url,
    enforce_task_access,
    get_auth_context,
    get_auth_context_optional,
    redis_client,
    settings,
)


router = APIRouter(tags=["images"])


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
    if auth_key_for_task:
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
    payload: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    image_url: Optional[str] = None

    if result.successful():
        payload = result.result  # type: ignore[assignment]
        if isinstance(payload, dict):
            rel = payload.get("relative_path")
            if isinstance(rel, str) and rel:
                image_url = build_image_url(rel)
    elif result.failed():
        error = str(result.result)

    return TaskStatusResponse(
        task_id=task_id,
        status=status,
        result=payload,
        error=error,
        image_url=image_url,
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
        result = AsyncResult(task_id, app=celery_app)
        # Skip tasks that no longer exist in the backend.
        if result is None:
            continue

        status = result.status
        created_at: Optional[str] = None
        prompt: Optional[str] = None
        height: Optional[int] = None
        width: Optional[int] = None
        relative_path: Optional[str] = None
        image_url: Optional[str] = None

        if result.successful():
            payload = result.result
            if isinstance(payload, dict):
                created_at = payload.get("created_at")
                prompt = payload.get("prompt")
                height = payload.get("height")
                width = payload.get("width")
                relative_path = payload.get("relative_path")
                if isinstance(relative_path, str) and relative_path:
                    image_url = build_image_url(relative_path)

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
