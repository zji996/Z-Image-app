# Agents 使用规范（Monorepo 约定）

> 本文档为 Agent / 开发者约定的集中说明，自动化修改仓库时必须遵守。

## 1. 目录结构（约定）

```text
repo_root/
├─ apps/            # 可运行应用
├─ libs/            # 共享代码库
├─ infra/           # 部署与基础设施
├─ scripts/         # 开发 / 运维脚本
├─ docs/            # 文档（本文件在此目录下）
├─ assets/          # 静态资源 / 示例素材
├─ models/          # 模型权重（运行时数据）
└─ third_party/     # 上游仓库（Git submodule，仅参考）
```

## 2. apps/ 规范

- `apps/` 下每个子目录是一个独立应用（如 `api/`、`web/`、`worker/`）。
- 每个 app 必须有自己的入口文件（如 `main.py` / `main.tsx`）。
- 每个 app 必须有自己的依赖声明（如 `pyproject.toml` / `package.json`）。
- app 之间禁止直接互相 import 代码，只能通过 `libs/` 共享逻辑。
- 新功能优先放到对应 app 下的 `api/`、`routes/`、`features/` 等业务目录。

当前已存在的应用：

- `apps/api`：FastAPI 后端 API。
- `apps/worker`：Celery 异步任务。
- `apps/web`：Vite + React + Tailwind 前端。

## 3. libs/ 规范

- `libs/` 只存放可被多个 app 共享的代码。
- 后端共享逻辑建议放在 `libs/py_core/`（模型封装、推理管线、通用工具）。
- 前端共享组件建议放在 `libs/ts_ui/`（UI 组件、hooks、工具函数）。
- 应用代码只允许从 `libs/` import，不允许从其他 `apps/` 目录 import。
- 如需包装 `third_party/` 的功能，必须在 `libs/` 内写 adapter，app 只依赖 adapter。

## 4. models/ 规范（模型目录）

- 根目录 `models/` 是唯一的模型权重存储目录。
- 模型权重、缓存等大文件只能放在 `models/` 下，不得放在 `apps/` 或 `libs/` 中。
- `models/` 不提交到 Git（仅保留 `models/README.md` 说明）。
- 所有服务使用统一环境变量 `MODELS_DIR` 指定模型根目录：
  - 默认值为 `<repo_root>/models`。
  - Docker / 线上环境可将 `MODELS_DIR` 指向挂载磁盘（例如 `/models`）。
- 加载模型时必须通过 `MODELS_DIR` 计算路径，不得写死绝对路径。
- 下载 / 更新模型必须通过 `scripts/` 下的脚本（如 `scripts/download_models.py`），不得手动提交模型文件。

## 5. third_party/ 规范（submodule）

- `third_party/` 只允许存放 Git submodule，禁止直接创建普通源码目录。
- 每个子目录对应一个上游仓库子模块，例如：
  - `third_party/some_model_repo/`
  - `third_party/research_code/`
- `third_party/` 内容视为只读参考代码：
  - 不在其中添加业务逻辑。
  - 不在其中放置模型权重或运行时数据。
- 如需修改上游代码：
  - 优先在上游仓库 fork + 修改；
  - 然后更新对应 submodule 指向的 commit。
- 应用与库代码禁止直接依赖 `third_party` 路径：
  - 不允许出现 `import third_party.xxx` 这类引用。
- 需要用到其中逻辑时，在 `libs/` 中创建 adapter / wrapper，app 只依赖 `libs/`。
- 构建、测试、Lint 默认必须忽略 `third_party/`。

## 6. scripts/ 规范

- `scripts/` 只放自动化脚本，如：
  - 本地启动脚本（如 `dev_up.sh`）。
  - 数据库迁移脚本。
  - 模型下载脚本（如 `download_models.py`）。
- 脚本应是幂等的，多次执行不会破坏环境。
- 脚本不得实现业务逻辑，业务逻辑必须在 `apps/` 或 `libs/` 内。

## 7. infra/ 规范

- `infra/` 存放部署相关文件，如：
  - `infra/docker/`：各 app 的 Dockerfile。
  - `infra/k8s/`：K8s manifests 或 Helm chart。
  - `infra/terraform/`：基础设施声明。
- Dockerfile 不直接 `COPY models/`：
  - 模型通过卷挂载或运行时下载。
- `docker-compose.yml` / `docker-compose.dev.yml` 统一挂载模型目录：
  - 例如 `./models:/models`，并设置 `MODELS_DIR=/models`。

## 8. docs/ 规范

- `docs/` 存放文档：
  - `docs/architecture.md`：整体架构与目录说明。
  - `docs/Agents.md`：Agent 使用规范（包括本章节）。
  - 其他模块级文档（如 `api.md`、`deployment.md`）。
- 文档中的路径、环境变量、目录约定应与代码保持一致，并及时更新。

## 9. 针对 Agent 的特别约定

- 如需新建应用：在 `apps/` 下创建子目录，并添加入口、依赖声明、简单 README。
- 如需新增共享逻辑：优先放到 `libs/`，并为主要模块写最小文档或注释。
- 不得在 `third_party/` 中新增、修改业务代码或模型文件。
- 不得在仓库中提交 `models/` 下的大文件。
- 如不确定代码位置：
  - 与「运行逻辑」相关的改动优先放在 `apps/`。
  - 与「可复用逻辑」相关的改动优先放在 `libs/`。
  - 与「部署」相关的改动优先放在 `infra/`。
  - 与「模型权重」相关的改动只触及 `models/` 和 `scripts/`。

## 10. 本地开发环境约定

- 本地依赖服务用 `infra/docker-compose.dev.yml`。
- 启动脚本放在 `scripts/` 中。
- 配置使用 `.env` + `.env.example`，不写死到代码里。

### 10.1 Docker Compose（数据库 / 缓存）

- 本地 Postgres / Redis 等依赖统一定义在 `infra/docker-compose.dev.yml`。
- 默认本地启动命令：

```bash
docker compose -f infra/docker-compose.dev.yml up -d
```

### 10.2 启动脚本（scripts/）

- 跨服务 / 项目级脚本统一放在 `scripts/` 目录。
- 命名需体现用途与环境，例如：
  - `scripts/dev_up.sh`：本地开发整体启动。
  - `scripts/dev_down.sh`：本地开发整体停止。
  - `scripts/dev_api.sh`：只启动某个后端应用。
- 脚本只做启动与编排，不实现业务逻辑；业务逻辑必须放在 `apps/` 或 `libs/` 中。

### 10.3 环境变量与 .env

- 每个 app 使用独立的 `.env` 文件，路径为 `apps/<app_name>/.env`，不提交到 Git。
- 每个 app 必须维护 `apps/<app_name>/.env.example`，列出所需变量及示例值，提交到 Git。
- 如需全局配置，可在根目录使用 `.env` / `.env.example`，规则相同（仅 `.env.example` 提交到 Git）。
- 所有服务需通过环境变量读取配置（如 `MODELS_DIR`、数据库连接、缓存地址等），禁止在代码中写死。

### 10.4 针对 Agent 的补充约定

- 不得在仓库中提交任何实际 `.env` 文件，只允许提交 `*.env.example`。
- 如需新增本地依赖服务（数据库 / 缓存等），只能修改 `infra/docker-compose*.yml`，不得在其他目录新建 Compose 文件。
- 如需新增启动方式，优先在 `scripts/` 下新增脚本，而不是在随机目录新建 shell 脚本。

