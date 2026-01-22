from functools import lru_cache
from pathlib import Path

from pydantic import Field
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

    models_dir: Path = Field(default=DEFAULT_MODELS_DIR, validation_alias="MODELS_DIR")
    outputs_dir: Path = Field(default=DEFAULT_OUTPUTS_DIR, validation_alias="Z_IMAGE_OUTPUT_DIR")

    # Storage backend for generated images.
    # - "local": store under outputs_dir (legacy/default)
    # - "s3": store in S3-compatible object storage (MinIO/AWS S3)
    z_image_storage_backend: str = Field(default="local", validation_alias="Z_IMAGE_STORAGE_BACKEND")

    # S3 / MinIO configuration (used when Z_IMAGE_STORAGE_BACKEND=s3).
    s3_endpoint: str | None = Field(default=None, validation_alias="S3_ENDPOINT")
    s3_access_key: str | None = Field(default=None, validation_alias="S3_ACCESS_KEY")
    s3_secret_key: str | None = Field(default=None, validation_alias="S3_SECRET_KEY")
    s3_bucket_name: str | None = Field(default=None, validation_alias="S3_BUCKET_NAME")
    s3_region: str = Field(default="us-east-1", validation_alias="S3_REGION")
    s3_prefix: str = Field(default="z-image-outputs", validation_alias="S3_PREFIX")
    s3_presign_expiry_seconds: int = Field(default=3600, validation_alias="S3_PRESIGN_EXPIRY_SECONDS")

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


def is_s3_storage_enabled() -> bool:
    """
    Returns True when Z-Image is configured to store generated images in S3.
    """

    settings = get_settings()
    return settings.z_image_storage_backend.strip().lower() == "s3"
