# Z-Image-app Quick Start

本指南帮助你在本地快速跑通 Z-Image-app 的 API + Worker + 前端，完成基础开发环境搭建。

---

## 1. 前置依赖

- Python 环境：使用 uv（推荐）
- Docker：用于启动 PostgreSQL 17 + Redis 7（可选，若你只跑本地 dev 模式也建议启动）

在 Z-Image-app 仓库根目录下：

```bash
# 启动本地 DB / Redis（可选但推荐）
docker compose -f infra/docker-compose.dev.yml up -d

# 安装依赖（API + Worker）
uv sync --project apps/api
uv sync --project apps/worker
```

---

## 2. 下载 DF11 模型权重

项目默认使用 DF11 压缩版的 Z-Image-Turbo 模型，并从 ModelScope 自动下载：

```bash
cd <repo_root>

# 使用 apps/api 的环境统一下载 DF11 模型
bash scripts/download_models.sh \
  --model z_image_turbo_df11 \
  --source modelscope \
  --non-interactive
```

下载完成后，模型会存在：

```text
models/z-image-turbo-df11/
  ├─ scheduler/
  ├─ vae/
  ├─ tokenizer/
  ├─ text_encoder/
  └─ transformer/
```

> 提示：`scripts/dev_worker.sh` / `scripts/dev_all.sh` 在首次启动时也会自动检查并尝试下载缺失的 DF11 模型。

---

## 3. 启动开发服务（API / Worker / Web）

在仓库根目录执行：

```bash
# 启动 API + Web + Worker（推荐）
bash scripts/dev_all.sh

# 或者只启动 API
bash scripts/dev_api.sh

# 只启动 Worker
bash scripts/dev_worker.sh
```

默认 API 监听在 `http://localhost:8000`。

前端（apps/web）也会通过 `scripts/dev_all.sh` 启动，如果你想单独在 web 目录下操作：

```bash
cd apps/web

# 安装前端依赖（推荐 pnpm，也可使用 npm）
pnpm install

# 启动本地前端开发服务器
pnpm dev
```

前端默认运行在 `http://localhost:5173`（Vite 默认端口），页面内部会调用后端的 `http://localhost:8000` API。
