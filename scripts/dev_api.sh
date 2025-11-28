#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "${REPO_ROOT}"

exec uv run --project apps/api uvicorn apps.api.main:app --reload --host "${API_HOST:-0.0.0.0}" --port "${API_PORT:-8000}"
