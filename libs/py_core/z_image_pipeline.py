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
import json
from pathlib import Path
from typing import Any

from .config import get_settings


def _env_flag_enabled(name: str) -> bool:
    """
    Helper for boolean-style environment flags.
    """

    value = os.getenv(name, "").strip().lower()
    return value in {"1", "true", "yes"}


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


def _maybe_enable_dfloat11(
    pipe: Any,
    *,
    torch: Any,
    models_dir: Path,
    local_subdir: Path,
) -> None:
    """
    Optionally wrap Z-Image components with DFloat11 compressed weights.

    Controlled via environment variables:
      - Z_IMAGE_USE_DF11: enable DF11 for the main transformer.
      - Z_IMAGE_DF11_DIR: override DF11 directory for the transformer.
      - Z_IMAGE_USE_DF11_TEXT: enable DF11 for the text encoder.
      - Z_IMAGE_TEXT_DF11_DIR: override DF11 directory for the text encoder.

    When enabled, this expects that:
      - The `dfloat11` package is installed in the worker environment.
      - You have already run `scripts/compress_z_image_dfloat11.py` to create
        compressed weights (for the relevant component).
    """

    use_transformer = _env_flag_enabled("Z_IMAGE_USE_DF11")
    use_text_encoder = _env_flag_enabled("Z_IMAGE_USE_DF11_TEXT")

    if not (use_transformer or use_text_encoder):
        return

    # DFloat11 is only useful (and tested) on CUDA.
    if not torch.cuda.is_available():  # pragma: no cover - hardware dependent
        return

    try:
        # Imported lazily so that non-DF11 deployments do not require this extra dep.
        from libs.py_core.dfloat11_ext import DFloat11Model  # type: ignore[import-not-found]
    except Exception as exc:  # pragma: no cover - runtime only
        raise ZImageNotAvailable(
            "DFloat11 is required but not available. Install it in the worker "
            "environment, e.g.: `uv add \"dfloat11[cuda12]\" --project apps/worker`."
        ) from exc

    # Helper for configuring a single component.
    def _configure_component(
        *,
        component_name: str,
        module: Any,
        default_suffix: str,
        env_dir_var: str,
    ) -> None:
        df11_dir_env = os.getenv(env_dir_var)
        if df11_dir_env:
            df11_dir = Path(df11_dir_env).expanduser().resolve()
        else:
            df11_dir = (models_dir / (str(local_subdir) + default_suffix)).resolve()

        if not df11_dir.exists():
            raise ZImageNotAvailable(
                f"DFloat11 is enabled for {component_name}, but the weights directory "
                f"was not found at '{df11_dir}'. Run "
                f"`uv run --project apps/worker python scripts/compress_z_image_dfloat11.py "
                f"--component {component_name}` first (or set {env_dir_var} to the correct path)."
            )

        # Best-effort sanity check: if our local DF11 config explicitly records
        # which logical component it was generated from, verify it matches what
        # we are about to hook into. This helps catch mistakes such as
        # compressing `transformer` but pointing Z_IMAGE_TEXT_DF11_DIR at it.
        cfg_path = df11_dir / "config.json"
        if cfg_path.exists():
            try:
                data = json.loads(cfg_path.read_text(encoding="utf-8"))
            except Exception:  # pragma: no cover - best effort only
                data = None

            if isinstance(data, dict):
                annotated = data.get("z_image_component")
                if isinstance(annotated, str) and annotated != component_name:
                    raise ZImageNotAvailable(
                        "DFloat11 weights component mismatch: "
                        f"config at '{df11_dir}' is tagged as '{annotated}', "
                        f"but you attempted to attach it to '{component_name}'. "
                        f"Please regenerate DF11 weights with "
                        f"`--component {component_name}` or point {env_dir_var} "
                        "to the correct directory."
                    )

        # Optional CPU offload: keep DF11 compressed tensors on CPU and only
        # stream per-block data to GPU during decode. This trades throughput
        # for lower steady-state VRAM.
        #
        # We support both a global toggle (Z_IMAGE_DF11_CPU_OFFLOAD) and
        # per-component overrides (Z_IMAGE_TEXT_DF11_CPU_OFFLOAD, etc.). The
        # per-component flag wins when explicitly set; otherwise the text
        # encoder will fall back to the global setting so that a single env
        # variable can enable offload for both transformer and text encoder.
        global_cpu_offload_flag = "Z_IMAGE_DF11_CPU_OFFLOAD"
        global_cpu_offload_blocks_flag = "Z_IMAGE_DF11_CPU_OFFLOAD_BLOCKS"

        if component_name == "transformer":
            cpu_offload_flag = "Z_IMAGE_DF11_CPU_OFFLOAD"
            cpu_offload_blocks_flag = "Z_IMAGE_DF11_CPU_OFFLOAD_BLOCKS"
        elif component_name == "text_encoder":
            cpu_offload_flag = "Z_IMAGE_TEXT_DF11_CPU_OFFLOAD"
            cpu_offload_blocks_flag = "Z_IMAGE_TEXT_DF11_CPU_OFFLOAD_BLOCKS"
        else:
            cpu_offload_flag = ""
            cpu_offload_blocks_flag = ""

        # First look at the component-specific flag; if it is unset for the
        # text encoder, fall back to the global DF11 flag so that
        # Z_IMAGE_DF11_CPU_OFFLOAD=1 affects both components by default.
        cpu_offload = False
        if cpu_offload_flag:
            local_raw = os.getenv(cpu_offload_flag)
            if local_raw is not None:
                cpu_offload = _env_flag_enabled(cpu_offload_flag)
            elif component_name == "text_encoder":
                cpu_offload = _env_flag_enabled(global_cpu_offload_flag)

        cpu_offload_blocks: int | None = None
        if cpu_offload:
            raw: str | None = None

            if cpu_offload_blocks_flag:
                raw = os.getenv(cpu_offload_blocks_flag)

            # If there is no per-component limit for the text encoder, fall
            # back to the global DF11 blocks limit.
            if not raw and component_name == "text_encoder":
                raw = os.getenv(global_cpu_offload_blocks_flag)

            if raw:
                try:
                    value = int(raw)
                    if value > 0:
                        cpu_offload_blocks = value
                except ValueError:
                    cpu_offload_blocks = None

        try:
            DFloat11Model.from_pretrained(
                str(df11_dir),
                device="cpu",
                bfloat16_model=module,
                cpu_offload=cpu_offload,
                cpu_offload_blocks=cpu_offload_blocks,
                pin_memory=True,
            )
        except Exception as exc:  # pragma: no cover - runtime only
            raise ZImageNotAvailable(
                f"Failed to configure DFloat11 for {component_name} from '{df11_dir}'. "
                "Please verify the compressed weights were generated with the "
                "current model version."
            ) from exc

    if use_transformer:
        _configure_component(
            component_name="transformer",
            module=pipe.transformer,
            default_suffix="-df11",
            env_dir_var="Z_IMAGE_DF11_DIR",
        )

    if use_text_encoder:
        _configure_component(
            component_name="text_encoder",
            module=pipe.text_encoder,
            default_suffix="-text-encoder-df11",
            env_dir_var="Z_IMAGE_TEXT_DF11_DIR",
        )


