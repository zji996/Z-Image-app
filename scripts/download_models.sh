#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# 统一使用 apps/api 的 uv 环境来运行下载脚本。
# 如需使用 worker 环境，可以将下面的路径改为 apps/worker。
cd "${REPO_ROOT}/apps/api"

exec uv run python ../../scripts/download_models.py "$@"

