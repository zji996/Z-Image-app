import os
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings


REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_MODELS_DIR = REPO_ROOT / "models"


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


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """
    Returns a cached Settings instance based on current environment variables.
    """

    return Settings()


