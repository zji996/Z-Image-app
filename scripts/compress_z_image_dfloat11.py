"""
Utility script to compress the Z-Image Turbo transformer weights with DFloat11.

This follows the pattern from third_party/DFloat11/examples/compress_flux1,
but is adapted to the ZImageTransformer2DModel used in the diffusers pipeline.

Usage (from the repo root):

  uv run --project apps/worker python scripts/compress_z_image_dfloat11.py \\
      --model-path models/z-image-turbo \\
      --save-path models/z-image-turbo-df11 \\
      --save-single-file \\
      --check-correctness

You only need to run this once per model version to generate the compressed
weights directory (models/z-image-turbo-df11 by default).
"""

from __future__ import annotations

from argparse import ArgumentParser
import json
from pathlib import Path
from typing import Dict, Tuple

import torch
import torch.nn as nn
from diffusers import ZImagePipeline

from libs.py_core.dfloat11_ext import compress_model


# Some tiny helper modules in the Z-Image transformer directly access
# `Linear.weight` outside the actual forward call (e.g. to read `dtype`).
# These are incompatible with DF11's strategy of temporarily removing
# the `weight` attribute and reconstructing it in a forward pre-hook.
#
# To avoid AttributeError at inference time, we explicitly skip those
# modules when building the compression pattern.
_EXCLUDED_BY_COMPONENT: dict[str, set[str]] = {
    # `transformer_z_image.TransformerTimeEmbedding.forward` does
    # `weight_dtype = self.mlp[0].weight.dtype`, so we must not let
    # DF11 remove that weight.
    "transformer": {
        "t_embedder.mlp.0",
        "t_embedder.mlp.2",
    },
}


def build_pattern_dict(root_module: nn.Module, *, component: str | None = None) -> Dict[str, Tuple[str, ...]]:
    """
    Automatically build a compression pattern that covers *all* bf16 Linear /
    Embedding weights inside a given root module (transformer, text encoder,
    or VAE).

    We treat every `nn.Linear` / `nn.Embedding` under `pipe.transformer` as an
    independent DFloat11 block, so there is no need to manually maintain a
    block-wise pattern like in the FLUX.1 example.
    """

    pattern_dict: Dict[str, Tuple[str, ...]] = {}
    excluded = _EXCLUDED_BY_COMPONENT.get(component or "", set())

    for name, module in root_module.named_modules():
        if isinstance(module, (nn.Linear, nn.Embedding)):
            if name in excluded:
                # These remain as plain bf16 weights to keep the
                # upstream diffusers code happy.
                continue
            # Use the exact qualified module name as the regex pattern.
            # For simple Linear / Embedding modules, DFloat11's `compress_model`
            # ignores `attr_names` and compresses the module's own `weight`.
            pattern_dict[name] = ()

    if not pattern_dict:
        raise RuntimeError("No Linear/Embedding modules found under target component; nothing to compress.")

    print(f"[DF11] Will compress {len(pattern_dict)} Linear/Embedding modules under target component.")

    return pattern_dict


def _annotate_config_with_component(save_path: Path, component: str) -> None:
    """
    Tag the generated config.json with the logical Z-Image component name.

    This helps downstream code detect obvious mismatches such as
    "DF11 weights produced from transformer but placed under a text_encoder
    directory". The DFloat11 library ignores extra top-level keys, so this
    is safe and backwards compatible.
    """

    cfg_path = save_path / "config.json"
    if not cfg_path.exists():
        return

    try:
        raw = cfg_path.read_text(encoding="utf-8")
        data = json.loads(raw)
    except Exception:
        # Best-effort only – never break compression because of local metadata.
        return

    if not isinstance(data, dict):
        return

    # If it is already correctly annotated, keep it as-is.
    existing = data.get("z_image_component")
    if isinstance(existing, str) and existing == component:
        return

    data["z_image_component"] = component
    cfg_path.write_text(json.dumps(data, indent=2), encoding="utf-8")


def main() -> None:
    parser = ArgumentParser("Compress Z-Image Turbo transformer using DFloat11")
    parser.add_argument(
        "--component",
        type=str,
        choices=["transformer", "text_encoder", "vae"],
        default="transformer",
        help="Which pipeline component to compress (default: transformer).",
    )
    parser.add_argument(
        "--model-path",
        type=str,
        default="models/z-image-turbo",
        help="Local path to the Z-Image-Turbo diffusers model directory.",
    )
    parser.add_argument(
        "--save-path",
        type=str,
        default="models/z-image-turbo-df11",
        help="Directory where the compressed DF11 weights will be saved.",
    )
    parser.add_argument(
        "--save-single-file",
        action="store_true",
        help="Save a single model.safetensors file instead of per-block shards.",
    )
    parser.add_argument(
        "--no-check-correctness",
        action="store_true",
        help="Disable bit-for-bit correctness check (not recommended).",
    )
    parser.add_argument(
        "--threads-per-block-override",
        type=int,
        default=0,
        help=(
            "Override CUDA threads_per_block for DF11 decode; "
            "use e.g. 256 for text_encoder; 0 keeps the upstream default.",
        ),
    )
    parser.add_argument(
        "--block-range",
        type=int,
        nargs=2,
        default=(0, 10000),
        help="Range of blocks to compress (mainly for parallel runs).",
    )
    args = parser.parse_args()

    model_path = Path(args.model_path).resolve()
    if not model_path.exists():
        raise SystemExit(f"Model path does not exist: {model_path}")

    save_path = Path(args.save_path).resolve()
    save_path.parent.mkdir(parents=True, exist_ok=True)

    # Load the Z-Image pipeline on CPU in bfloat16, similar to the official
    # README example, but from the local directory.
    pipe = ZImagePipeline.from_pretrained(
        str(model_path),
        torch_dtype=torch.bfloat16,
        low_cpu_mem_usage=False,
    )

    if args.component == "transformer":
        target_module: nn.Module = pipe.transformer
    elif args.component == "text_encoder":
        target_module = pipe.text_encoder
    elif args.component == "vae":
        target_module = pipe.vae
    else:  # pragma: no cover - defensive
        raise SystemExit(f"Unsupported component: {args.component}")

    pattern_dict = build_pattern_dict(target_module, component=args.component)

    compress_model(
        threads_per_block_override=(args.threads_per_block_override or None),
        model=target_module,
        pattern_dict=pattern_dict,
        save_path=str(save_path),
        block_range=list(args.block_range),
        save_single_file=args.save_single_file,
        check_correctness=not args.no_check_correctness,
    )

    # Best-effort: mark which logical component these DF11 weights belong to.
    _annotate_config_with_component(save_path, args.component)


if __name__ == "__main__":
    main()
