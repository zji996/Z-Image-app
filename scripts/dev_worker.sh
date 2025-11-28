#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "${REPO_ROOT}/apps/worker"

if [[ -n "${GPU_ID:-}" && -z "${Z_IMAGE_DEVICE:-}" ]]; then
    export Z_IMAGE_DEVICE="cuda:${GPU_ID}"
fi

exec uv run python -m apps.worker.main
