from celery import Celery

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
