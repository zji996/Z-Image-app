"""
统一的模型下载 / 更新脚本占位实现。

- MODELS_DIR 环境变量指定模型根目录；
- 如未设置，则默认使用 <repo_root>/models。

实际下载逻辑请根据需要补充（例如从 OSS / HuggingFace / 内部仓库等）。
"""

import os
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MODELS_DIR = REPO_ROOT / "models"


def get_models_dir() -> Path:
    return Path(os.getenv("MODELS_DIR", DEFAULT_MODELS_DIR)).resolve()


def main() -> None:
    models_dir = get_models_dir()
    models_dir.mkdir(parents=True, exist_ok=True)

    print(f"[download_models] MODELS_DIR = {models_dir}")
    print(
        "[download_models] TODO: implement actual model download logic here "
        "(e.g. huggingface, object storage, internal repo, etc.)."
    )


if __name__ == "__main__":
    main()

