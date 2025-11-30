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

# 检测当前可见 GPU 数量（优先使用 CUDA_VISIBLE_DEVICES，其次使用 nvidia-smi），
# 仅用于决定要启动多少个 worker（按 GPU 数量循环启动）。
GPU_COUNT=1
if [[ -n "${CUDA_VISIBLE_DEVICES:-}" ]]; then
    IFS=',' read -ra CUDA_VISIBLE_DEVICES_ARR <<< "${CUDA_VISIBLE_DEVICES}"
    GPU_COUNT=0
    for dev in "${CUDA_VISIBLE_DEVICES_ARR[@]}"; do
        if [[ -n "${dev}" ]]; then
            GPU_COUNT=$((GPU_COUNT + 1))
        fi
    done
elif command -v nvidia-smi >/dev/null 2>&1; then
    GPU_COUNT="$(nvidia-smi --list-gpus 2>/dev/null | wc -l | tr -d ' ')"
fi

if ! [[ "${GPU_COUNT}" =~ ^[0-9]+$ ]] || [[ "${GPU_COUNT}" -lt 1 ]]; then
    GPU_COUNT=1
fi

echo "[dev_all] Detected ${GPU_COUNT} visible GPU(s); will launch ${GPU_COUNT} worker(s)."

: > "${API_LOG}"
: > "${WEB_LOG}"

echo "Starting API dev server..."
bash "${REPO_ROOT}/scripts/dev_api.sh" >> "${API_LOG}" 2>&1 &
API_PID=$!

echo "Starting Web dev server..."
bash "${REPO_ROOT}/scripts/dev_web.sh" >> "${WEB_LOG}" 2>&1 &
WEB_PID=$!

declare -a WORKER_PIDS=()
declare -a WORKER_LOGS=()

for ((gpu=0; gpu<GPU_COUNT; gpu++)); do
    WORKER_LOG="${LOG_DIR}/worker.gpu${gpu}.dev.log"
    : > "${WORKER_LOG}"
    echo "Starting Worker on GPU ${gpu}..."
    GPU_ID=${gpu} bash "${REPO_ROOT}/scripts/dev_worker.sh" >> "${WORKER_LOG}" 2>&1 &
    WORKER_PIDS+=("$!")
    WORKER_LOGS+=("${WORKER_LOG}")
done

echo
echo "All dev processes started:"
echo "  API   : PID ${API_PID}, log ${API_LOG}"
echo "  Web   : PID ${WEB_PID}, log ${WEB_LOG}"
for idx in "${!WORKER_PIDS[@]}"; do
    echo "  Worker (GPU ${idx}): PID ${WORKER_PIDS[${idx}]}, log ${WORKER_LOGS[${idx}]}"
done
echo
echo "To stop them, you can run:"
echo "  bash scripts/dev_stop.sh"
