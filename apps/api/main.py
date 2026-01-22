from pathlib import Path
from typing import cast

from dotenv import load_dotenv


# Load the app-local .env before importing anything that relies on
# environment-driven settings (e.g. get_settings / get_output_root).
APP_ROOT = Path(__file__).resolve().parent
REPO_ROOT = APP_ROOT.parents[1]

root_env_file = REPO_ROOT / ".env"
if root_env_file.exists():
    load_dotenv(root_env_file, override=False)

env_file = APP_ROOT / ".env"
if env_file.exists():
    load_dotenv(env_file, override=False)

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles

from libs.py_core.config import get_output_root, get_settings, is_s3_storage_enabled
from libs.py_core.storage import S3Storage, get_storage
from apps.api.routes import images, system


app = FastAPI(title="Z-Image API")


if is_s3_storage_enabled():
    storage = cast(S3Storage, get_storage())
    output_root = get_settings().outputs_dir.resolve()

    @app.get("/generated-images/{relative_path:path}")
    def get_generated_image(relative_path: str):
        # Smooth transition: when S3 is enabled but some historical files are still
        # on disk, we fall back to the legacy local outputs folder.
        try:
            obj = storage.get_object(relative_path=relative_path)
        except FileNotFoundError:
            local_path = (output_root / relative_path.lstrip("/")).resolve()
            if local_path.is_file():
                return FileResponse(path=str(local_path))
            raise HTTPException(status_code=404, detail="Image not found")

        media_type = obj.content_type or "application/octet-stream"
        return StreamingResponse(obj.iter_chunks(), media_type=media_type)
else:
    # Expose generated images via a static mount so that the API can
    # return simple relative URLs (e.g. /generated-images/20250101/xxx.png).
    output_root = get_output_root()
    app.mount("/generated-images", StaticFiles(directory=str(output_root)), name="generated-images")


# System / health endpoints (root scope).
app.include_router(system.router)

# Core image-generation API (versioned under /v1).
app.include_router(images.router, prefix="/v1")
