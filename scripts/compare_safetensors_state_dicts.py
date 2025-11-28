"""
Compare two safetensors state_dicts for exact equality.

This is useful for validating that a DF11 model produced by the
parallel compressor is bit-for-bit identical to one produced by
the single-thread script.

Example:

  uv run --project apps/worker python -m scripts.compare_safetensors_state_dicts \\
      --a models/z-image-turbo-df11-single/model.safetensors \\
      --b models/z-image-turbo-df11-parallel/model.safetensors
"""

from __future__ import annotations

from argparse import ArgumentParser
from pathlib import Path

from safetensors.torch import load_file


def main() -> None:
    parser = ArgumentParser("Compare two safetensors files for equality.")
    parser.add_argument("--a", type=str, required=True, help="Path to first safetensors file.")
    parser.add_argument("--b", type=str, required=True, help="Path to second safetensors file.")
    args = parser.parse_args()

    path_a = Path(args.a).resolve()
    path_b = Path(args.b).resolve()

    if not path_a.exists():
        raise SystemExit(f"File not found: {path_a}")
    if not path_b.exists():
        raise SystemExit(f"File not found: {path_b}")

    print(f"[DF11] Loading A: {path_a}")
    state_a = load_file(path_a)
    print(f"[DF11] Loading B: {path_b}")
    state_b = load_file(path_b)

    keys_a = set(state_a.keys())
    keys_b = set(state_b.keys())

    if keys_a != keys_b:
        missing_in_b = keys_a - keys_b
        missing_in_a = keys_b - keys_a
        raise SystemExit(
            f"Key mismatch.\n"
            f"  Only in A: {sorted(missing_in_b)[:10]}\n"
            f"  Only in B: {sorted(missing_in_a)[:10]}"
        )

    for k in sorted(keys_a):
        ta = state_a[k]
        tb = state_b[k]
        if ta.shape != tb.shape or ta.dtype != tb.dtype:
            raise SystemExit(f"Tensor metadata mismatch for key '{k}'.")
        if not (ta == tb).all().item():
            raise SystemExit(f"Tensor values differ for key '{k}'.")

    print("[DF11] The two safetensors files are exactly identical.")


if __name__ == "__main__":
    main()

