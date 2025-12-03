# Z-Image API 说明

本文档描述当前 Z-Image 后端 HTTP API（基于 FastAPI），包括主要业务接口和鉴权方式。

- 基础 URL：默认 `http://localhost:8000`
- 版本前缀：业务接口统一挂在 `/v1` 下
- 静态图片访问：`/generated-images/{relative_path}`

---

## 1. 鉴权与环境变量

相关环境变量（配置在 `apps/api/.env` 中）：

- `API_ENABLE_AUTH`：是否启用 API Key 鉴权（`true`/`false`）；
- `API_ADMIN_KEY`：管理员 Key，拥有所有权限；
- `API_ALLOWED_KEYS`：普通调用方白名单，逗号分隔（可选）；
- `DATABASE_URL` / `REDIS_URL`：数据库与 Redis 连接串。

请求时通过 Header 传入：

```http
X-Auth-Key: <your-api-key>
```

行为说明：

- `API_ENABLE_AUTH=true`：
  - 所有受保护接口必须携带有效的 `X-Auth-Key`；
  - 管理员 Key（等于 `API_ADMIN_KEY`）可以访问所有历史批次和任务；
  - 如果设置了 `API_ALLOWED_KEYS`，普通 Key 必须出现在该名单中才有效；
  - 非管理员 Key 只能访问自己创建的批次 / 图片记录。
- `API_ENABLE_AUTH=false`：
  - 请求可以不带 `X-Auth-Key`；
  - 历史接口可返回全局最近批次，仅用于开发预览环境。

---

## 2. 系统与健康检查

### 2.1 `GET /`

简单返回 API 运行状态。

- 响应示例：

```json
{
  "message": "Z-Image API is running"
}
```

### 2.2 `GET /health`

健康检查接口，可用于监控和容器探活。

- 响应示例：

```json
{
  "status": "ok",
  "environment": "dev"
}
```

---

## 3. 图片生成

### 3.1 创建生成任务 `POST /v1/images/generate`

请求体（`application/json`），对应 `GenerateImageRequest`：

```json
{
  "prompt": "a cat sitting on the chair",        // 必填
  "height": 1024,                                // 可选，默认 1024
  "width": 1024,                                 // 可选，默认 1024
  "num_inference_steps": 9,                      // 可选，默认 9
  "guidance_scale": 0.0,                         // 可选，默认 0.0
  "seed": 42,                                    // 可选，null 或省略表示随机
  "negative_prompt": "",                         // 可选，默认空字符串
  "cfg_normalization": null,                     // 可选
  "cfg_truncation": null,                        // 可选
  "max_sequence_length": null,                   // 可选
  "metadata": {                                  // 可选，推荐在批量生成时使用
    "batch_id": "uuid-string-of-batch",
    "batch_index": 0,
    "batch_size": 4
  }
}
```

> 批量生成建议：前端为同一批次中的每张图片复用同一个 `batch_id`，并设置不同的 `batch_index`（0,1,2,3…）和一致的 `batch_size`。后端会按批次聚合统计并在 `/v1/history` 中返回“已完成 X / N”。

响应体（`GenerateImageResponse`）：

```json
{
  "task_id": "b0e4aaf0bfa7421b9cb94c624c7fd139",
  "status_url": "/v1/tasks/b0e4aaf0bfa7421b9cb94c624c7fd139",
  "image_url": null
}
```

字段说明：

- `task_id`：Celery 任务 ID，可用于轮询状态；
- `status_url`：方便前端直接调用 `/v1/tasks/{task_id}`；
- `image_url`：任务刚创建时为 `null`，任务完成后会出现在状态接口中。

---

### 3.2 查询任务状态 `GET /v1/tasks/{task_id}`

响应体对应 `TaskStatusResponse`：

```json
{
  "task_id": "b0e4aaf0bfa7421b9cb94c624c7fd139",
  "status": "SUCCESS",
  "result": {
    "image_id": "…",
    "prompt": "a cat sitting on the chair",
    "height": 1024,
    "width": 1024,
    "num_inference_steps": 9,
    "guidance_scale": 0.0,
    "seed": 42,
    "negative_prompt": "",
    "cfg_normalization": null,
    "cfg_truncation": null,
    "max_sequence_length": null,
    "created_at": "2025-01-01T12:00:00.000000+00:00",
    "auth_key": "client-key-1",
    "metadata": {
      "batch_id": "…",
      "batch_index": 0,
      "batch_size": 4
    },
    "output_path": ".../outputs/z-image-outputs/20250101/120000_xxx.png",
    "relative_path": "20250101/120000_xxx.png",
    "preview_output_path": ".../outputs/z-image-outputs/20250101/120000_xxx.webp",
    "preview_relative_path": "20250101/120000_xxx.webp"
  },
  "error": null,
  "error_code": null,
  "error_hint": null,
  "image_url": "/generated-images/20250101/120000_xxx.webp",
  "progress": 100
}
```

状态说明：

- `status` 可能值：`"PENDING" | "STARTED" | "PROGRESS" | "SUCCESS" | "FAILURE" | "RETRY" | "REVOKED"`；
- 当 `status="PROGRESS"` 时，`progress` 字段为 0–100 的整数；
- 当 `status="SUCCESS"`：
  - `result` 包含完整生成结果；
  - `image_url` 为可直接访问的预览 URL（通常使用 WebP）；
