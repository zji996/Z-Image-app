from pathlib import Path

from dotenv import load_dotenv

APP_ROOT = Path(__file__).resolve().parent

REPO_ROOT = APP_ROOT.parents[1]
root_env_file = REPO_ROOT / ".env"
if root_env_file.exists():
    load_dotenv(root_env_file, override=False)

env_file = APP_ROOT / ".env"
if env_file.exists():
    load_dotenv(env_file, override=False)

from libs.py_core.celery_app import celery_app


if __name__ == "__main__":
    # Entry point for running a Celery worker via:
    # uv run python -m apps.worker.main
    # Celery 5.x expects the `worker` sub-command in argv.
    celery_app.worker_main(argv=["worker", "-l", "info"])
