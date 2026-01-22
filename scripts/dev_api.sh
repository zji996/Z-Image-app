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

exec uv run --project apps/api uvicorn apps.api.main:app --reload --host "${API_HOST:-0.0.0.0}" --port "${API_PORT:-8000}"