- 当 `status="FAILURE"` 或 `status="REVOKED"`：
  - `error` / `error_code` / `error_hint` 给出用户可读的错误信息。

---

### 3.3 取消任务 `POST /v1/tasks/{task_id}/cancel`

用于取消正在运行的任务。

- 成功情况下响应体（`CancelTaskResponse`）：

```json
{
  "task_id": "b0e4aaf0bfa7421b9cb94c624c7fd139",
  "status": "CANCELLED",
  "message": "Cancellation requested"
}
```

如果任务已经处于终止状态（`SUCCESS` / `FAILURE` / `REVOKED`），接口会返回对应状态并带有提示信息。

---

## 4. 历史记录（按批次）

从数据库的角度，历史记录按“批次”存储和展示：一次点击生成 = 一个批次，可以包含多张图片。下面接口均依赖 PostgreSQL 中的 `image_generation_batches` / `image_generation_tasks` 表。

### 4.1 批次列表 `GET /v1/history`

查询当前调用方最近的生成批次，返回 `TaskSummary[]`：

```http
GET /v1/history?limit=20&offset=0
X-Auth-Key: client-key-1
```

响应示例：

```json
[
  {
    "task_id": "0d6b3b3b-0b4b-4c87-8d46-6b1e7e6f7f1a",   // 实际为 batch_id
    "status": "SUCCESS",                               // SUCCESS / FAILURE / PENDING（三态映射）
    "created_at": "2025-01-01T12:00:00.000000+00:00",
    "prompt": "a cat sitting on the chair",
    "height": 1024,
    "width": 1024,
    "relative_path": "20250101/120000_xxx.png",
    "image_url": "/generated-images/20250101/120000_xxx.webp",
    "num_inference_steps": 9,
    "guidance_scale": 0.0,
    "seed": 42,
    "batch_size": 4,
    "success_count": 4,
    "failed_count": 0,
    "base_seed": 42
  }
]
```

字段说明：

- `task_id`：为兼容前端类型命名，实际是 **批次 ID（batch_id）**；
- `status`：将内部批次状态映射为三类：
  - `success` / `partial` → `"SUCCESS"`；
  - `error` / `cancelled` → `"FAILURE"`；
  - `pending` / `running` → `"PENDING"`；
- `batch_size`：该批次计划生成的图片数量；
- `success_count` / `failed_count`：已成功 / 失败的图片数量；
- `image_url`：该批次第一张成功图片的预览 URL，用于历史列表缩略图；
- 其他字段为批次公共参数。

鉴权行为：

- 管理员：返回所有客户端的批次；
- 普通 Key：仅返回该 Key 对应的批次；
- 鉴权关闭且无 Key：返回全局批次（仅开发环境使用）。

---

### 4.2 批次详情 `GET /v1/history/{batch_id}`

获取某个批次的完整信息及其所有图片。

```http
GET /v1/history/{batch_id}
X-Auth-Key: client-key-1
```

响应体为 `BatchDetail`：

```json
{
  "batch": {
    "task_id": "0d6b3b3b-0b4b-4c87-8d46-6b1e7e6f7f1a",
    "status": "SUCCESS",
    "created_at": "2025-01-01T12:00:00.000000+00:00",
    "prompt": "a cat sitting on the chair",
    "height": 1024,
    "width": 1024,
    "image_url": "/generated-images/20250101/120000_xxx.webp",
    "num_inference_steps": 9,
    "guidance_scale": 0.0,
    "seed": 42,
    "batch_size": 4,
    "success_count": 4,
    "failed_count": 0,
    "base_seed": 42
  },
  "items": [
    {
      "task_id": "b0e4aaf0bfa7421b9cb94c624c7fd139",
      "index": 0,
      "status": "success",
      "image_url": "/generated-images/20250101/120000_xxx.webp",
      "width": 1024,
      "height": 1024,
      "seed": 42,
      "error_code": null,
      "error_hint": null
    },
    {
      "task_id": "…",
      "index": 1,
      "status": "success",
      "image_url": "/generated-images/20250101/120001_xxx.webp",
      "width": 1024,
      "height": 1024,
      "seed": 43
    }
  ]
}
```

注意：`items[*].status` 使用内部小写状态：`pending` / `running` / `success` / `error` / `cancelled`，方便前端更细粒度地展示每一张图片的状态。

访问控制与 `/v1/history` 类似：非管理员只能访问自己 Key 创建的批次。

---

### 4.3 删除批次 `DELETE /v1/history/{batch_id}`

删除一整个历史批次（及其所有图片元数据）。

```http
DELETE /v1/history/{batch_id}
X-Auth-Key: client-key-1
```

响应体（`DeleteTaskResponse`）：

```json
{
  "task_id": "0d6b3b3b-0b4b-4c87-8d46-6b1e7e6f7f1a",
  "status": "deleted",
  "message": "Batch deleted from history"
}
```

行为说明：

- 仅删除 PostgreSQL 中的批次与图片元数据（`image_generation_batches` / `image_generation_tasks`）；
- 不会删除磁盘上的图片文件，也不会清理 Celery Result backend；
- 管理员可以删除任意批次；
- 普通 Key 只能删除自己创建的批次；
- 若批次不存在或不属于当前调用方，返回 `404`。*** End Patch***} ნიშვნელassistant to=functions.apply_patch】!【commentary to=functions.apply_patch гилыassistant to=functions.apply_patch ***!
