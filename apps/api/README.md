# Z-Image API (FastAPI)

FastAPI 后端服务，提供 Z-Image 的 HTTP API。

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

健康检查：`GET /health`。

