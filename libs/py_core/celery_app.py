import os

from celery import Celery
from celery.signals import worker_process_init

from .config import get_settings


settings = get_settings()

celery_app = Celery("z_image", include=["libs.py_core.tasks"])
celery_app.conf.broker_url = settings.redis_url
celery_app.conf.result_backend = settings.redis_url
celery_app.conf.task_serializer = "json"
celery_app.conf.result_serializer = "json"
celery_app.conf.accept_content = ["json"]
celery_app.conf.worker_concurrency = int(
    getattr(settings, "worker_concurrency", 1)  # type: ignore[arg-type]
)
celery_app.conf.task_acks_late = True


@worker_process_init.connect
def _warmup_z_image_pipeline(**kwargs):
    """
    Warm up the Z-Image pipeline once per Celery worker process so that the
    first generation task does not pay the full cold-start cost.

    Controlled via env vars:
      - Z_IMAGE_WARMUP: '0' / 'false' to disable warmup.
      - Z_IMAGE_WARMUP_THREADS: optional int, number of CPU threads for PyTorch.
    """

    flag = os.getenv("Z_IMAGE_WARMUP", "1").strip().lower()
    if flag in {"0", "false", "no"}:
        return

    try:
        from libs.py_core.z_image_pipeline import get_zimage_pipeline  # type: ignore
    except Exception:
        # If imports fail, do not block worker startup.
        return

    # Best-effort CPU multi-threading hint for the heavy init path.
    warmup_threads_raw = os.getenv("Z_IMAGE_WARMUP_THREADS")
    if warmup_threads_raw is None:
        warmup_threads = 4
    else:
        try:
            warmup_threads = int(warmup_threads_raw)
        except ValueError:
            warmup_threads = None

    if warmup_threads and warmup_threads > 0:
        try:
            import torch  # type: ignore

            torch.set_num_threads(warmup_threads)
        except Exception:
            # Ignore failures; this is only a performance hint.
            pass

    try:
        # This call is cached inside the process, so subsequent tasks reuse
        # the initialized pipeline.
        get_zimage_pipeline()
    except Exception:
        # Warmup is best-effort; avoid crashing the worker process.
        return
