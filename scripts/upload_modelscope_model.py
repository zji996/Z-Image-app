"""
将本地模型目录上传到 ModelScope（保留完整文件夹结构）。

典型用法（上传当前仓库的 z-image-turbo-df11 目录）：

    uv run python scripts/upload_modelscope_model.py \
        --model-id your_name/Z-Image-Turbo-DF11-df11 \
        --model-dir models/z-image-turbo-df11 \
        --access-token YOUR_MODELSCOPE_TOKEN

说明：
- 需要预先安装 `modelscope`：`uv add modelscope` 或 `pip install modelscope`。
- 若不显式传入 `--access-token`，脚本会尝试从
  `MODELSCOPE_API_TOKEN` / `MODELSCOPE_ACCESS_TOKEN` 环境变量中读取。
"""

from __future__ import annotations

import argparse
import os
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Upload a local model directory to ModelScope (keep folder structure)."
    )
    parser.add_argument(
        "--model-id",
        required=True,
        help="ModelScope 模型 ID，形如 your_name/Z-Image-Turbo-DF11-df11。",
    )
    parser.add_argument(
        "--model-dir",
        default=str(REPO_ROOT / "models" / "z-image-turbo-df11"),
        help="要上传的本地模型目录，默认使用仓库下的 models/z-image-turbo-df11。",
    )
    parser.add_argument(
        "--access-token",
        help="ModelScope Access Token；若不提供，将从环境变量 "
        "MODELSCOPE_API_TOKEN / MODELSCOPE_ACCESS_TOKEN 中读取。",
    )
    parser.add_argument(
        "--visibility",
        type=int,
        default=5,
        help="模型可见性：5=公开，3=内部，1=私有。默认 5（公开）。",
    )
    parser.add_argument(
        "--license",
        dest="license_name",
        default="Apache License 2.0",
        help="模型许可证，默认 Apache License 2.0。",
    )
    parser.add_argument(
        "--chinese-name",
        dest="chinese_name",
        help="模型在 ModelScope 上展示的中文名称（可选）。",
    )
    parser.add_argument(
        "--revision",
        default="master",
        help="目标分支 / 版本名，默认 master。",
    )
    parser.add_argument(
        "--commit-message",
        default="upload model",
        help="本次上传的提交说明，默认 'upload model'。",
    )
    return parser.parse_args()


def resolve_access_token(explicit_token: str | None) -> str:
    if explicit_token:
        return explicit_token

    env_vars = ("MODELSCOPE_API_TOKEN", "MODELSCOPE_ACCESS_TOKEN")
    for name in env_vars:
        value = os.getenv(name)
        if value:
            return value

    raise SystemExit(
        "未找到 ModelScope Access Token。\n"
        "请通过 --access-token 传入，或设置环境变量 MODELSCOPE_API_TOKEN / MODELSCOPE_ACCESS_TOKEN。"
    )


def main() -> None:
    args = parse_args()

    try:
        from modelscope.hub.api import HubApi  # type: ignore[import-not-found]
    except Exception as exc:  # pragma: no cover - 运行时依赖
        print(
            "[upload_modelscope_model] 未安装 modelscope，无法上传模型。\n"
            "请先安装，例如：`uv add modelscope` 或 `pip install modelscope`。"
        )
        raise SystemExit(1) from exc

    model_dir = Path(args.model_dir).resolve()
    if not model_dir.exists():
        raise SystemExit(f"[upload_modelscope_model] 模型目录不存在：{model_dir}")
    if not (model_dir / "configuration.json").is_file():
        raise SystemExit(
            f"[upload_modelscope_model] 模型目录中未找到 configuration.json：{model_dir}\n"
            "ModelScope 要求模型根目录包含 configuration.json。"
        )

    access_token = resolve_access_token(args.access_token)

    print(f"[upload_modelscope_model] model_id   = {args.model_id}")
    print(f"[upload_modelscope_model] model_dir  = {model_dir}")
    print(f"[upload_modelscope_model] visibility = {args.visibility}")
    print(f"[upload_modelscope_model] license    = {args.license_name}")
    if args.chinese_name:
        print(f"[upload_modelscope_model] zh_name   = {args.chinese_name}")
    print(f"[upload_modelscope_model] revision   = {args.revision}")
    print(f"[upload_modelscope_model] message    = {args.commit_message}")

    api = HubApi()
    api.login(access_token)

    # push_model 会自动创建远端仓库，并递归上传 model_dir 下的全部文件/子目录，
    # 因此目录结构会在 ModelScope 上完整保留。
    api.push_model(
        model_id=args.model_id,
        model_dir=str(model_dir),
        visibility=args.visibility,
        license=args.license_name,
        chinese_name=args.chinese_name,
        commit_message=args.commit_message,
        revision=args.revision,
    )

    print("[upload_modelscope_model] 上传完成。")


if __name__ == "__main__":
    main()

