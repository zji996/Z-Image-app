# Repository Guidelines

This guide is for all contributors and agents working in this monorepo.

## Project Structure & Monorepo Rules

- Business apps live in `apps/` (`api`, `web`, `worker`); each app has its own entrypoint (`main.py` / `main.tsx`) and dependency file (`pyproject.toml` / `package.json`).
- Shared code lives in `libs/` (`libs/py_core` for backend logic, `libs/ts_ui` for React/Tailwind UI). Apps may import from `libs/` only, never from other `apps/` or `third_party/`.
- Models and runtime weights live only in `models/` (ignored by Git, addressed via `MODELS_DIR`), infrastructure in `infra/`, automation in `scripts/`, docs in `docs/`, static assets in `assets/`, and upstream submodules in `third_party/` (read‑only).

## Environment, Build & Development

- Local services (PostgreSQL 17, Redis 7): `docker compose -f infra/docker-compose.dev.yml up -d`.
- Python (FastAPI, Celery) uses `uv` per app: each `apps/*` Python app has its own `pyproject.toml` + `uv.lock`; manage deps with `uv add/remove/sync` (letting `uv sync` create local `.venv/` that stay untracked), and run from the repo root with `uv run --project apps/api ...` / `uv run --project apps/worker ...` or via scripts in `scripts/` so imports from `apps/` and `libs/` work without touching `sys.path`.
- Frontend uses Vite + React + Tailwind v4: prefer `pnpm` (`pnpm install`, `pnpm dev`) inside `apps/web`; fall back to `npm` only if needed.
- Each app maintains its own `.env` (untracked) and `.env.example` (tracked). Use env vars for all configuration (DB, Redis, `MODELS_DIR`); never hard‑code secrets or paths.

## Coding, Testing & Tooling

- Python: PEP 8, 4‑space indentation, type hints where reasonable. Do not mutate `sys.path`; wire `libs/` via proper local dependencies in `pyproject.toml`.
- TypeScript/JSX: idiomatic React with functional components and hooks; keep Tailwind classes readable and composable.
- Prefer pytest for backend tests and Vitest/Jest for frontend; name tests `test_*.py` / `*.test.tsx`. Keep tests fast and deterministic (no real model downloads or external services).
- Configure linters/type‑checkers and test runners to ignore `third_party/`.

## Git, PRs & Agent‑Specific Rules

- Commits should be small and focused (e.g. `api: add image upload`, `libs: refactor pipeline utils`), and reference issues when relevant.
- PRs must describe the change, mention infra/migration impact, and include clear test instructions.
- Never commit large model files under `models/` or any real `.env`; only `*.env.example` and small text metadata are allowed.
- Never add business logic or data to `third_party/`; wrap upstream code in adapters under `libs/` instead.
