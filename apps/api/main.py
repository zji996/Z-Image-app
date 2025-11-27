from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI

from libs.py_core.config import get_settings


APP_ROOT = Path(__file__).resolve().parent

# Load app-specific .env into process environment (if present)
env_file = APP_ROOT / ".env"
if env_file.exists():
    load_dotenv(env_file, override=False)

settings = get_settings()

app = FastAPI(title="Z-Image API")


@app.get("/health")
async def health() -> dict[str, str]:
    """
    Basic health check endpoint.
    """
    return {
        "status": "ok",
        "environment": settings.environment,
    }


@app.get("/")
async def root() -> dict[str, str]:
    return {"message": "Z-Image API is running"}

