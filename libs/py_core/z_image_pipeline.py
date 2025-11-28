"""
Z-Image Turbo pipeline adapter.

This module wraps the third-party Z-Image model (see `third_party/Z-Image`
and Hugging Face `Tongyi-MAI/Z-Image-Turbo`) so that apps only depend on
`libs.py_core` instead of importing any third_party code directly.

The actual heavy dependencies (torch / diffusers) are intentionally kept
out of this repo's runtime for now – install them in the API environment
when you are ready to run inference.
"""

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import Any

from .config import get_settings


# 默认使用 Turbo 版本，后续 Base / Edit 发布后可以通过环境变量切换
DEFAULT_Z_IMAGE_MODEL_ID = "Tongyi-MAI/Z-Image-Turbo"

# 统一管理不同变体在本地 MODELS_DIR 下的子目录命名
_VARIANT_REGISTRY: dict[str, dict[str, str | None]] = {
    "turbo": {
        "local_subdir": "z-image-turbo",
        "default_model_id": DEFAULT_Z_IMAGE_MODEL_ID,
    },
    # 预留位置，待官方发布后填写对应的仓库 ID
    "base": {
        "local_subdir": "z-image-base",
        "default_model_id": None,
    },
    "edit": {
        "local_subdir": "z-image-edit",
        "default_model_id": None,
    },
}


class ZImageNotAvailable(RuntimeError):
    """Raised when required runtime dependencies for Z-Image are missing."""


def _ensure_runtime() -> tuple[Any, Any]:
    """
    Import torch and diffusers lazily so that the rest of the codebase
    (and tooling like linters) does not require GPU deps by default.
    """

    try:
        import torch  # type: ignore[import-not-found]
    except Exception as exc:  # pragma: no cover - runtime only
        raise ZImageNotAvailable(
            "PyTorch is required to run the Z-Image pipeline. "
            "Install it in your API environment, e.g.: `uv add torch`."
        ) from exc

    try:
        from diffusers import ZImagePipeline  # type: ignore[import-not-found]
    except Exception as exc:  # pragma: no cover - runtime only
        raise ZImageNotAvailable(
            "diffusers is required to run the Z-Image pipeline. "
            "Install it in your API environment, e.g.: "
            "`uv add diffusers` (or pip/poetry equivalent)."
        ) from exc

    return torch, ZImagePipeline


@lru_cache(maxsize=1)
def get_zimage_pipeline(device: str | None = None, model_id: str | None = None):
    """
    Lazily construct and cache a Z-Image pipeline instance.

    - 使用 MODELS_DIR (shared settings) 作为本地模型根目录。
    - 优先从本地磁盘加载对应变体，如果不存在则回退到远程仓库。
    - 通过环境变量控制变体 / 版本，便于兼容 Turbo / Base / Edit：
      - Z_IMAGE_VARIANT: turbo（默认）/ base / edit
      - Z_IMAGE_MODEL_ID: 覆盖默认的远程仓库 ID
    - 设备选择：优先 CUDA（bfloat16），否则 CPU（float32）。
    """

    torch, ZImagePipeline = _ensure_runtime()

    settings = get_settings()
    models_dir: Path = settings.models_dir

    variant = os.getenv("Z_IMAGE_VARIANT", "turbo").lower()
    variant_cfg = _VARIANT_REGISTRY.get(variant)
    if variant_cfg is None:
        raise ValueError(
            f"Unknown Z-Image variant '{variant}'. "
            f"Valid options: {', '.join(_VARIANT_REGISTRY.keys())}"
        )

    local_subdir = Path(str(variant_cfg["local_subdir"]))  # type: ignore[arg-type]
    default_model_id = (
        variant_cfg["default_model_id"] or DEFAULT_Z_IMAGE_MODEL_ID  # type: ignore[arg-type]
    )
    resolved_model_id = model_id or os.getenv("Z_IMAGE_MODEL_ID", default_model_id)

    local_dir = (models_dir / local_subdir).resolve()

    env_device = os.getenv("Z_IMAGE_DEVICE")
    requested_device = device or env_device

    if torch.cuda.is_available():  # pragma: no cover - hardware dependent
        dtype = torch.bfloat16
        target_device = requested_device or "cuda"
    else:  # pragma: no cover - hardware dependent
        dtype = torch.float32
        target_device = requested_device or "cpu"

    # 如果本地已经通过 scripts/download_models.py 拉取过对应变体，优先从本地加载
    if local_dir.exists():
        pretrained_path: str | Path = local_dir
        extra_kwargs: dict[str, Any] = {}
    else:
        pretrained_path = resolved_model_id
        extra_kwargs = {"cache_dir": models_dir}

    pipe = ZImagePipeline.from_pretrained(
        pretrained_path,
        torch_dtype=dtype,
        low_cpu_mem_usage=False,
        **extra_kwargs,
    )
    pipe.to(target_device)
    return pipe


def generate_image(
    *,
    prompt: str,
    height: int = 1024,
    width: int = 1024,
    num_inference_steps: int = 9,
    guidance_scale: float = 0.0,
    seed: int | None = None,
):
    """
    Helper for running a single Z-Image generation step using the shared
    pipeline configuration.
    """

    torch, _ = _ensure_runtime()

    pipeline = get_zimage_pipeline()

    generator = None
    if seed is not None:
        device = getattr(pipeline, "device", None) or "cuda" if torch.cuda.is_available() else "cpu"
        generator = torch.Generator(device=device).manual_seed(seed)

    result = pipeline(
        prompt=prompt,
        height=height,
        width=width,
        num_inference_steps=num_inference_steps,
        guidance_scale=guidance_scale,
        generator=generator,
    )
    return result.images[0]
