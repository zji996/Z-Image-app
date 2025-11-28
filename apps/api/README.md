# Z-Image API (FastAPI)

FastAPI 后端服务，提供 Z-Image 的 HTTP API（排队生成图片）。

## 本地运行（示例）

1. 启动本地依赖（Postgres / Redis）：

```bash
scripts/dev_up.sh
```

2. 在 `apps/api` 创建并编辑 `.env`（参考 `.env.example`）。

3. 使用 `uv` 启动开发服务器（也可以使用 Python 虚拟环境）：

```bash
cd apps/api
uv run uvicorn apps.api.main:app --reload --host 0.0.0.0 --port 8000
```

### 主要接口

- 健康检查：`GET /health`
- 提交生成任务：`POST /v1/images/generate`
  - 请求体：`{ "prompt": "...", "height": 1024, "width": 1024, "num_inference_steps": 9, "guidance_scale": 0.0, "seed": 42 }`
  - 返回：`{ "task_id": "<celery_task_id>" }`
- 查询任务状态：`GET /v1/tasks/{task_id}`
  - 返回任务状态（`PENDING`/`STARTED`/`SUCCESS`/`FAILURE`）以及生成结果元数据。
- 静态图片访问：`GET /generated-images/<date>/<filename>.png`
  - 生成任务会把图片保存到 `MODELS_DIR/z-image-outputs` 下，并通过该静态路径暴露。
