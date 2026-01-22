from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from io import BytesIO
from pathlib import Path
from typing import IO, Iterable, Optional, Tuple

from .config import get_output_root, get_settings, is_s3_storage_enabled


class StorageConfigError(RuntimeError):
    pass


@dataclass(frozen=True)
class LocalStorage:
    root: Path

    def put_bytes(self, *, relative_path: str, data: bytes, content_type: str | None = None) -> str:
        rel = relative_path.lstrip("/")
        full_path = (self.root / rel).resolve()
        full_path.parent.mkdir(parents=True, exist_ok=True)
        full_path.write_bytes(data)
        return str(full_path)


@dataclass(frozen=True)
class S3Object:
    body: IO[bytes]
    content_type: Optional[str]
    content_length: Optional[int]

    def iter_chunks(self, chunk_size: int = 1024 * 1024) -> Iterable[bytes]:
        read = getattr(self.body, "read", None)
        if not callable(read):
            yield b""
            return

        while True:
            chunk = self.body.read(chunk_size)
            if not chunk:
                break
            yield chunk


@dataclass(frozen=True)
class S3Storage:
    endpoint: str
    access_key: str
    secret_key: str
    bucket: str
    region: str
    prefix: str

    def _key_for_relative_path(self, relative_path: str) -> str:
        rel = relative_path.lstrip("/")
        prefix = self.prefix.strip().strip("/")
        if prefix:
            return f"{prefix}/{rel}"
        return rel

    @property
    def client(self):
        return _get_s3_client(
            endpoint=self.endpoint,
            access_key=self.access_key,
            secret_key=self.secret_key,
            region=self.region,
        )

    def put_bytes(self, *, relative_path: str, data: bytes, content_type: str | None = None) -> str:
        key = self._key_for_relative_path(relative_path)
        self.client.put_object(
            Bucket=self.bucket,
            Key=key,
            Body=data,
            ContentType=content_type or "application/octet-stream",
        )
        return f"s3://{self.bucket}/{key}"

    def get_object(self, *, relative_path: str) -> S3Object:
        key = self._key_for_relative_path(relative_path)
        try:
            resp = self.client.get_object(Bucket=self.bucket, Key=key)
        except Exception as exc:  # pragma: no cover - depends on botocore
            # Defer import and error classification to keep local mode lightweight.
            from botocore.exceptions import ClientError

            if isinstance(exc, ClientError):
                code = str(exc.response.get("Error", {}).get("Code", ""))
                if code in {"NoSuchKey", "404", "NotFound"}:
                    raise FileNotFoundError(relative_path) from exc
            raise

        body = resp.get("Body")
        if body is None:
            raise FileNotFoundError(relative_path)

        content_type = resp.get("ContentType")
        content_length = resp.get("ContentLength")
        return S3Object(body=body, content_type=content_type, content_length=content_length)

    def generate_presigned_get_url(self, *, relative_path: str, expires_in: int) -> str:
        key = self._key_for_relative_path(relative_path)
        return self.client.generate_presigned_url(
            ClientMethod="get_object",
            Params={"Bucket": self.bucket, "Key": key},
            ExpiresIn=expires_in,
        )


def get_storage() -> LocalStorage | S3Storage:
    if is_s3_storage_enabled():
        return get_s3_storage()

    return LocalStorage(root=get_output_root())


def get_s3_storage() -> S3Storage:
    settings = get_settings()
    endpoint = (settings.s3_endpoint or "").strip()
    access_key = (settings.s3_access_key or "").strip()
    secret_key = (settings.s3_secret_key or "").strip()
    bucket = (settings.s3_bucket_name or "").strip()

    missing = [
        name
        for name, value in {
            "S3_ENDPOINT": endpoint,
            "S3_ACCESS_KEY": access_key,
            "S3_SECRET_KEY": secret_key,
            "S3_BUCKET_NAME": bucket,
        }.items()
        if not value
    ]
    if missing:
        raise StorageConfigError(f"Missing S3 config: {', '.join(missing)}")

    return S3Storage(
        endpoint=endpoint,
        access_key=access_key,
        secret_key=secret_key,
        bucket=bucket,
        region=settings.s3_region,
        prefix=settings.s3_prefix,
    )


def encode_image_bytes(*, image, format: str) -> Tuple[bytes, str]:
    buf = BytesIO()
    image.save(buf, format=format)
    data = buf.getvalue()

    fmt = format.strip().lower()
    if fmt == "png":
        return data, "image/png"
    if fmt == "webp":
        return data, "image/webp"
    return data, "application/octet-stream"


@lru_cache(maxsize=1)
def _get_s3_client(*, endpoint: str, access_key: str, secret_key: str, region: str):
    try:
        import boto3
        from botocore.config import Config
    except ModuleNotFoundError as exc:  # pragma: no cover
        raise ModuleNotFoundError(
            "boto3 is required for Z_IMAGE_STORAGE_BACKEND=s3; add it to your app dependencies and run uv sync"
        ) from exc

    config = Config(signature_version="s3v4", s3={"addressing_style": "path"})
    return boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        region_name=region,
        config=config,
    )
