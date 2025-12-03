from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field


class GenerateImageRequest(BaseModel):
    prompt: str = Field(..., min_length=1)
    height: int = Field(default=1024, ge=64, le=2048)
    width: int = Field(default=1024, ge=64, le=2048)
    num_inference_steps: int = Field(default=9, ge=1, le=50)
    guidance_scale: float = Field(default=0.0, ge=0.0, le=20.0)
    seed: Optional[int] = None
    negative_prompt: Optional[str] = Field(default="")
    cfg_normalization: Optional[bool] = None
    cfg_truncation: Optional[float] = None
    max_sequence_length: Optional[int] = Field(default=None, ge=1)
    # 使用宽松的 dict[str, Any]，避免 Pydantic 对递归类型别名的前向引用解析问题。
    metadata: Optional[dict[str, Any]] = None


class GenerateImageResponse(BaseModel):
    task_id: str
    # 方便前端直接轮询任务状态；示例：/v1/tasks/{task_id}
    status_url: str
    # 任务完成后可填充图片访问地址；初始创建时通常为 null。
    image_url: Optional[str] = None


class TaskStatusResponse(BaseModel):
    task_id: str
    status: str
    # 使用宽松的 dict[str, Any]，避免 Pydantic 解析 libs.py_core.types 中递归 JSON 类型别名。
    result: Optional[dict[str, Any]] = None
    error: Optional[str] = None
    error_code: Optional[str] = None
    error_hint: Optional[str] = None
    image_url: Optional[str] = None
    progress: Optional[int] = None


class TaskSummary(BaseModel):
    task_id: str
    status: str
    created_at: Optional[str] = None
    prompt: Optional[str] = None
    height: Optional[int] = None
    width: Optional[int] = None
    relative_path: Optional[str] = None
    image_url: Optional[str] = None
    num_inference_steps: Optional[int] = None
    guidance_scale: Optional[float] = None
    seed: Optional[int] = None
    negative_prompt: Optional[str] = None
    batch_size: Optional[int] = None
    success_count: Optional[int] = None
    failed_count: Optional[int] = None
    base_seed: Optional[int] = None


class BatchImageItem(BaseModel):
    task_id: str
    index: int
    status: str
    image_url: Optional[str] = None
    width: Optional[int] = None
    height: Optional[int] = None
    seed: Optional[int] = None
    error_code: Optional[str] = None
    error_hint: Optional[str] = None
    progress: Optional[int] = None  # 任务进度（0-100），仅在 status 为 running 时有意义


class BatchDetail(BaseModel):
    batch: TaskSummary
    items: list[BatchImageItem]


class CancelTaskResponse(BaseModel):
    task_id: str
    status: str
    message: Optional[str] = None


class DeleteTaskResponse(BaseModel):
    task_id: str
    status: str
    message: Optional[str] = None