def _build_df11_only_pipeline(
    *,
    torch: Any,
    models_dir: Path,
    local_subdir: Path,
) -> Any:
    """
    Construct a Z-Image pipeline that relies only on local DFloat11-compressed
    weights, without requiring the original full-precision checkpoint on disk.

    Controlled via:
      - Z_IMAGE_VARIANT   : must be 'turbo' for now.
      - Z_IMAGE_USE_DF11  : enable this DF11-only loading path.
      - Z_IMAGE_DF11_ROOT : optional root directory for the DF11 bundle.
                            Defaults to MODELS_DIR/<local_subdir>-df11.

    The DF11 root is expected to contain:
      - scheduler/  (config only)
      - vae/        (full-precision VAE weights)
      - tokenizer/  (tokenizer files)
      - text_encoder/ (DF11 config + model.safetensors)
      - transformer/ (DF11 config + model.safetensors)
    """

    from diffusers import (  # type: ignore[import-not-found]
        AutoencoderKL,
        FlowMatchEulerDiscreteScheduler,
        ZImagePipeline,
        ZImageTransformer2DModel,
    )
    from transformers import (  # type: ignore[import-not-found]
        AutoConfig,
        AutoTokenizer,
        Qwen3Model,
    )

    variant = os.getenv("Z_IMAGE_VARIANT", "turbo").lower()
    if variant != "turbo":
        raise ZImageNotAvailable(
            "DFloat11 mode is currently only supported for Z_IMAGE_VARIANT=turbo."
        )

    df11_root_env = os.getenv("Z_IMAGE_DF11_ROOT")
    if df11_root_env:
        df11_root = Path(df11_root_env).expanduser().resolve()
    else:
        base_name = Path(str(local_subdir)).name
        df11_root = (models_dir / f"{base_name}-df11").resolve()

    if not df11_root.exists():
        raise ZImageNotAvailable(
            "Z_IMAGE_USE_DF11 is enabled, but the DF11 directory was not found at "
            f"'{df11_root}'. Set Z_IMAGE_DF11_ROOT to the directory that contains "
            "scheduler/, vae/, tokenizer/, text_encoder/ and transformer/."
        )

    scheduler_dir = df11_root / "scheduler"
    vae_dir = df11_root / "vae"
    tokenizer_dir = df11_root / "tokenizer"
    text_encoder_dir = df11_root / "text_encoder"
    transformer_dir = df11_root / "transformer"

    for path in (scheduler_dir, vae_dir, tokenizer_dir, text_encoder_dir, transformer_dir):
        if not path.exists():
            raise ZImageNotAvailable(
                "Z_IMAGE_USE_DF11 is enabled, but the DF11 directory is missing the "
                f"required subdirectory '{path.name}' under '{df11_root}'."
            )

    # Instantiate lightweight components from local configs.
    scheduler = FlowMatchEulerDiscreteScheduler.from_pretrained(
        str(df11_root),
        subfolder="scheduler",
    )
    vae = AutoencoderKL.from_pretrained(
        str(df11_root),
        subfolder="vae",
        torch_dtype=torch.bfloat16 if torch.cuda.is_available() else torch.float32,
    )
    tokenizer = AutoTokenizer.from_pretrained(
        str(df11_root),
        subfolder="tokenizer",
    )

    # Text encoder: build architecture from config only, then let DF11 hook in
    # the compressed weights. On CUDA, we construct it directly in bfloat16 so
    # that activations and DF11-backed weights have matching dtypes.
    te_config = AutoConfig.from_pretrained(str(text_encoder_dir))
    text_encoder = Qwen3Model(te_config)
    if torch.cuda.is_available():  # pragma: no cover - hardware dependent
        text_encoder = text_encoder.to(dtype=torch.bfloat16)

    # Transformer: read combined (base + DF11) config from the DF11 directory
    # and strip DF11-only metadata before constructing the base module.
    transformer_cfg_path = transformer_dir / "config.json"
    try:
        transformer_cfg = json.loads(transformer_cfg_path.read_text(encoding="utf-8"))
    except Exception as exc:  # pragma: no cover - runtime-only
        raise ZImageNotAvailable(
            f"Failed to read DF11 transformer config from '{transformer_cfg_path}'."
        ) from exc

    transformer_cfg.pop("dfloat11_config", None)
    transformer_cfg.pop("z_image_component", None)
    transformer = ZImageTransformer2DModel.from_config(transformer_cfg)
    if torch.cuda.is_available():  # pragma: no cover - hardware dependent
        transformer = transformer.to(dtype=torch.bfloat16)

    pipe = ZImagePipeline(
        scheduler=scheduler,
        vae=vae,
        text_encoder=text_encoder,
        tokenizer=tokenizer,
        transformer=transformer,
    )

    # Ensure DF11 env toggles are enabled by default in this mode, but do not
    # override explicit user configuration.
    os.environ.setdefault("Z_IMAGE_USE_DF11", "1")
    os.environ.setdefault("Z_IMAGE_USE_DF11_TEXT", "1")

    # 默认开启 DF11 的 CPU offload，以在 20GB 级别显卡上尽量避免 OOM；
    # 如需追求极致速度，可以在外部显式设置为 0 关闭。
    os.environ.setdefault("Z_IMAGE_DF11_CPU_OFFLOAD", "1")
    os.environ.setdefault("Z_IMAGE_TEXT_DF11_CPU_OFFLOAD", "1")

    # Point DF11 hooks at the DF11-only directories if the user has not
    # explicitly overridden them.
    os.environ.setdefault("Z_IMAGE_DF11_DIR", str(transformer_dir))
    os.environ.setdefault("Z_IMAGE_TEXT_DF11_DIR", str(text_encoder_dir))

    # Reuse the shared DF11 hook logic so CPU offload and component checks work
    # consistently with the regular path.
    _maybe_enable_dfloat11(
        pipe,
        torch=torch,
        models_dir=models_dir,
        local_subdir=local_subdir,
    )

    return pipe


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

    # 默认在 Turbo 变体上启用 DF11-only 模式：
    # - 若未显式设置 Z_IMAGE_USE_DF11，则视为开启；
    # - 若设置为 0/false，则回退到普通全精度加载路径。
    raw_df11_flag = os.getenv("Z_IMAGE_USE_DF11")
    if variant == "turbo" and raw_df11_flag is None:
        df11_only = True
    else:
        df11_only = _env_flag_enabled("Z_IMAGE_USE_DF11")

    if df11_only:
        pipe = _build_df11_only_pipeline(
            torch=torch,
            models_dir=models_dir,
            local_subdir=local_subdir,
        )
    else:
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
