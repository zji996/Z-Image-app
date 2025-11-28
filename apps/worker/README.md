# Z-Image Worker (Celery)

Celery 异步任务 Worker。

## 本地运行（示例）

1. 启动本地 Redis（和 Postgres）：

```bash
scripts/dev_deps_up.sh  # legacy: scripts/dev_infra_up.sh / scripts/dev_up.sh
```

2. 在 `apps/worker` 创建 `.env`（参考 `.env.example`）。

3. 使用 `uv` 启动 Celery worker：

```bash
cd apps/worker
uv run python -m apps.worker.main
```

也可以直接通过 `celery` CLI 使用 `libs.py_core.celery_app:celery_app`。

### 多 GPU / 多 Worker 说明

- Worker 内部会调用 `libs.py_core.z_image_pipeline.get_zimage_pipeline`，并根据环境变量 `Z_IMAGE_DEVICE` 选择设备。
- 推荐每块 GPU 启动一个独立的 Celery worker，且并发为 1（已在代码中默认配置）。
- 在当前机器有两张显卡时，可以类似这样启动两个 worker：

```bash
# 使用 GPU 0
GPU_ID=0 scripts/dev_worker.sh

# 使用 GPU 1（另一个终端）
GPU_ID=1 scripts/dev_worker.sh
```

两台 worker 共享同一个 Redis broker / backend，会自动负载均衡处理 API 提交的生成任务。
