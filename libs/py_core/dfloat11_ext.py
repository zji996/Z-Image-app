from __future__ import annotations

"""Thin wrapper around the upstream `dfloat11` package.

This stays under `libs/py_core` so that application code only imports
DFloat11 through our own namespace, and also allows us to apply
project-specific tweaks (e.g. safer CUDA launch config for huge
text encoders) without patching `third_party/` or the installed
package directly.
"""

from typing import Any, Dict, List


try:  # pragma: no cover - runtime-only dependency
    import dfloat11 as _dfloat11  # type: ignore[import-not-found]
except ImportError as exc:  # pragma: no cover - runtime-only dependency
    raise RuntimeError(
        "DFloat11 is required but not installed. "
        "Install it in the worker environment, e.g.: "
        "`uv add \"dfloat11[cuda12]\" --project apps/worker`."
    ) from exc


DFloat11Model = _dfloat11.DFloat11Model  # re-export for runtime use


def compress_model(
    *,
    model: Any,
    pattern_dict: Dict[str, List[str]],
    save_path: str,
    block_range: List[int] | None = None,
    save_single_file: bool = True,
    check_correctness: bool = True,
    threads_per_block_override: int | None = None,
) -> None:
    """Call upstream ``compress_model`` with optional CUDA tuning.

    ``threads_per_block_override`` lets us lower the CUDA block size for
    components with extremely large embedding tables (e.g. Qwen3 text
    encoders) to avoid ``CUDA_ERROR_INVALID_VALUE`` from excessive
    shared memory requirements in the DF11 decode kernel.
    """

    if block_range is None:
        block_range = [0, 10000]

    # The upstream implementation stores the CUDA launch config as a
    # module-level global in ``dfloat11.dfloat11`` and exposes a thin
    # package wrapper in ``dfloat11/__init__.py``. Importing the package
    # as ``dfloat11`` therefore does *not* give us direct access to the
    # ``threads_per_block`` global that ``compress_model`` reads.
    #
    # Here we resolve the concrete implementation module from the
    # function object itself and patch its ``threads_per_block`` global,
    # so both compression and the generated ``dfloat11_config`` capture
    # the overridden value.
    import sys

    impl_module_name = getattr(_dfloat11.compress_model, "__module__", None)
    impl_module = sys.modules.get(impl_module_name, _dfloat11)

    # Preserve the original setting so we don't affect callers outside
    # this wrapper.
    old_threads = getattr(impl_module, "threads_per_block", None)

    try:
        if threads_per_block_override is not None:
            impl_module.threads_per_block = (int(threads_per_block_override),)

        _dfloat11.compress_model(
            model=model,
            pattern_dict=pattern_dict,
            save_path=save_path,
            block_range=block_range,
            save_single_file=save_single_file,
            check_correctness=check_correctness,
        )
    finally:
        if old_threads is not None:
            impl_module.threads_per_block = old_threads
