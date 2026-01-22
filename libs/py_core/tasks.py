from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from .celery_app import celery_app
from .db import (
    record_generation_failed,
    record_generation_started,
    record_generation_succeeded,
)
from .storage import encode_image_bytes, get_storage
from .z_image_pipeline import ZImageNotAvailable, generate_image
from .types import GenerationResult, JSONDict


def _serialize_generation_error(code: str, hint: str, detail: str | None = None) -> str:
    """
    Convert a structured generation error into a JSON string so it can be
    propagated through Celery's JSON result backend.
    """

    payload: dict[str, str] = {"code": code, "message": hint}
    if detail:
        payload["detail"] = detail
    return json.dumps(payload, ensure_ascii=False)


def _classify_generation_exception(exc: Exception) -> tuple[str, str]:
    """
    Map low-level exceptions to user-facing error codes + hints.
    """

    message = str(exc).strip()
    lowered = message.lower()

    # Torch/CUDA OOM variants emit different exception classes/messages.
    if "out of memory" in lowered or "cuda error" in lowered:
        return "gpu_oom", "GPU 显存不足，请降低分辨率或 steps 后重试。"

    if isinstance(exc, ZImageNotAvailable):
        return "dependency_missing", "推理环境缺少必要依赖，请检查 worker 日志。"

    if isinstance(exc, ModuleNotFoundError):
        return "dependency_missing", "Python 依赖缺失，请在 worker 环境安装相应库。"

    if isinstance(exc, FileNotFoundError):
        return "model_missing", "未找到模型权重，请确认 MODELS_DIR 是否已准备完成。"

    return "internal_error", "生成过程中出现未知异常，请稍后重试。"


@celery_app.task(name="z_image.generate_image", bind=True)
def generate_image_task(
    self,
    prompt: str,
    *,
    height: int = 1024,
    width: int = 1024,
    num_inference_steps: int = 9,
    guidance_scale: float = 0.0,
    seed: int | None = None,
    negative_prompt: str | None = None,
    cfg_normalization: bool | None = None,
    cfg_truncation: float | None = None,
    max_sequence_length: int | None = None,
    auth_key: str | None = None,
    metadata: JSONDict | None = None,
) -> GenerationResult:
    """
    Celery task that runs a Z-Image generation job and saves
    the result to disk with a unique identifier.
    """

    image_id = uuid.uuid4().hex
    task_id = self.request.id or image_id
    now = datetime.now(timezone.utc)

    normalized_negative_prompt = negative_prompt if negative_prompt is not None else ""

    def progress_callback(step: int, timestep: int, latents: object) -> None:
        # Calculate progress percentage (0-100)
        # step is 0-indexed, so we add 1.
        progress = int(((step + 1) / num_inference_steps) * 100)
        self.update_state(state="PROGRESS", meta={"progress": progress})

    # Record the fact that the worker picked up this task in the DB.
    record_generation_started(
        task_id,
        prompt=prompt,
        height=height,
        width=width,
        num_inference_steps=num_inference_steps,
        guidance_scale=guidance_scale,
        seed=seed,
        negative_prompt=normalized_negative_prompt,
        cfg_normalization=cfg_normalization,
        cfg_truncation=cfg_truncation,
        max_sequence_length=max_sequence_length,
        auth_key=auth_key,
        metadata=metadata,
    )

    try:
        image = generate_image(
            prompt=prompt,
            height=height,
            width=width,
            num_inference_steps=num_inference_steps,
            guidance_scale=guidance_scale,
            seed=seed,
            negative_prompt=normalized_negative_prompt,
            cfg_normalization=cfg_normalization,
            cfg_truncation=cfg_truncation,
            max_sequence_length=max_sequence_length,
            callback=progress_callback,
            callback_steps=1,
        )
    except Exception as exc:  # pragma: no cover - runtime only
        code, hint = _classify_generation_exception(exc)
        detail = str(exc)
        # Best-effort recording of failure to the DB. Any DB errors are
        # swallowed inside record_generation_failed so they don't impact
        # user-facing behaviour.
        record_generation_failed(
            task_id,
            error_code=code,
            error_hint=hint,
            error_message=detail,
        )
        raise RuntimeError(_serialize_generation_error(code, hint, detail)) from exc

    timestamp = now.strftime("%H%M%S")
    date_prefix = now.strftime("%Y%m%d")
    png_filename = f"{timestamp}_{image_id}.png"
    png_relative_path = f"{date_prefix}/{png_filename}"

    # In addition to the PNG used for downloads, also save a WebP version
    # for UI previews to reduce bandwidth usage.
    webp_filename = f"{timestamp}_{image_id}.webp"
    webp_relative_path = f"{date_prefix}/{webp_filename}"

    storage = get_storage()

    png_bytes, _ = encode_image_bytes(image=image, format="PNG")
    png_output_path = storage.put_bytes(
        relative_path=png_relative_path,
        data=png_bytes,
        content_type="image/png",
    )

    try:
        webp_bytes, _ = encode_image_bytes(image=image, format="WEBP")
        webp_output_path = storage.put_bytes(
            relative_path=webp_relative_path,
            data=webp_bytes,
            content_type="image/webp",
        )
        preview_output_path = webp_output_path
        preview_relative_path = webp_relative_path
    except Exception:  # pragma: no cover - runtime only
        # If WebP save fails for any reason, fall back to the PNG path so
        # callers still have a valid preview URL.
        preview_output_path = png_output_path
        preview_relative_path = png_relative_path

    result: GenerationResult = {
        "image_id": image_id,
        "prompt": prompt,
        "height": height,
        "width": width,
        "num_inference_steps": num_inference_steps,
        "guidance_scale": guidance_scale,
        "seed": seed,
        "negative_prompt": normalized_negative_prompt,
        "cfg_normalization": cfg_normalization,
        "cfg_truncation": cfg_truncation,
        "max_sequence_length": max_sequence_length,
        "created_at": now.isoformat(),
        "auth_key": auth_key,
        "metadata": metadata if metadata is not None else {},
        # PNG paths (for downloads / archival).
        "output_path": str(png_output_path),
        "relative_path": str(png_relative_path),
        # WebP paths (for previews).
        "preview_output_path": str(preview_output_path),
        "preview_relative_path": str(preview_relative_path),
    }

    # Persist the successful generation to the DB (fire-and-forget).
    record_generation_succeeded(task_id, result)

    return result
