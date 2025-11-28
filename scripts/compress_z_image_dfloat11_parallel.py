"""
Parallel DFloat11 compression for Z-Image Turbo.

This script coordinates multiple Python worker processes, each running
`scripts.compress_z_image_dfloat11` on a disjoint `block_range`, so that
all bf16 Linear/Embedding weights in the transformer are compressed in
parallel across CPU cores.

Example usage (from the repo root, after installing dfloat11):

  uv run --project apps/worker python -m scripts.compress_z_image_dfloat11_parallel \\
      --model-path models/z-image-turbo \\
      --save-path models/z-image-turbo-df11 \\
      --blocks-per-task 16 \\
      --max-workers 8

Notes:
  - By default each worker writes its own `.safetensors` shard; you can
    pass `--save-single-file` to repack all shards into a single
    `model.safetensors` under `--save-path` once all workers finish.
  - The last worker (whose block_range upper bound covers the final block)
    will also write `config.json` with the `dfloat11_config` metadata,
    which is copied next to the final single-file model when repacking.
"""

from __future__ import annotations

import argparse
import gc
import os
import subprocess
import sys
import time
from pathlib import Path
from typing import List, Tuple

import torch
from diffusers import ZImagePipeline
from safetensors.torch import load_file, save_file

try:
    from scripts.compress_z_image_dfloat11 import build_pattern_dict  # type: ignore[import-not-found]
except Exception:  # supports direct `python scripts/...`
    try:
        from .compress_z_image_dfloat11 import build_pattern_dict  # type: ignore[import-not-found]
    except Exception:
        from compress_z_image_dfloat11 import build_pattern_dict  # type: ignore[import-not-found]


def _get_component_module(pipe: ZImagePipeline, component: str):
    if component == "transformer":
        return pipe.transformer
    if component == "text_encoder":
        return pipe.text_encoder
    if component == "vae":
        return pipe.vae
    raise SystemExit(f"Unsupported component for DF11 compression: {component}")


def _compute_total_blocks(model_path: Path, component: str) -> int:
    """
    Load the local Z-Image pipeline once and count how many Linear/Embedding
    modules under `pipe.transformer` will be compressed.
    """

    pipe = ZImagePipeline.from_pretrained(
        str(model_path),
        torch_dtype=torch.bfloat16,
        low_cpu_mem_usage=False,
    )
    target_module = _get_component_module(pipe, component)

    pattern_dict = build_pattern_dict(target_module, component=component)
    total_blocks = len(pattern_dict)

    # Free memory before spawning worker processes.
    del target_module
    del pipe
    gc.collect()

    print(f"[DF11] Total modules to compress for component '{component}': {total_blocks}")
    return total_blocks


def _build_ranges(total_blocks: int, blocks_per_task: int) -> List[Tuple[int, int]]:
    """
    Build (start, end) block ranges suitable for DFloat11's `block_range`
    semantics, where each worker compresses blocks (start, end].
    """

    ranges: List[Tuple[int, int]] = []
    start = 0

    while start < total_blocks:
        end = min(start + blocks_per_task, total_blocks)
        ranges.append((start, end))
        start = end

    return ranges


