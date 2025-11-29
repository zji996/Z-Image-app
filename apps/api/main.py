from pathlib import Path
from typing import Any, Dict, Optional

from celery.result import AsyncResult
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
import redis

from libs.py_core.celery_app import celery_app
from libs.py_core.config import get_output_root, get_settings
from libs.py_core.tasks import generate_image_task


APP_ROOT = Path(__file__).resolve().parent

env_file = APP_ROOT / ".env"
if env_file.exists():
    load_dotenv(env_file, override=False)

settings = get_settings()

# Simple Redis client for storing per-task auth metadata.
redis_client: redis.Redis = redis.Redis.from_url(str(settings.redis_url))
TASK_OWNER_KEY_PREFIX = "zimage:task_owner:"
TASK_OWNER_TTL_SECONDS = 7 * 24 * 60 * 60  # 7 days
USER_TASKS_KEY_PREFIX = "zimage:user_tasks:"
ALL_TASKS_KEY = "zimage:all_tasks"
USER_TASKS_MAX_ITEMS = 100

app = FastAPI(title="Z-Image API")


class GenerateImageRequest(BaseModel):
    prompt: str = Field(..., min_length=1)
    height: int = Field(default=1024, ge=64, le=2048)
    width: int = Field(default=1024, ge=64, le=2048)
    num_inference_steps: int = Field(default=9, ge=1, le=50)
    guidance_scale: float = Field(default=0.0, ge=0.0, le=20.0)
    seed: Optional[int] = None


class GenerateImageResponse(BaseModel):
    task_id: str


class TaskStatusResponse(BaseModel):
    task_id: str
    status: str
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


class TaskSummary(BaseModel):
  task_id: str
  status: str
  created_at: Optional[str] = None
  prompt: Optional[str] = None
  height: Optional[int] = None
  width: Optional[int] = None
  relative_path: Optional[str] = None


class AuthContext(BaseModel):
    """
    Simple API key auth context.

    - `key`: raw key provided by the client (if any)
    - `is_admin`: whether this key matches the configured admin key
    """

    key: Optional[str] = None
    is_admin: bool = False


def get_auth_context(
    x_auth_key: Optional[str] = Header(default=None, alias="X-Auth-Key"),
    auth_key: Optional[str] = None,
) -> AuthContext:
    """
    Resolve the caller's auth context from headers / query params.

    When `settings.api_enable_auth` is true, a non-empty key is required
    for protected endpoints. The admin key (if configured) is treated as
    a special key that can access all tasks.
    """

    raw_key = x_auth_key or auth_key
    admin_key = settings.api_admin_key

    if settings.api_enable_auth:
        if not raw_key:
            raise HTTPException(status_code=401, detail="Missing API auth key")

    is_admin = bool(admin_key) and raw_key == admin_key
    return AuthContext(key=raw_key, is_admin=is_admin)


def _enforce_task_access(task_id: str, auth: AuthContext, result: AsyncResult) -> None:
    """
    Enforce that the current caller is allowed to access the task.

    - If auth is disabled, this is a no-op.
    - Admin key (if configured) can access all tasks.
    - Otherwise, we check the owner key stored in Redis (if any), or fall
      back to the `auth_key` field in the task result for completed tasks.
    """

    if not settings.api_enable_auth:
        return

    if auth.is_admin:
        return

    if not auth.key:
        raise HTTPException(status_code=401, detail="Missing API auth key")

    owner_key_bytes = redis_client.get(f"{TASK_OWNER_KEY_PREFIX}{task_id}")
    if owner_key_bytes is not None:
        owner_key = owner_key_bytes.decode("utf-8")
        if owner_key != auth.key:
            raise HTTPException(status_code=403, detail="Not allowed to access this task")
        return

    # Fallback: if the task has already completed and we no longer have a
    # Redis entry (e.g. TTL expired), try to validate against the stored
    # `auth_key` in the task result payload.
    if result.successful():
        payload = result.result
        if isinstance(payload, dict):
            owner_key = payload.get("auth_key")
            if owner_key and owner_key != auth.key:
                raise HTTPException(status_code=403, detail="Not allowed to access this task")


