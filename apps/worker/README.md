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

## 可选的 FlashAttention 支持

- 默认情况下 **不会安装 `flash-attn`**，避免第一次执行 `uv sync` 就编译 CUDA 扩展、影响体验。
- Z-Image 推理代码会在运行时自动探测是否存在 FlashAttention，如果没有安装只会回退到 PyTorch/SDPA 默认实现，不影响功能。
- 如果你确认当前环境需要 FlashAttention 优化，可以显式安装可选依赖：

  ```bash
  # 在 worker 项目下启用 flash-attn，可按需运行：
  uv sync --project apps/worker --extra flash-attn

  # 或者手动添加依赖：
  uv add "flash-attn>=2.8.3" --project apps/worker
  ```

- 运行时可以通过环境变量控制注意力实现，例如：

  ```bash
  # 强制关闭 FlashAttention
  Z_IMAGE_ATTN_IMPL=none

  # 如果已安装 flash-attn，可以显式指定：
  Z_IMAGE_ATTN_IMPL=flash_attention_2
  ```
