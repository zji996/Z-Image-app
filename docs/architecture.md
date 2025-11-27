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

## 基础设施

- `infra/docker-compose.dev.yml`：本地开发用 PostgreSQL 17 + Redis 7。
- `infra/docker/`：各 app 的 Dockerfile（目前为占位模板）。
- `infra/k8s/`：K8s 配置占位。
- `infra/terraform/`：基础设施 IaC 占位。

## 开发脚本

- `scripts/dev_up.sh` / `scripts/dev_down.sh`：本地依赖（DB / Redis）启动与停止。
- `scripts/dev_api.sh`：本地启动 FastAPI（基于 `uv`）。
- `scripts/dev_worker.sh`：本地启动 Celery worker。
- `scripts/dev_web.sh`：本地启动前端 Vite 开发服务器。
- `scripts/download_models.py`：统一的模型下载 / 更新入口（目前为占位实现）。

详细规范和对 Agent 的约束见 `docs/Agents.md`。

