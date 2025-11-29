from __future__ import annotations

from fastapi import APIRouter

from libs.py_core.config import get_settings


router = APIRouter(tags=["system"])

settings = get_settings()


@router.get("/health")
async def health() -> dict[str, str]:
    return {
        "status": "ok",
        "environment": settings.environment,
    }


@router.get("/")
async def root() -> dict[str, str]:
    return {"message": "Z-Image API is running"}

