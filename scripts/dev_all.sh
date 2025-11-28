#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="${REPO_ROOT}/logs"

mkdir -p "${LOG_DIR}"

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
