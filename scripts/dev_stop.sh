#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PIDS_FILE="${REPO_ROOT}/logs/dev_all.pids"

echo "Stopping dev services (API / worker / web)..."

# 1) API dev server (uvicorn) — kill by port and by command pattern
API_PORT="${API_PORT:-8000}"
if command -v lsof >/dev/null 2>&1; then
    API_PIDS="$(lsof -ti:${API_PORT} 2>/dev/null || true)"
    if [[ -n "${API_PIDS}" ]]; then
        echo "Stopping API dev server listening on port ${API_PORT}: ${API_PIDS}"
        for pid in ${API_PIDS}; do
            kill "${pid}" || true
        done
    fi
fi

if command -v pkill >/dev/null 2>&1; then
    echo "Stopping API uvicorn processes (if any)..."
    pkill -f "uvicorn apps.api.main:app" || true
fi

# 2) Worker (Celery via apps.worker.main)
if command -v pkill >/dev/null 2>&1; then
    echo "Stopping worker processes (if any)..."
    pkill -f "python -m apps.worker.main" || true
fi

# 3) Frontend Vite dev server for apps/web (may have been started manually)
WEB_ROOT="${REPO_ROOT}/apps/web"

# Kill Vite node processes that are running from this repo's web app
if command -v pkill >/dev/null 2>&1; then
    echo "Stopping Vite dev servers for apps/web (if any)..."
    pkill -f "${WEB_ROOT}.*vite/bin/vite.js" || true
fi

# Kill pnpm dev processes whose current working directory is apps/web
if command -v ps >/dev/null 2>&1; then
    echo "Stopping pnpm dev processes in ${WEB_ROOT} (if any)..."
    while read -r pid cmd; do
        # Match pnpm dev command
        if [[ "${cmd}" == *"pnpm dev"* ]]; then
            cwd="$(readlink -f "/proc/${pid}/cwd" 2>/dev/null || true)"
            if [[ "${cwd}" == "${WEB_ROOT}" ]]; then
                echo "  -> Stopping pnpm dev (pid=${pid}, cwd=${cwd})"
                kill "${pid}" || true
            fi
        fi
    done < <(ps -eo pid=,command=)
fi

# 4) Remove legacy PID file if it exists (no longer used)
if [[ -f "${PIDS_FILE}" ]]; then
    rm -f "${PIDS_FILE}" || true
fi

echo "Done."
