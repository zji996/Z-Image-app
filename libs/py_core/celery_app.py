from celery import Celery

from .config import get_settings


settings = get_settings()

celery_app = Celery("z_image")
celery_app.conf.broker_url = settings.redis_url
celery_app.conf.result_backend = settings.redis_url

