import asyncio
from io import BytesIO
from types import SimpleNamespace

from fastapi import HTTPException, UploadFile
from pytest import raises
from starlette.datastructures import Headers

from app.config import Settings
from app.services.storage import FileStorageService


def make_org():
    return SimpleNamespace(id=1, slug="tenant-1")


def make_user():
    return SimpleNamespace(
        id=42,
        organization_id=1,
        role_name="student",
        is_active=True,
        is_verified=True,
    )


def test_file_storage_rejects_unsupported_type():
    service = FileStorageService()
    with raises(ValueError, match="Unsupported file type"):
        service.validate_file_type("application/zip", "archive.zip")


def test_file_storage_rejects_too_large_payload():
    service = FileStorageService()
    with raises(ValueError, match="File size exceeds"):
        service.validate_file_size(service.max_bytes + 1)


def test_settings_load_aws_aliases(monkeypatch):
    monkeypatch.setenv("AWS_S3_BUCKET", "example-bucket")
    monkeypatch.setenv("AWS_REGION", "us-east-1")
    monkeypatch.setenv("AWS_ACCESS_KEY_ID", "AKIAEXAMPLE")
    monkeypatch.setenv("AWS_SECRET_ACCESS_KEY", "secret")

    settings = Settings()

    assert settings.s3_bucket == "example-bucket"
    assert settings.s3_region == "us-east-1"
    assert settings.aws_access_key_id == "AKIAEXAMPLE"
    assert settings.aws_secret_access_key == "secret"


def test_upload_file_handler_with_s3(monkeypatch):
    organization = make_org()
    user = make_user()
    file_bytes = b"Hello file storage"
    upload = UploadFile(
        BytesIO(file_bytes),
        filename="picture.png",
        headers=Headers({"content-type": "image/png"}),
    )
    request = SimpleNamespace(url=SimpleNamespace(scheme="http", netloc="localhost:8000"))

    module = __import__("app.routers.files", fromlist=["storage_service"])
    monkeypatch.setattr(module, "get_organization_by_tenant", lambda db, tenant_id: organization)
    monkeypatch.setattr(module.storage_service, "upload_file", lambda key, body, content_type: {
        "url": f"https://bucket.s3.us-east-1.amazonaws.com/{key}",
    })

    result = asyncio.run(
        module.upload_file(
            request=request,
            file=upload,
            tenant_id="tenant-1",
            db=None,
            current_user=user,
        )
    )

    assert result.filename == "picture.png"
    assert result.size == len(file_bytes)
    assert result.url.startswith("https://bucket.s3.us-east-1.amazonaws.com/uploads/tenant-1/42/")
    assert result.key.startswith("uploads/tenant-1/42/")


def test_upload_file_handler_returns_absolute_local_url(monkeypatch):
    organization = make_org()
    user = make_user()
    file_bytes = b"Hello PDF file"
    upload = UploadFile(
        BytesIO(file_bytes),
        filename="document.pdf",
        headers=Headers({"content-type": "application/pdf"}),
    )
    request = SimpleNamespace(url=SimpleNamespace(scheme="http", netloc="localhost:8000"))

    module = __import__("app.routers.files", fromlist=["storage_service"])
    monkeypatch.setattr(module, "get_organization_by_tenant", lambda db, tenant_id: organization)
    monkeypatch.setattr(module.storage_service, "upload_file_local", lambda directory, filename, body: {
        "url": "/uploads/tenant-1/42/document.pdf",
        "path": "/tmp/document.pdf",
        "filename": "document.pdf",
    })

    result = asyncio.run(
        module.upload_file(
            request=request,
            file=upload,
            tenant_id="tenant-1",
            db=None,
            current_user=user,
        )
    )

    assert result.filename == "document.pdf"
    assert result.size == len(file_bytes)
    assert result.url == "http://localhost:8000/uploads/tenant-1/42/document.pdf"
    assert result.key == "document.pdf"


def test_download_file_handler_returns_presigned_url(monkeypatch):
    organization = make_org()
    user = make_user()
    file_key = "uploads/tenant-1/42/picture.png"
    request = SimpleNamespace(url=SimpleNamespace(scheme="http", netloc="localhost:8000"))

    module = __import__("app.routers.files", fromlist=["storage_service"])
    monkeypatch.setattr(module, "get_organization_by_tenant", lambda db, tenant_id: organization)
    module.storage_service.client = object()
    monkeypatch.setattr(module.storage_service, "generate_presigned_url", lambda key, expires_in=900: f"https://bucket.s3.us-east-1.amazonaws.com/{key}?signature=test")

    result = module.download_file(
        request=request,
        key=file_key,
        tenant_id="tenant-1",
        db=None,
        current_user=user,
    )

    assert result.key == file_key
    assert result.filename == "picture.png"
    assert "signature=test" in result.url


def test_download_file_handler_returns_local_url_when_no_s3(monkeypatch):
    organization = make_org()
    user = make_user()
    file_key = "uploads/tenant-1/42/picture.png"
    request = SimpleNamespace(url=SimpleNamespace(scheme="http", netloc="localhost:8000"))

    module = __import__("app.routers.files", fromlist=["storage_service"])
    monkeypatch.setattr(module, "get_organization_by_tenant", lambda db, tenant_id: organization)
    module.storage_service.client = None

    result = module.download_file(
        request=request,
        key=file_key,
        tenant_id="tenant-1",
        db=None,
        current_user=user,
    )

    assert result.key == file_key
    assert result.filename == "picture.png"
    assert result.url == "http://localhost:8000/uploads/tenant-1/42/picture.png"


def test_download_file_handler_forbids_cross_tenant_key(monkeypatch):
    organization = make_org()
    user = make_user()

    module = __import__("app.routers.files", fromlist=["storage_service"])
    monkeypatch.setattr(module, "get_organization_by_tenant", lambda db, tenant_id: organization)

    request = SimpleNamespace(url=SimpleNamespace(scheme="http", netloc="localhost:8000"))
    with raises(HTTPException) as exc:
        module.download_file(
            request=request,
            key="uploads/other-tenant/42/picture.png",
            tenant_id="tenant-1",
            db=None,
            current_user=user,
        )
    assert exc.value.status_code == 403
