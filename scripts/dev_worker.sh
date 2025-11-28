#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "${REPO_ROOT}"

if [[ -n "${GPU_ID:-}" && -z "${Z_IMAGE_DEVICE:-}" ]]; then
    export Z_IMAGE_DEVICE="cuda:${GPU_ID}"
fi

exec uv run --project apps/worker python -m apps.worker.main
