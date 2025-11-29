from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from libs.py_core.config import get_output_root

from apps.api.routes import images, system


APP_ROOT = Path(__file__).resolve().parent

env_file = APP_ROOT / ".env"
if env_file.exists():
    load_dotenv(env_file, override=False)


app = FastAPI(title="Z-Image API")


# Expose generated images via a static mount so that the API can
# return simple relative URLs (e.g. /generated-images/20250101/xxx.png).
output_root = get_output_root()
app.mount("/generated-images", StaticFiles(directory=str(output_root)), name="generated-images")


# System / health endpoints (root scope).
app.include_router(system.router)

# Core image-generation API (versioned under /v1).
app.include_router(images.router, prefix="/v1")

