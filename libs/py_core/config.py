import os
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings


REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_MODELS_DIR = REPO_ROOT / "models"
DEFAULT_OUTPUTS_DIR = REPO_ROOT / "outputs" / "z-image-outputs"


class Settings(BaseSettings):
    """
    Shared backend settings.

    Each app should load its own .env (if any) into the environment
    before calling `get_settings()`.
    """

    environment: str = "dev"

    database_url: str = "postgresql+psycopg://z_image:z_image@localhost:5432/z_image"
    redis_url: str = "redis://localhost:6379/0"

    models_dir: Path = Path(os.getenv("MODELS_DIR", DEFAULT_MODELS_DIR))
    outputs_dir: Path = Path(os.getenv("Z_IMAGE_OUTPUT_DIR", DEFAULT_OUTPUTS_DIR))

    # Celery worker settings (used by apps/worker).
    # Controls the number of concurrent worker processes for a single Celery
    # worker instance. Exposed as the WORKER_CONCURRENCY environment variable.
    # NOTE: For Z-Image DF11 inference on a single GPU, the recommended default
    # is 1 to reduce VRAM pressure. Increase with care.
    worker_concurrency: int = 1

    # Simple API key auth for the HTTP layer (used by apps/api).
    # We default to enabling auth to keep semantics simple: every request
    # must provide a key, and an admin key can bypass per-user restrictions.
    # - API_ENABLE_AUTH can still be overridden via environment variables.
    # - If API_ADMIN_KEY is not set, we fall back to a default "admin" key
    #   so that local development works out of the box.
    api_enable_auth: bool = True
    api_admin_key: str | None = "admin"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """
    Returns a cached Settings instance based on current environment variables.
    """

    return Settings()


def get_output_root() -> Path:
    """
    Directory where generated images are stored.

    Defaults to `outputs/z-image-outputs` under the repo root, but can be
    overridden via the `Z_IMAGE_OUTPUT_DIR` environment variable. The directory
    is created if it does not exist.
    """

    settings = get_settings()
    output_root = settings.outputs_dir.resolve()
    output_root.mkdir(parents=True, exist_ok=True)
    return output_root
