from __future__ import annotations

import os
import re
from pathlib import Path
from typing import Any
from urllib.parse import urlparse
from uuid import uuid4

from app.config import settings
from app.utils.s3 import S3StorageClient

DEFAULT_ALLOWED_TYPES = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain",
    "video/mp4",
    "audio/mpeg",
]
DEFAULT_ALLOWED_EXTENSIONS = [
    "jpg",
    "jpeg",
    "png",
    "gif",
    "pdf",
    "doc",
    "docx",
    "xls",
    "xlsx",
    "txt",
    "mp4",
    "mp3",
]


def _sanitize_filename(filename: str) -> str:
    filename = filename.strip().replace("/", "_").replace("\\", "_")
    filename = re.sub(r"[^A-Za-z0-9._-]+", "_", filename)
    return filename.strip("._-") or "file"


def _normalize_mime_type(content_type: str) -> str:
    return content_type.strip().lower()


def _normalize_extension(filename: str) -> str:
    parts = filename.rsplit(".", 1)
    if len(parts) == 2:
        return parts[1].lower().lstrip(".")
    return ""


class FileStorageService:
    def __init__(self):
        self.max_bytes = settings.file_upload_max_bytes
        self.allowed_types = [mime.strip().lower() for mime in (settings.file_upload_allowed_types or DEFAULT_ALLOWED_TYPES)]
        self.allowed_extensions = [ext.strip().lower().lstrip(".") for ext in (settings.file_upload_allowed_extensions or DEFAULT_ALLOWED_EXTENSIONS)]
        self.client = self._get_client()
        # Local storage setup
        self.local_uploads_dir = Path(__file__).resolve().parent.parent.parent / "uploads"
        self.local_uploads_dir.mkdir(exist_ok=True)

    def _get_client(self) -> S3StorageClient | None:
        if not settings.s3_bucket or not settings.s3_region:
            return None
        return S3StorageClient(
            bucket_name=settings.s3_bucket,
            region=settings.s3_region,
            aws_access_key_id=settings.aws_access_key_id,
            aws_secret_access_key=settings.aws_secret_access_key,
        )

    def validate_file_size(self, size: int) -> None:
        if size < 0:
            raise ValueError("File size must be positive.")
        if size > self.max_bytes:
            raise ValueError(f"File size exceeds the maximum allowed size of {self.max_bytes} bytes.")

    def validate_file_type(self, content_type: str, filename: str | None = None) -> None:
        normalized = _normalize_mime_type(content_type)
        if self._matches_allowed_type(normalized):
            return

        if filename:
            extension = _normalize_extension(filename)
            if extension and extension in self.allowed_extensions:
                return

        allowed_str = ", ".join(self.allowed_types)
        raise ValueError(f"Unsupported file type '{content_type}'. Allowed types: {allowed_str}.")

    def _matches_allowed_type(self, content_type: str) -> bool:
        if content_type in self.allowed_types:
            return True
        for allowed in self.allowed_types:
            if allowed.endswith("/*"):
                prefix = allowed.split("/", 1)[0]
                if content_type.startswith(f"{prefix}/"):
                    return True
        return False

    def generate_object_key(self, organization_slug: str, user_id: int, filename: str) -> str:
        safe_filename = _sanitize_filename(filename)
        return f"uploads/{organization_slug}/{user_id}/{uuid4().hex}/{safe_filename}"

    def upload_file(self, key: str, body: bytes, content_type: str) -> dict[str, Any]:
        if self.client is None:
            raise RuntimeError(
                "AWS S3 storage is not configured. Set S3_BUCKET or AWS_S3_BUCKET and S3_REGION, AWS_REGION, or AWS_DEFAULT_REGION."
            )
        return self.client.upload_file(key=key, body=body, content_type=content_type)

    def parse_object_key_from_url(self, url: str) -> str:
        parsed = urlparse(url)
        if parsed.scheme and parsed.netloc:
            return parsed.path.lstrip("/")
        return url.strip()

    def validate_object_key_for_tenant(self, key: str, organization_slug: str) -> None:
        normalized = key.strip().replace("\\", "/")
        if ".." in normalized or normalized.startswith("/"):
            raise ValueError("Invalid object key.")

        if not (normalized.startswith(f"uploads/{organization_slug}/") or normalized.startswith(f"live-recordings/{organization_slug}/")):
            raise ValueError("Access denied for this file key.")

    def generate_presigned_url(self, key: str, expires_in: int = 900) -> str:
        if self.client is None:
            raise RuntimeError(
                "AWS S3 storage is not configured. Set S3_BUCKET or AWS_S3_BUCKET and S3_REGION, AWS_REGION, or AWS_DEFAULT_REGION."
            )
        return self.client.generate_presigned_url(key=key, expires_in=expires_in)

    def upload_file_local(self, directory: str, filename: str, body: bytes) -> dict[str, Any]:
        """Upload file to local storage and return metadata with URL."""
        try:
            # Create subdirectory if it doesn't exist
            target_dir = self.local_uploads_dir / directory
            target_dir.mkdir(parents=True, exist_ok=True)
            
            # Generate unique filename with UUID to avoid collisions
            safe_filename = _sanitize_filename(filename)
            unique_filename = f"{uuid4().hex}_{safe_filename}"
            file_path = target_dir / unique_filename
            
            # Write file to disk
            with open(file_path, "wb") as f:
                f.write(body)
            
            # Return URL that can be used to access the file
            relative_url = f"/uploads/{directory}/{unique_filename}"
            return {
                "url": relative_url,
                "path": str(file_path),
                "filename": unique_filename,
            }
        except Exception as e:
            raise RuntimeError(f"Failed to save file locally: {str(e)}")

    def generate_local_url(self, directory: str, filename: str) -> str:
        """Generate a URL for a locally stored file."""
        return f"/uploads/{directory}/{filename}"