def main() -> None:
    parser = argparse.ArgumentParser("Parallel DFloat11 compression for Z-Image Turbo")
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
        help="Directory where the compressed DF11 weights will be written.",
    )
    parser.add_argument(
        "--blocks-per-task",
        type=int,
        default=16,
        help="How many modules (within the chosen component) each worker compresses.",
    )
    parser.add_argument(
        "--max-workers",
        type=int,
        default=max(os.cpu_count() or 1, 1),
        help="Maximum number of concurrent worker processes.",
    )
    parser.add_argument(
        "--no-check-correctness",
        action="store_true",
        help="Disable bit-for-bit correctness check inside each worker.",
    )
    parser.add_argument(
        "--component",
        type=str,
        choices=["transformer", "text_encoder", "vae"],
        default="transformer",
        help=(
            "Which Z-Image pipeline component to compress in parallel. "
            "Must match the component used at inference time."
        ),
    )
    parser.add_argument(
        "--save-single-file",
        action="store_true",
        help=(
            "If set, workers write shards into an internal '_shards' subdirectory "
            "and this launcher repacks them into a single 'model.safetensors' "
            "file under --save-path (also copying config.json)."
        ),
    )
    args = parser.parse_args()

    model_path = Path(args.model_path).resolve()
    if not model_path.exists():
        raise SystemExit(f"Model path does not exist: {model_path}")

    final_dir = Path(args.save_path).resolve()
    final_dir.mkdir(parents=True, exist_ok=True)

    # Where worker processes actually write their .safetensors shards.
    if args.save_single_file:
        shards_dir = final_dir / "_df11_shards"
    else:
        shards_dir = final_dir
    shards_dir.mkdir(parents=True, exist_ok=True)

    blocks_per_task = max(1, args.blocks_per_task)
    max_workers = max(1, args.max_workers)

    # GPU correctness check itself uses quite a bit of VRAM per worker.
    # To avoid CUDA OOM, force single-worker mode if correctness checks
    # are enabled.
    if not args.no_check_correctness and max_workers > 1:
        print(
            "[DF11] correctness check is enabled; forcing max-workers=1 "
            "to avoid GPU OOM during parallel compression."
        )
        max_workers = 1

    total_blocks = _compute_total_blocks(model_path, args.component)
    ranges = _build_ranges(total_blocks, blocks_per_task)

    print(
        f"[DF11] Using blocks_per_task={blocks_per_task}, max_workers={max_workers}, "
        f"num_tasks={len(ranges)}"
    )

    procs: List[subprocess.Popen] = []

    for task_idx, (start, end) in enumerate(ranges):
        # Throttle to `max_workers` concurrent processes.
        while len(procs) >= max_workers:
            alive = []
            for p in procs:
                ret = p.poll()
                if ret is None:
                    alive.append(p)
                elif ret != 0:
                    raise SystemExit(f"Worker process exited with code {ret}.")
            procs = alive
            if len(procs) >= max_workers:
                time.sleep(1.0)

        cmd = [
            sys.executable,
            "-m",
            "scripts.compress_z_image_dfloat11",
            "--model-path",
            str(model_path),
            "--save-path",
            str(shards_dir),
            "--component",
            args.component,
            "--threads-per-block-override",
            "256" if args.component == "text_encoder" else "0",
            "--block-range",
            str(start),
            str(end),
        ]

        if args.no_check_correctness:
            cmd.append("--no-check-correctness")

        print(f"[DF11] Launching task {task_idx}: blocks ({start}, {end}]")
        procs.append(subprocess.Popen(cmd))

    # Wait for all workers to complete.
    for p in procs:
        ret = p.wait()
        if ret != 0:
            raise SystemExit(f"Worker process exited with code {ret}.")

    # Optionally repack all shards into a single safetensors file.
    if args.save_single_file:
        print(f"[DF11] Repacking shards from {shards_dir} into single file under {final_dir} ...")
        combined = {}
        for fname in os.listdir(shards_dir):
            if not fname.endswith(".safetensors"):
                continue
            tensors = load_file(shards_dir / fname)
            combined.update(tensors)

        if not combined:
            raise SystemExit(f"No .safetensors shards found in {shards_dir}, nothing to repack.")

        save_file(combined, final_dir / "model.safetensors")

        # Propagate config.json (dfloat11_config) alongside the single file.
        cfg_src = shards_dir / "config.json"
        cfg_dst = final_dir / "config.json"
        if cfg_src.exists() and not cfg_dst.exists():
            cfg_dst.write_bytes(cfg_src.read_bytes())

        print("[DF11] Parallel compression completed, single-file model saved.")
    else:
        print("[DF11] Parallel compression completed successfully (sharded output).")


if __name__ == "__main__":
    main()
