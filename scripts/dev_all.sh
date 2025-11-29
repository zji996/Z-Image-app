#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="${REPO_ROOT}/logs"

mkdir -p "${LOG_DIR}"

# 确保 DF11 模型在首次启动时已下载到 MODELS_DIR/z-image-turbo-df11。
# 若目录已存在，则 download_models.py 会直接复用并避免重复拉取。
if ! [ -d "${MODELS_DIR:-${REPO_ROOT}/models}/z-image-turbo-df11" ]; then
    echo "[dev_all] Detected missing DF11 bundle, downloading via scripts/download_models.py ..."
    bash "${REPO_ROOT}/scripts/download_models.sh" \
        --model z_image_turbo_df11 \
        --source modelscope \
        --non-interactive || echo "[dev_all] DF11 download failed, please run scripts/download_models.sh 手动下载。"
fi

# Best-effort: stop any existing dev processes before starting new ones.
echo "Stopping existing dev services (if any)..."
bash "${REPO_ROOT}/scripts/dev_stop.sh" || true
echo

API_LOG="${LOG_DIR}/api.dev.log"
WEB_LOG="${LOG_DIR}/web.dev.log"
WORKER_LOG="${LOG_DIR}/worker.dev.log"

: > "${API_LOG}"
: > "${WEB_LOG}"
: > "${WORKER_LOG}"

echo "Starting API dev server..."
bash "${REPO_ROOT}/scripts/dev_api.sh" >> "${API_LOG}" 2>&1 &
API_PID=$!

echo "Starting Web dev server..."
bash "${REPO_ROOT}/scripts/dev_web.sh" >> "${WEB_LOG}" 2>&1 &
WEB_PID=$!

echo "Starting Worker..."
bash "${REPO_ROOT}/scripts/dev_worker.sh" >> "${WORKER_LOG}" 2>&1 &
WORKER_PID=$!

echo
echo "All dev processes started:"
echo "  API   : PID ${API_PID}, log ${API_LOG}"
echo "  Web   : PID ${WEB_PID}, log ${WEB_LOG}"
echo "  Worker: PID ${WORKER_PID}, log ${WORKER_LOG}"
echo
echo "To stop them, you can run:"
echo "  bash scripts/dev_stop.sh"