@app.get("/health")
async def health() -> dict[str, str]:
    return {
        "status": "ok",
        "environment": settings.environment,
    }


@app.get("/")
async def root() -> dict[str, str]:
    return {"message": "Z-Image API is running"}


@app.post("/v1/images/generate", response_model=GenerateImageResponse)
async def enqueue_image_generation(
    payload: GenerateImageRequest,
    auth: AuthContext = Depends(get_auth_context),
) -> GenerateImageResponse:
    auth_key_for_task: Optional[str]
    if settings.api_enable_auth:
        # When auth is enabled, we always record the caller's key on the task.
        if not auth.key:
            raise HTTPException(status_code=401, detail="Missing API auth key")
        auth_key_for_task = auth.key
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
        auth_key=auth_key_for_task,
    )

    # Store a lightweight owner mapping for quick access control checks
    # while the task is pending.
    if auth_key_for_task:
        redis_client.setex(
            name=f"{TASK_OWNER_KEY_PREFIX}{task.id}",
            time=TASK_OWNER_TTL_SECONDS,
            value=auth_key_for_task,
        )
        # Track recent tasks for this auth key.
        user_list_key = f"{USER_TASKS_KEY_PREFIX}{auth_key_for_task}"
        redis_client.lpush(user_list_key, task.id)
        redis_client.ltrim(user_list_key, 0, USER_TASKS_MAX_ITEMS - 1)
        # Track a global recent-tasks list for admin usage.
        redis_client.lpush(ALL_TASKS_KEY, task.id)
        redis_client.ltrim(ALL_TASKS_KEY, 0, USER_TASKS_MAX_ITEMS - 1)

    return GenerateImageResponse(task_id=task.id)


@app.get("/v1/tasks/{task_id}", response_model=TaskStatusResponse)
async def get_task_status(
    task_id: str,
    auth: AuthContext = Depends(get_auth_context),
) -> TaskStatusResponse:
    result = AsyncResult(task_id, app=celery_app)

    if result is None:
        raise HTTPException(status_code=404, detail="Task not found")

    _enforce_task_access(task_id, auth, result)

    status = result.status
    payload: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

    if result.successful():
        payload = result.result  # type: ignore[assignment]
    elif result.failed():
        error = str(result.result)

    return TaskStatusResponse(task_id=task_id, status=status, result=payload, error=error)


@app.get("/v1/history", response_model=list[TaskSummary])
async def list_history(
    limit: int = 20,
    offset: int = 0,
    auth: AuthContext = Depends(get_auth_context),
) -> list[TaskSummary]:
    """
    Return a simple per-key history of recent tasks.

    - For regular keys: returns the caller's own tasks.
    - For admin key: returns recent tasks across all users.
    """

    limit = max(1, min(limit, 50))
    offset = max(0, offset)

    # Determine which Redis list to read from.
    if auth.is_admin:
        redis_key = ALL_TASKS_KEY
    else:
        if not auth.key:
            # When auth is disabled globally, history without a key is empty.
            if not settings.api_enable_auth:
                return []
            raise HTTPException(status_code=401, detail="Missing API auth key")
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

        if result.successful():
            payload = result.result
            if isinstance(payload, dict):
                created_at = payload.get("created_at")
                prompt = payload.get("prompt")
                height = payload.get("height")
                width = payload.get("width")
                relative_path = payload.get("relative_path")

        summaries.append(
            TaskSummary(
                task_id=task_id,
                status=status,
                created_at=created_at,
                prompt=prompt,
                height=height,
                width=width,
                relative_path=relative_path,
            )
        )

    return summaries


output_root = get_output_root()
app.mount("/generated-images", StaticFiles(directory=str(output_root)), name="generated-images")
