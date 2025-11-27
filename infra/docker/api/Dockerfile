FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    MODELS_DIR=/models

WORKDIR /app

# Install runtime dependencies here (uv / pip etc.) as needed.
# This Dockerfile is a minimal placeholder and may be extended.

COPY apps/api /app/apps/api
COPY libs /app/libs

EXPOSE 8000

CMD ["uv", "run", "uvicorn", "apps.api.main:app", "--host", "0.0.0.0", "--port", "8000"]

