#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "${REPO_ROOT}"

if [[ -f "${REPO_ROOT}/.env" ]]; then
    set -a
    # shellcheck source=/dev/null
    . "${REPO_ROOT}/.env"
    set +a
fi

# Allow specifying GPU ID via either the GPU_ID env var or
# as the first positional argument, e.g.:
#   bash scripts/dev_worker.sh 0
if [[ $# -ge 1 && -z "${GPU_ID:-}" ]]; then
    export GPU_ID="$1"
    shift
fi

# 首次启动时，尽力确保 DF11 模型已下载到 MODELS_DIR/z-image-turbo-df11。
# 若目录已存在，则 download_models.py 会直接复用，无需重复拉取。
if ! [ -d "${MODELS_DIR:-${REPO_ROOT}/models}/z-image-turbo-df11" ]; then
    echo "[dev_worker] Detected missing DF11 bundle, downloading via scripts/download_models.py ..."
    bash "${REPO_ROOT}/scripts/download_models.sh" \
        --model z_image_turbo_df11 \
        --source modelscope \
        --non-interactive || echo "[dev_worker] DF11 download failed, please run scripts/download_models.sh 手动下载。"
fi

if [[ -n "${GPU_ID:-}" && -z "${Z_IMAGE_DEVICE:-}" ]]; then
    export Z_IMAGE_DEVICE="cuda:${GPU_ID}"
fi

exec uv run --project apps/worker python -m apps.worker.main
