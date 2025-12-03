# 数据库设计与迁移说明

本节文档描述 Z-Image-app 当前使用的 PostgreSQL 表结构，以及如何在本地或线上环境中初始化 / 迁移数据库。

---

## 1. 总体结构

后端使用 PostgreSQL 存储生成任务相关的结构化元数据，主要表包括：

- `api_clients`：API 调用方（前端、第三方应用等）的注册信息；
- `image_generation_batches`：按“批次”记录一次点击生成（可能包含多张图片）；
- `image_generation_tasks`：按“图片”记录一张生成结果，对应一个 Celery task。

Redis 仍用于任务队列、Celery result backend 等短期数据，但历史记录和批次元数据全部进入 PostgreSQL。

---

## 2. 表结构

### 2.1 `api_clients`

用于把 `X-Auth-Key` 映射到一个稳定的客户端 ID，并避免在数据库中保存明文 API key。

- `id TEXT PRIMARY KEY`：逻辑 ID，如 `admin`、`key_ab12cd34`；
- `display_name TEXT NOT NULL`：展示名称，如 `Admin`、`API Key ab12cd34`；
- `role TEXT NOT NULL`：客户端角色，典型值：
  - `admin`：管理员 key，可访问所有历史；
  - `first_party`：本产品自己的前端 / 内部服务；
  - `third_party`：外部集成方；
- `api_key_hash TEXT NOT NULL`：`X-Auth-Key` 的 SHA-256 哈希；
- `is_active BOOLEAN NOT NULL DEFAULT TRUE`：是否启用；
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`；
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`。

索引：

- `idx_api_clients_key_hash (api_key_hash)`：避免重复插入同一 key。

> 说明：当前实现会在第一次收到某个 key 时自动插入一条记录：  
> - 如果 key 等于 `API_ADMIN_KEY` → `id="admin"`，`role="admin"`；  
> - 其他 key → `id="key_<hash前8位>"`，`role="first_party"`。

---

### 2.2 `image_generation_batches`

一行表示一次“点击生成”的批次，通常包含 1~N 张图片。

- `id UUID PRIMARY KEY`：批次 ID，优先使用前端传入的 `metadata.batch_id`；
- `api_client_id TEXT REFERENCES api_clients(id)`：触发该批次的客户端；
- `caller_label TEXT`：预留字段，可用于记录 user_id 等；
- 公共参数：
  - `prompt TEXT NOT NULL`；
  - `negative_prompt TEXT`；
  - `width INTEGER NOT NULL`；
  - `height INTEGER NOT NULL`；
  - `num_inference_steps INTEGER NOT NULL`；
  - `guidance_scale DOUBLE PRECISION NOT NULL`；
  - `base_seed BIGINT`：推导出的“基准 seed”（通常为 index=0 那张）；
  - `batch_size INTEGER NOT NULL`：批次内计划生成的图片数量；
- 聚合状态：
  - `status TEXT NOT NULL DEFAULT 'pending'`：内部状态，取值：
    - `pending` / `running` / `success` / `partial` / `error` / `cancelled`；
  - `success_count INTEGER NOT NULL DEFAULT 0`；
  - `failed_count INTEGER NOT NULL DEFAULT 0`；
- 时间：
  - `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`；
  - `completed_at TIMESTAMPTZ`；
- `metadata JSONB`：额外参数（模型版本、设备信息等），前后端协商使用。

索引：

- `idx_image_generation_batches_client_created (api_client_id, created_at DESC)`：按客户端浏览最近批次。

> `/v1/history` 现在按 **批次** 返回历史，一行对应 `image_generation_batches` 中的一行，`success_count / batch_size` 可直接用于前端展示“已完成 X / N”。

---

### 2.3 `image_generation_tasks`

一行表示一张生成的图片（对应一个 Celery 任务）。

- `task_id TEXT PRIMARY KEY`：Celery task id；
- `batch_id UUID NOT NULL REFERENCES image_generation_batches(id) ON DELETE CASCADE`；
- `batch_index INTEGER NOT NULL`：在批次中的下标（0, 1, 2, …）；
- `seed BIGINT`：实际使用的随机种子；
- 状态：
  - `status TEXT NOT NULL`：`pending` / `running` / `success` / `error` / `cancelled`；
  - `error_code TEXT`；
  - `error_hint TEXT`；
  - `error_message TEXT`；
- 参数：
  - `prompt TEXT NOT NULL`；
  - `negative_prompt TEXT`；
  - `width INTEGER NOT NULL`；
  - `height INTEGER NOT NULL`；
  - `num_inference_steps INTEGER NOT NULL`；
  - `guidance_scale DOUBLE PRECISION NOT NULL`；
  - `cfg_normalization BOOLEAN`；
  - `cfg_truncation DOUBLE PRECISION`；
  - `max_sequence_length INTEGER`；
- 时间：
  - `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`；
  - `finished_at TIMESTAMPTZ`；
- 路径：
  - `image_id TEXT`；
  - `output_path TEXT`；
  - `preview_path TEXT`；
  - `relative_path TEXT`；
  - `preview_relative_path TEXT`；
- `metadata JSONB`：来自 worker 的原始元数据。

索引：

- `idx_image_generation_tasks_batch (batch_id, batch_index)`：按批次取全部图片；
- `idx_image_generation_tasks_status (status)`：按状态统计。

> Worker 侧在任务开始、成功、失败时分别调用 `libs.py_core.db` 中的辅助函数来维护这两张表和聚合状态。

---

## 3. 数据库迁移

### 3.1 启动本地 PostgreSQL

仓库自带开发用 Docker Compose：

```bash
docker compose -f infra/docker-compose.dev.yml up -d postgres
```

默认配置：

- 数据库：`z_image`
- 用户名 / 密码：`z_image` / `z_image`
- 端口映射：`5432:5432`

### 3.2 执行迁移脚本

使用宿主机上的 `psql`：

```bash
PGPASSWORD=z_image psql \
  -h localhost -p 5432 \
  -U z_image -d z_image \
  -f scripts/sql/001_init_image_db.sql
```

该脚本只包含 `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS`，运行多次也是安全的。

执行成功后，新的生成任务会自动将批次 / 图片元数据写入上述三张表，API 的 `/v1/history` 与 `/v1/history/{batch_id}` 也会基于这些表返回结果。*** End Patch***}Eassistant to=functions.apply_patch איבערassistant to=functions.apply_patch:-------------</commentary to=functions.apply_patch ательнойassistant to=functions.apply_patch +#+#+#+#+#+assistant to=functions.apply_patchствиемassistant to=functions.apply_patch ?>>
