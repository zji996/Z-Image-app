from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field
from libs.py_core.types import GenerationResult, JSONDict


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
    metadata: Optional[JSONDict] = None


class GenerateImageResponse(BaseModel):
    task_id: str
    # 方便前端直接轮询任务状态；示例：/v1/tasks/{task_id}
    status_url: str
    # 任务完成后可填充图片访问地址；初始创建时通常为 null。
    image_url: Optional[str] = None


class TaskStatusResponse(BaseModel):
    task_id: str
    status: str
    result: Optional[GenerationResult] = None
    error: Optional[str] = None
    error_code: Optional[str] = None
    error_hint: Optional[str] = None
    image_url: Optional[str] = None


class TaskSummary(BaseModel):
    task_id: str
    status: str
    created_at: Optional[str] = None
    prompt: Optional[str] = None
    height: Optional[int] = None
    width: Optional[int] = None
    relative_path: Optional[str] = None
    image_url: Optional[str] = None


class CancelTaskResponse(BaseModel):
    task_id: str
    status: str
    message: Optional[str] = None
