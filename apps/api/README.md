# Z-Image API (FastAPI)

FastAPI 后端服务，提供 Z-Image 的 HTTP API（排队生成图片）。

## 本地运行（示例）

1. 启动本地依赖（Postgres / Redis）：

```bash
scripts/dev_deps_up.sh  # legacy: scripts/dev_infra_up.sh / scripts/dev_up.sh
```

2. 推荐在仓库根目录创建并编辑 `.env`（参考 `.env.example`）；也可以继续使用 `apps/api/.env`（参考 `apps/api/.env.example`）。

3. 使用 `uv` 启动开发服务器（在仓库根目录执行）：

```bash
uv run --project apps/api uvicorn apps.api.main:app --reload --host 0.0.0.0 --port 8000
```

### 主要接口

- 健康检查：`GET /health`
- 提交生成任务：`POST /v1/images/generate`
  - 请求体：`{ "prompt": "...", "height": 1024, "width": 1024, "num_inference_steps": 9, "guidance_scale": 0.0, "seed": 42 }`
  - 返回：`{ "task_id": "<celery_task_id>" }`
- 查询任务状态：`GET /v1/tasks/{task_id}`
  - 返回任务状态（`PENDING`/`STARTED`/`SUCCESS`/`FAILURE`）以及生成结果元数据。
- 静态图片访问：`GET /generated-images/<date>/<filename>.png`
  - 默认情况下（`Z_IMAGE_STORAGE_BACKEND=local`），生成任务会把图片保存到仓库根目录下的 `outputs/z-image-outputs` 中（可通过 `Z_IMAGE_OUTPUT_DIR` 自定义），并通过该静态路径暴露。
  - 当 `Z_IMAGE_STORAGE_BACKEND=s3` 时，图片会写入 S3/MinIO（由 `S3_*` 环境变量配置），API 会通过同一路径 `/generated-images/...` 进行读取转发（并对历史本地文件做兼容回退）。
