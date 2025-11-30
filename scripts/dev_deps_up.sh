#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "${REPO_ROOT}"

if ! command -v docker >/dev/null 2>&1; then
    echo "[dev_deps_up] docker 命令不存在，请先安装 Docker。"
    exit 1
fi

DOCKER_CMD=(docker)

if ! "${DOCKER_CMD[@]}" compose -f infra/docker-compose.dev.yml up -d; then
    if command -v sudo >/dev/null 2>&1; then
        echo "[dev_deps_up] 以当前用户访问 Docker 失败，尝试使用 sudo 重新运行..."
        DOCKER_CMD=(sudo docker)
        "${DOCKER_CMD[@]}" compose -f infra/docker-compose.dev.yml up -d
    else
        echo "[dev_deps_up] 无法访问 Docker 守护进程，请确认 Docker 已启动且当前用户有权限访问 /var/run/docker.sock。"
        exit 1
    fi
fi
