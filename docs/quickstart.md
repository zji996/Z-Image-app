# Z-Image-app Quick Start

本指南帮助你在本地快速跑通 Z-Image-app 的 API + Worker + 前端，并通过 HTTP 请求生成图片。

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

## 3. 配置 API Key（强烈推荐在线环境启用）

在 `apps/api/.env` 中配置鉴权相关环境变量（文件不应提交到 Git）：

```env
ENVIRONMENT=dev
DATABASE_URL=postgresql+psycopg://z_image:z_image@localhost:5432/z_image
REDIS_URL=redis://localhost:6379/0

# 启用 API Key 鉴权（本地可按需启用，线上推荐开启）
API_ENABLE_AUTH=true

# 管理员 Key（拥有所有权限）
API_ADMIN_KEY=your-admin-key

# 普通调用方白名单（逗号分隔）
API_ALLOWED_KEYS=client-key-1,client-key-2

# 使用 Turbo 变体 + DF11 模式
Z_IMAGE_VARIANT=turbo
```

前端或调用方在请求时通过 Header 传入：

```http
X-Auth-Key: client-key-1
```

当 `API_ENABLE_AUTH=true` 时：

- 所有受保护的接口（生成任务、查询任务、历史记录）都必须携带有效的 `X-Auth-Key`；
- 使用 `API_ADMIN_KEY` 的调用方可以访问所有任务和图片；
- 使用 `API_ALLOWED_KEYS` 中普通 Key 的调用方只能访问自己创建的任务和图片。

当 `API_ENABLE_AUTH=false` 时（本地调试）：

- 调用接口可以不带 `X-Auth-Key`；
- 历史接口会返回全局最近任务，仅用于开发预览，不建议在线上使用。

---

## 4. 启动开发服务（API / Worker / Web）

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

---

## 5. 调用 API 生成图片（基于 HTTP）

### 5.1 创建生成任务

```bash
curl -X POST "http://localhost:8000/v1/images/generate" \
  -H "Content-Type: application/json" \
  -H "X-Auth-Key: client-key-1" \
  -d '{
    "prompt": "a cat sitting on the chair",
    "height": 1024,
    "width": 1024,
    "num_inference_steps": 9,
    "guidance_scale": 0.0,
    "seed": 42,
    "negative_prompt": "",
    "metadata": {
      "client_id": "curl-demo"
    }
```

> 提示：如果没有特别需求，可以直接省略或留空 `negative_prompt`，系统会自动使用空字符串。

返回示例：

```json
{
  "task_id": "b0e4aaf0bfa7421b9cb94c624c7fd139",
  "status_url": "/v1/tasks/b0e4aaf0bfa7421b9cb94c624c7fd139",
  "image_url": null
}
```

记住 `task_id` 或 `status_url`，用于后续查询。

### 5.2 轮询任务状态

```bash
curl -X GET "http://localhost:8000/v1/tasks/b0e4aaf0bfa7421b9cb94c624c7fd139" \
  -H "X-Auth-Key: client-key-1"
```

当返回：

```json
{
  "task_id": "...",
  "status": "SUCCESS",
  "result": {
    "relative_path": "20250101/120000_b0e4....png",
    "preview_relative_path": "20250101/120000_b0e4....webp",
    "output_path": ".../outputs/z-image-outputs/20250101/120000_b0e4....png",
    "preview_output_path": ".../outputs/z-image-outputs/20250101/120000_b0e4....webp",
    "..."
  },
  "error": null,
  "image_url": "/generated-images/20250101/120000_b0e4....webp"
}
```

说明图片已生成成功，可以使用 `image_url` 访问**预览图**（WebP）：

```text
http://localhost:8000/generated-images/20250101/120000_b0e4....webp
```

---

## 6. 查看历史记录（按 API Key 分组）

你也可以基于 API Key 查看最近的生成任务历史：

```bash
curl -X GET "http://localhost:8000/v1/history?limit=20&offset=0" \
  -H "X-Auth-Key: client-key-1"
```

返回示例：

```json
[
  {
    "task_id": "b0e4aaf0bfa7421b9cb94c624c7fd139",
    "status": "SUCCESS",
    "created_at": "2025-01-01T12:00:00.000000+00:00",
    "prompt": "a cat sitting on the chair",
    "height": 1024,
    "width": 1024,
    "relative_path": "20250101/120000_b0e4....png",
    "image_url": "/generated-images/20250101/120000_b0e4....webp"
  }
]
```

行为说明：

- 使用普通 Key（在 `API_ALLOWED_KEYS` 中）：仅返回该 Key 创建的任务；
- 使用管理员 Key（`API_ADMIN_KEY`）：返回所有调用方的最近任务；
- 关闭鉴权时（`API_ENABLE_AUTH=false` 且不带 Key）：返回全局最近任务，仅用于本地预览。

前端可以直接用 `image_url` 渲染 WebP 缩略图或原图；如需下载无损 PNG，可将 `.webp`
后缀替换为 `.png`，或使用 `result.relative_path` 手动构造下载地址。
