from __future__ import annotations

from typing import Optional
import os

from celery.result import AsyncResult
from fastapi import Header, HTTPException
from pydantic import BaseModel
import redis

from libs.py_core.config import get_settings


settings = get_settings()

# Simple Redis client for storing per-task auth metadata and history.
redis_client: redis.Redis = redis.Redis.from_url(str(settings.redis_url))

TASK_OWNER_KEY_PREFIX = "zimage:task_owner:"
TASK_OWNER_TTL_SECONDS = 7 * 24 * 60 * 60  # 7 days
USER_TASKS_KEY_PREFIX = "zimage:user_tasks:"
ALL_TASKS_KEY = "zimage:all_tasks"
USER_TASKS_MAX_ITEMS = 100


class AuthContext(BaseModel):
    """
    Simple API key auth context.

    - `key`: raw key provided by the client (if any)
    - `is_admin`: whether this key matches the configured admin key
    """

    key: Optional[str] = None
    is_admin: bool = False


def _resolve_auth_context(raw_key: Optional[str]) -> AuthContext:
    """
    Internal helper to resolve AuthContext and apply whitelist checks.
    """

    admin_key = settings.api_admin_key
    is_admin = bool(admin_key) and raw_key == admin_key

    # If a whitelist is configured, enforce it for non-admin keys.
    allowed_raw = os.getenv("API_ALLOWED_KEYS", "").strip()
    if settings.api_enable_auth and raw_key and not is_admin and allowed_raw:
        allowed = {k.strip() for k in allowed_raw.split(",") if k.strip()}
        if allowed and raw_key not in allowed:
            raise HTTPException(status_code=403, detail="API key not allowed")

    return AuthContext(key=raw_key, is_admin=is_admin)


def get_auth_context(
    x_auth_key: Optional[str] = Header(default=None, alias="X-Auth-Key"),
    auth_key: Optional[str] = None,
) -> AuthContext:
    """
    Strict auth context resolver.

    When `settings.api_enable_auth` is true, a non-empty key is required
    for protected endpoints. The admin key (if configured) is treated as
    a special key that can access all tasks.

    Additionally, if `API_ALLOWED_KEYS` is configured as a comma-separated
    whitelist, non-admin keys must appear in that list to be considered
    valid.
    """

    raw_key = x_auth_key or auth_key

    if settings.api_enable_auth:
        if not raw_key:
            raise HTTPException(status_code=401, detail="Missing API auth key")

    return _resolve_auth_context(raw_key)


def get_auth_context_optional(
    x_auth_key: Optional[str] = Header(default=None, alias="X-Auth-Key"),
    auth_key: Optional[str] = None,
) -> AuthContext:
    """
    Lenient auth context resolver.

    - 当 API 鉴权关闭时（API_ENABLE_AUTH=false），可以不带 key；
    - 当 API 鉴权开启时（API_ENABLE_AUTH=true），未提供 key 会返回 401，
      行为与 get_auth_context 保持一致。

    适用于“预览 / 历史”等接口：
    - 普通 key：只看自己的数据；
    - 管理员 key：看所有数据；
    - 鉴权关闭且不带 key：视为匿名访客，由业务逻辑决定行为（当前实现为全局历史）。
    """

    raw_key = x_auth_key or auth_key

    if settings.api_enable_auth and not raw_key:
        raise HTTPException(status_code=401, detail="Missing API auth key")

    return _resolve_auth_context(raw_key)


def enforce_task_access(task_id: str, auth: AuthContext, result: AsyncResult) -> None:
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


def register_task(task_id: str, auth_key: str) -> None:
    """
    Record task ownership and simple per-key / global history in Redis.
    """

    redis_client.setex(
        name=f"{TASK_OWNER_KEY_PREFIX}{task_id}",
        time=TASK_OWNER_TTL_SECONDS,
        value=auth_key,
    )

    user_list_key = f"{USER_TASKS_KEY_PREFIX}{auth_key}"
    redis_client.lpush(user_list_key, task_id)
    redis_client.ltrim(user_list_key, 0, USER_TASKS_MAX_ITEMS - 1)

    redis_client.lpush(ALL_TASKS_KEY, task_id)
    redis_client.ltrim(ALL_TASKS_KEY, 0, USER_TASKS_MAX_ITEMS - 1)


def build_image_url(relative_path: str) -> str:
    """
    Build a public URL for a generated image, based on the static mount path.
    """

    relative_path = relative_path.lstrip("/")
    return f"/generated-images/{relative_path}"
