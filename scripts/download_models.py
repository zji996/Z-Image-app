"""
统一的模型下载 / 更新脚本（Z-Image 家族）。

目标：
- 支持将真实模型权重下载到 MODELS_DIR（默认 <repo_root>/models）。
- 考虑 Z-Image 的多个变体（Turbo / Base / Edit）与不同托管平台（Hugging Face / ModelScope）。
- 启动前或首次使用时，用户可以按需选择下载哪些模型。

推荐用法：

交互式选择：
    uv run python scripts/download_models.py

非交互式：
    uv run python scripts/download_models.py --model z_image_turbo --source modelscope --revision master
"""

from __future__ import annotations

import argparse
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Dict


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MODELS_DIR = REPO_ROOT / "models"


def get_models_dir() -> Path:
    return Path(os.getenv("MODELS_DIR", DEFAULT_MODELS_DIR)).resolve()


@dataclass
class ModelConfig:
    key: str
    display_name: str
    # MODELS_DIR 下的子目录名，应与 libs/py_core/z_image_pipeline.py 中保持一致
    local_subdir: str
    # provider -> repo/model_id
    sources: Dict[str, str]
    default_source: str
    available: bool = True


MODEL_REGISTRY: Dict[str, ModelConfig] = {
    "z_image_turbo": ModelConfig(
        key="z_image_turbo",
        display_name="Z-Image-Turbo",
        local_subdir="z-image-turbo",
        sources={
            "huggingface": "Tongyi-MAI/Z-Image-Turbo",
            "modelscope": "Tongyi-MAI/Z-Image-Turbo",
        },
        # 你给的链接是 ModelScope，因此默认优先 ModelScope
        default_source="modelscope",
    ),
    "z_image_turbo_df11": ModelConfig(
        key="z_image_turbo_df11",
        display_name="Z-Image-Turbo (DF11 bundle)",
        local_subdir="z-image-turbo-df11",
        sources={
            "modelscope": "kuohao/z-image-turbo-df11",
        },
        default_source="modelscope",
    ),
    # 预留：Base / Edit 变体当前尚未开放下载，仅做占位，便于后续兼容
    "z_image_base": ModelConfig(
        key="z_image_base",
        display_name="Z-Image-Base",
        local_subdir="z-image-base",
        sources={},
        default_source="modelscope",
        available=False,
    ),
    "z_image_edit": ModelConfig(
        key="z_image_edit",
        display_name="Z-Image-Edit",
        local_subdir="z-image-edit",
        sources={},
        default_source="modelscope",
        available=False,
    ),
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Download Z-Image model weights into MODELS_DIR.")
    parser.add_argument(
        "--model",
        choices=sorted(MODEL_REGISTRY.keys()),
        help="逻辑模型名，例如 z_image_turbo / z_image_base / z_image_edit",
    )
    parser.add_argument(
        "--source",
        choices=["huggingface", "modelscope"],
        help="托管平台：huggingface 或 modelscope（某些模型可能只支持其一）",
    )
    parser.add_argument(
        "--revision",
        default="master",
        help="远端仓库版本（branch/tag/hash），默认 master",
    )
    parser.add_argument(
        "--non-interactive",
        action="store_true",
        help="非交互模式：缺少参数时直接报错退出，而不是提示选择。",
    )
    return parser.parse_args()


def choose_model_interactively() -> str:
    print("可用的 Z-Image 模型：")
    available_models = [cfg for cfg in MODEL_REGISTRY.values() if cfg.available]

    for idx, cfg in enumerate(available_models, start=1):
        print(f"  [{idx}] {cfg.display_name} ({cfg.key})")

    while True:
        raw = input(f"请选择要下载的模型 [1-{len(available_models)}]（默认 1）: ").strip()
        if not raw:
            return available_models[0].key
        try:
            n = int(raw)
            if 1 <= n <= len(available_models):
                return available_models[n - 1].key
        except ValueError:
            pass
        print("输入无效，请重新输入。")


def choose_source_interactively(model_cfg: ModelConfig) -> str:
    sources = sorted(model_cfg.sources.keys())
    if not sources:
        raise SystemExit(f"模型 {model_cfg.key} 当前尚未配置可用的下载源。")

    print(f"可用下载源（{model_cfg.display_name}）：")
    for idx, name in enumerate(sources, start=1):
        default_mark = " (默认)" if name == model_cfg.default_source else ""
        print(f"  [{idx}] {name}{default_mark}")

    while True:
        raw = input(f"请选择下载源 [1-{len(sources)}]（默认 {sources.index(model_cfg.default_source)+1}）: ").strip()
        if not raw:
            return model_cfg.default_source
        try:
            n = int(raw)
            if 1 <= n <= len(sources):
                return sources[n - 1]
        except ValueError:
            pass
        print("输入无效，请重新输入。")


def download_from_huggingface(repo_id: str, target_dir: Path, revision: str | None) -> None:
    try:
        from huggingface_hub import snapshot_download  # type: ignore[import-not-found]
    except Exception as exc:  # pragma: no cover - runtime only
        print(
            "[download_models] huggingface_hub 未安装，无法从 Hugging Face 下载模型。\n"
            "请先安装，例如：`uv add huggingface_hub` 或 `pip install huggingface_hub`。"
        )
        raise SystemExit(1) from exc

    target_dir.mkdir(parents=True, exist_ok=True)

    snapshot_download(
        repo_id=repo_id,
        local_dir=str(target_dir),
        revision=revision,
        local_dir_use_symlinks=False,
    )


def download_from_modelscope(model_id: str, target_dir: Path, revision: str | None) -> None:
    try:
        from modelscope.hub.snapshot_download import (  # type: ignore[import-not-found]
            snapshot_download,
        )
    except Exception as exc:  # pragma: no cover - runtime only
        print(
            "[download_models] modelscope 未安装，无法从 ModelScope 下载模型。\n"
            "请先安装，例如：`uv add modelscope` 或 `pip install modelscope`。"
        )
        raise SystemExit(1) from exc

    target_dir.mkdir(parents=True, exist_ok=True)

    snapshot_download(
        model_id=model_id,
        local_dir=str(target_dir),
        revision=revision,
    )


def main() -> None:
    args = parse_args()

    models_dir = get_models_dir()
    models_dir.mkdir(parents=True, exist_ok=True)

    # 选择模型（支持交互式）
    model_key = args.model
    if not model_key:
        if args.non_interactive:
            raise SystemExit(
                "缺少 --model 参数，并且处于非交互模式。"
                f" 可选值为：{', '.join(sorted(MODEL_REGISTRY.keys()))}"
            )
        model_key = choose_model_interactively()

    model_cfg = MODEL_REGISTRY[model_key]
    if not model_cfg.available:
        raise SystemExit(f"模型 {model_cfg.display_name} 当前尚未开放下载，请关注官方发布。")

    # 选择下载源
    source = args.source
    if not source:
        if args.non_interactive:
            raise SystemExit("--source 必须指定为 huggingface 或 modelscope。")
        source = choose_source_interactively(model_cfg)

    if source not in model_cfg.sources:
        raise SystemExit(
            f"模型 {model_cfg.display_name} 暂不支持下载源 {source}，"
            f"当前支持：{', '.join(sorted(model_cfg.sources.keys()))}"
        )

    revision = args.revision or None

    repo_or_model_id = model_cfg.sources[source]
    target_dir = models_dir / model_cfg.local_subdir

    print(f"[download_models] MODELS_DIR = {models_dir}")
    print(f"[download_models] Model     = {model_cfg.display_name} ({model_cfg.key})")
    print(f"[download_models] Source    = {source} ({repo_or_model_id})")
    print(f"[download_models] Revision  = {revision or '<default>'}")
    print(f"[download_models] Local dir = {target_dir}")

    if source == "huggingface":
        download_from_huggingface(repo_or_model_id, target_dir, revision)
    else:
        download_from_modelscope(repo_or_model_id, target_dir, revision)

    print("[download_models] 模型下载完成。")


if __name__ == "__main__":
    main()
