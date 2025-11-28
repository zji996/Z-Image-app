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

