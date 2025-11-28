import os
from pathlib import Path
from typing import Any, Dict, Optional

from celery.result import AsyncResult
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from libs.py_core.celery_app import celery_app
from libs.py_core.config import get_settings
from libs.py_core.tasks import generate_image_task


APP_ROOT = Path(__file__).resolve().parent

env_file = APP_ROOT / ".env"
if env_file.exists():
    load_dotenv(env_file, override=False)

settings = get_settings()

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
async def enqueue_image_generation(payload: GenerateImageRequest) -> GenerateImageResponse:
    task = generate_image_task.delay(
        prompt=payload.prompt,
        height=payload.height,
        width=payload.width,
        num_inference_steps=payload.num_inference_steps,
        guidance_scale=payload.guidance_scale,
        seed=payload.seed,
    )
    return GenerateImageResponse(task_id=task.id)


@app.get("/v1/tasks/{task_id}", response_model=TaskStatusResponse)
async def get_task_status(task_id: str) -> TaskStatusResponse:
    result = AsyncResult(task_id, app=celery_app)

    if result is None:
        raise HTTPException(status_code=404, detail="Task not found")

    status = result.status
    payload: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

    if result.successful():
        payload = result.result  # type: ignore[assignment]
    elif result.failed():
        error = str(result.result)

    return TaskStatusResponse(task_id=task_id, status=status, result=payload, error=error)


output_root = (settings.models_dir / os.getenv("Z_IMAGE_OUTPUT_SUBDIR", "z-image-outputs")).resolve()
output_root.mkdir(parents=True, exist_ok=True)
app.mount("/generated-images", StaticFiles(directory=str(output_root)), name="generated-images")
