# Z-Image Worker (Celery)

Celery 异步任务 Worker。

## 本地运行（示例）

1. 启动本地 Redis（和 Postgres）：

```bash
scripts/dev_up.sh
```

2. 在 `apps/worker` 创建 `.env`（参考 `.env.example`）。

3. 使用 `uv` 启动 Celery worker：

```bash
cd apps/worker
uv run python -m apps.worker.main
```

也可以直接通过 `celery` CLI 使用 `libs.py_core.celery_app:celery_app`。

