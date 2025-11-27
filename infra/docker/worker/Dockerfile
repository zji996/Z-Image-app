FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    MODELS_DIR=/models

WORKDIR /app

COPY apps/worker /app/apps/worker
COPY libs /app/libs

CMD ["uv", "run", "python", "-m", "apps.worker.main"]

