from __future__ import annotations

import argparse
import sys
from pathlib import Path

from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

root_env_file = REPO_ROOT / ".env"
if root_env_file.exists():
    load_dotenv(root_env_file, override=False)

api_env_file = REPO_ROOT / "apps" / "api" / ".env"
if api_env_file.exists():
    load_dotenv(api_env_file, override=False)

from libs.py_core.config import get_settings
from libs.py_core.storage import S3Storage, StorageConfigError, get_s3_storage


def _iter_files(root: Path):
    for path in root.rglob("*"):
        if path.is_file():
            yield path


def _ensure_bucket(storage: S3Storage) -> None:
    try:
        storage.client.head_bucket(Bucket=storage.bucket)
        return
    except Exception as exc:  # pragma: no cover - depends on botocore/minio
        from botocore.exceptions import ClientError

        if isinstance(exc, ClientError):
            code = str(exc.response.get("Error", {}).get("Code", ""))
            if code in {"NoSuchBucket", "404", "NotFound"}:
                storage.client.create_bucket(Bucket=storage.bucket)
                print(f"[migrate_outputs_to_s3] Created bucket: {storage.bucket}")
                return
        raise


def main() -> int:
    parser = argparse.ArgumentParser(description="Migrate local generated images to S3/MinIO.")
    parser.add_argument(
        "--source-dir",
        type=str,
        default="",
        help="Local outputs dir to migrate (default: Z_IMAGE_OUTPUT_DIR / repo outputs/z-image-outputs).",
    )
    parser.add_argument("--dry-run", action="store_true", help="Print planned uploads without uploading.")
    args = parser.parse_args()

    settings = get_settings()
    source_dir = Path(args.source_dir).expanduser() if args.source_dir else settings.outputs_dir.resolve()

    if not source_dir.exists():
        print(f"[migrate_outputs_to_s3] Source dir not found: {source_dir}")
        return 1

    try:
        storage: S3Storage = get_s3_storage()
    except StorageConfigError as exc:
        print(f"[migrate_outputs_to_s3] {exc}")
        print("[migrate_outputs_to_s3] Tip: set S3_* env vars (or fill apps/api/.env from apps/api/.env.example).")
        return 2

    _ensure_bucket(storage)
    print(
        "[migrate_outputs_to_s3] Target: "
        f"endpoint={storage.endpoint} bucket={storage.bucket} prefix={storage.prefix!r}"
    )
    print(f"[migrate_outputs_to_s3] Source: {source_dir}")

    uploaded = 0
    skipped = 0

    for file_path in _iter_files(source_dir):
        rel = file_path.relative_to(source_dir).as_posix()
        suffix = file_path.suffix.lower()
        if suffix == ".png":
            content_type = "image/png"
        elif suffix == ".webp":
            content_type = "image/webp"
        else:
            content_type = "application/octet-stream"

        if args.dry_run:
            print(f"[dry-run] upload {rel}")
            skipped += 1
            continue

        storage.put_bytes(relative_path=rel, data=file_path.read_bytes(), content_type=content_type)
        uploaded += 1

        if uploaded % 100 == 0:
            print(f"[migrate_outputs_to_s3] Uploaded {uploaded} files...")

    print(f"[migrate_outputs_to_s3] Done. uploaded={uploaded} dry_run={args.dry_run}")
    if skipped:
        print(f"[migrate_outputs_to_s3] dry_run files={skipped}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
