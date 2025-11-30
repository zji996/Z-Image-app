from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from .celery_app import celery_app
from .config import get_output_root
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


@celery_app.task(name="z_image.generate_image")
def generate_image_task(
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
    now = datetime.now(timezone.utc)

    normalized_negative_prompt = negative_prompt if negative_prompt is not None else ""

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
        )
    except Exception as exc:  # pragma: no cover - runtime only
        code, hint = _classify_generation_exception(exc)
        detail = str(exc)
        raise RuntimeError(_serialize_generation_error(code, hint, detail)) from exc

    output_root = get_output_root()
    dated_dir = output_root / now.strftime("%Y%m%d")
    dated_dir.mkdir(parents=True, exist_ok=True)

    filename = f"{now.strftime('%H%M%S')}_{image_id}.png"
    output_path = dated_dir / filename
    image.save(output_path)

    relative_path = output_path.relative_to(output_root)

    return {
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
        "output_path": str(output_path),
        "relative_path": str(relative_path),
    }
