# Z-Image Monorepo 架构说明

## 目录结构

```text
repo_root/
├─ apps/            # 可运行应用（api / web / worker 等）
├─ libs/            # 共享代码库（后端 py_core / 前端 ts_ui）
├─ infra/           # 部署与基础设施（Docker / K8s / Terraform）
├─ scripts/         # 开发 / 运维脚本
├─ docs/            # 文档
├─ assets/          # 静态资源 / 示例素材
├─ models/          # 模型权重（运行时数据，不入库）
└─ third_party/     # 上游仓库（Git submodule，仅参考）
```

## 已初始化应用

- `apps/api`：FastAPI 后端 API 服务。
- `apps/worker`：Celery 异步任务 Worker。
- `apps/web`：Vite + React + Tailwind 前端应用。

每个 app：

- 有独立入口（如 `main.py` / `main.tsx`）。
- 有自己的依赖声明（`pyproject.toml` / `package.json`）。
- 禁止直接 import 其他 app，只能通过 `libs/` 共享逻辑。

## 共享库

- `libs/py_core/`：后端共享逻辑（配置、Celery 初始化等）。
- `libs/ts_ui/`：前端共享组件 / hooks / 工具函数（目前仅占位）。

应用代码只允许从 `libs/` import，不允许跨 `apps/` import。

## 模型目录

- 全局模型根目录为 `models/`，默认路径 `<repo_root>/models`。
- 通过环境变量 `MODELS_DIR` 控制，所有服务使用统一变量。
- Git 中只保留 `models/README.md` 说明，不提交任何大文件。
- `scripts/download_models.py` 对 Z-Image 家族做了封装：
  - 支持从 Hugging Face / ModelScope 下载 `Z-Image-Turbo` 权重（
    Hugging Face: https://huggingface.co/Tongyi-MAI/Z-Image-Turbo ，
    ModelScope: https://modelscope.cn/models/Tongyi-MAI/Z-Image-Turbo）；
  - 将权重放在 `MODELS_DIR/z-image-turbo` 下，供后端统一使用；
  - 预留 `Z-Image-Base` / `Z-Image-Edit` 的占位配置，便于后续兼容。

### 模型变体与“角色”划分

- **Z-Image-Turbo**
  - 蒸馏版主力模型，追求在线推理的吞吐和时延（8 NFEs，子秒级延迟，16G 显存即可稳定运行）。
  - 以文本到图像（text-to-image）为主要使用方式，适合作为默认生产模型：只需要传入文本 prompt 即可生成图片。
  - 当前仓库中 `Z_IMAGE_VARIANT` 默认值为 `turbo`，API / worker 不显式配置时都会走 Turbo。

- **Z-Image-Base**
  - 未蒸馏的基础大模型，更关注能力上限和可微调性，而不是极致时延。
  - 推荐用于离线训练 / 微调、内部实验等场景，而不是直接面向用户的在线推理。
  - 本仓库中仅预留配置占位（`Z_IMAGE_VARIANT=base`），暂未在 `scripts/download_models.py` 中开放下载入口。

- **Z-Image-Edit**
  - 专门为图像编辑（image-to-image）场景微调的变体，典型用法是「原始图像 + 自然语言指令 → 新图像」。
  - 在接口设计上应与 Turbo / Base 做“角色”区分：
    - Turbo / Base：以 `prompt -> image` 的纯文本输入为主；
    - Edit：以 `image + prompt -> image` 的编辑/变换为主，需要在 API / worker 层设计支持图像输入的任务/消息格式。
  - 本仓库当前仅在 `Z_IMAGE_VARIANT=edit` 上做占位，后续接入上游 Edit checkpoint 时，可以在 `libs/py_core/z_image_pipeline.py`
    中增加专门的编辑接口（例如 `edit_image(...)`），并在 API 层分别暴露 “生成” 与 “编辑” 两类能力。

## Z-Image 对接位置

- 上游仓库通过 submodule 挂载在 `third_party/Z-Image`，仅包含报告与说明文档。
- 实际推理逻辑通过 Hugging Face diffusers 的 `ZImagePipeline` 实现。
- 后端统一通过 `libs/py_core/z_image_pipeline.py` 访问 Z-Image：
  - 外部 app 不直接依赖 `diffusers` / `torch`，而是依赖 `libs.py_core` 提供的接口。
  - 运行时使用 `MODELS_DIR` 作为权重缓存 / 本地目录，优先从
    `MODELS_DIR/z-image-<variant>` 加载，本地不存在时才回退到远端。
  - 通过环境变量控制具体变体与版本：
    - `Z_IMAGE_VARIANT`: `turbo`（默认）/ `base` / `edit`
    - `Z_IMAGE_MODEL_ID`: 覆盖默认的远端仓库 ID。

## 基础设施

- `infra/docker-compose.dev.yml`：本地开发用 PostgreSQL 17 + Redis 7。
- `infra/docker/`：各 app 的 Dockerfile（目前为占位模板）。
- `infra/k8s/`：K8s 配置占位。
- `infra/terraform/`：基础设施 IaC 占位。

## 开发脚本

- `scripts/dev_deps_up.sh` / `scripts/dev_deps_down.sh`：本地依赖（DB / Redis）启动与停止（`dev_up.sh` / `dev_down.sh` / `dev_infra_*.sh` 为兼容保留的别名）。
- `scripts/dev_api.sh`：本地启动 FastAPI（基于 `uv`）。
- `scripts/dev_worker.sh`：本地启动 Celery worker。
- `scripts/dev_web.sh`：本地启动前端 Vite 开发服务器。
- `scripts/download_models.py`：统一的模型下载 / 更新入口。
