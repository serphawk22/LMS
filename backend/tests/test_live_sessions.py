import asyncio
from datetime import datetime
from io import BytesIO
from types import SimpleNamespace

from fastapi import UploadFile
from pytest import raises
from starlette.datastructures import Headers

from app.schemas.course import LiveSessionCreate, LiveSessionProvider


def test_create_live_session_route(monkeypatch):
    organization = SimpleNamespace(id=1, slug="tenant-1")
    current_user = SimpleNamespace(id=42, organization_id=1, role_name="instructor", is_active=True, is_verified=True)
    payload = LiveSessionCreate(
        course_id=1,
        title="Weekly review",
        description="Live review session",
        scheduled_at=datetime.utcnow(),
        duration_minutes=60,
        instructor_id=42,
        provider=LiveSessionProvider.zoom,
        provider_join_url="https://zoom.us/j/123456789",
        provider_start_url="https://zoom.us/s/123456789",
    )

    module = __import__("app.routers.courses", fromlist=["course_service", "auth_service"])
    monkeypatch.setattr(module.auth_service, "get_organization_by_tenant", lambda db, tenant_id: organization)
    monkeypatch.setattr(
        module.course_service,
        "create_live_class",
        lambda db, org, payload: SimpleNamespace(
            id=99,
            course_id=payload.course_id,
            title=payload.title,
            description=payload.description,
            scheduled_at=payload.scheduled_at,
            duration_minutes=payload.duration_minutes,
            instructor_id=payload.instructor_id,
            provider=payload.provider,
            provider_join_url=payload.provider_join_url,
            provider_start_url=payload.provider_start_url,
            provider_metadata=payload.provider_metadata,
            is_recurring=payload.is_recurring,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        ),
    )

    result = module.create_live_session(
        course_id=1,
        payload=payload,
        tenant_id="tenant-1",
        db=None,
        current_user=current_user,
    )

    assert result.id == 99
    assert result.title == "Weekly review"
    assert result.provider == LiveSessionProvider.zoom
    assert str(result.provider_join_url) == "https://zoom.us/j/123456789"


def test_list_course_live_sessions_uses_course_id(monkeypatch):
    organization = SimpleNamespace(id=1, slug="tenant-1")
    current_user = SimpleNamespace(id=42, organization_id=1, role_name="student", is_active=True, is_verified=True)
    course = SimpleNamespace(id=5, title="AI Fundamentals")
    expected_sessions = [SimpleNamespace(id=11, title="Live review session")]

    module = __import__("app.routers.courses", fromlist=["course_service", "auth_service"])
    monkeypatch.setattr(module.auth_service, "get_organization_by_tenant", lambda db, tenant_id: organization)
    monkeypatch.setattr(module.course_service, "get_course_by_id", lambda db, course_id, organization_id: course)

    def fake_get_course_live_classes(db, course_id, organization_id, limit, offset):
        assert course_id == course.id
        assert organization_id == organization.id
        return expected_sessions

    monkeypatch.setattr(module.course_service, "get_course_live_classes", fake_get_course_live_classes)

    result = module.list_live_sessions(
        course_id=course.id,
        limit=10,
        offset=0,
        tenant_id="tenant-1",
        db=None,
        current_user=current_user,
    )

    assert result == expected_sessions


def test_upload_live_session_recording_route(monkeypatch):
    organization = SimpleNamespace(id=1, slug="tenant-1")
    current_user = SimpleNamespace(id=42, organization_id=1, role_name="instructor", is_active=True, is_verified=True)
    live_class = SimpleNamespace(id=99, course_id=1, organization_id=1)
    file_bytes = b"sample recording"
    upload = UploadFile(
        BytesIO(file_bytes),
        filename="session.mp4",
        headers=Headers({"content-type": "video/mp4"}),
    )

    module = __import__("app.routers.courses", fromlist=["FileStorageService", "course_service", "auth_service"])
    monkeypatch.setattr(module.auth_service, "get_organization_by_tenant", lambda db, tenant_id: organization)
    monkeypatch.setattr(module.course_service, "get_live_class_by_id", lambda db, live_session_id, organization_id: live_class)
    monkeypatch.setattr(
        module.course_service,
        "create_live_class_recording",
        lambda db, live_class, uploaded_by, title, file_url, file_key, duration_minutes, notes: SimpleNamespace(
            id=12,
            title=title,
            file_url=file_url,
            file_key=file_key,
            duration_minutes=duration_minutes,
            notes=notes,
            uploaded_at=datetime.utcnow(),
            uploaded_by_id=uploaded_by.id,
        ),
    )

    class FakeStorageService:
        def __init__(self):
            pass

        def validate_file_type(self, content_type, filename=None):
            return None

        def validate_file_size(self, size):
            return None

        def upload_file(self, key, body, content_type):
            return {"url": f"https://bucket.s3.us-east-1.amazonaws.com/{key}"}

    monkeypatch.setattr(module, "FileStorageService", FakeStorageService)

    result = asyncio.run(
        module.upload_live_session_recording(
            course_id=1,
            live_session_id=99,
            title="Session recording",
            file=upload,
            duration_minutes=60,
            notes="Review of concepts",
            tenant_id="tenant-1",
            db=None,
            current_user=current_user,
        )
    )

    assert result.id == 12
    assert result.file_url.endswith("session.mp4")
    assert result.uploaded_by_id == 42


def test_create_live_session_route_rejects_course_mismatch(monkeypatch):
    organization = SimpleNamespace(id=1, slug="tenant-1")
    current_user = SimpleNamespace(id=42, organization_id=1, role_name="instructor", is_active=True, is_verified=True)
    payload = LiveSessionCreate(
        course_id=2,
        title="Mismatch",
        scheduled_at=datetime.utcnow(),
    )

    module = __import__("app.routers.courses", fromlist=["auth_service"])
    monkeypatch.setattr(module.auth_service, "get_organization_by_tenant", lambda db, tenant_id: organization)

    with raises(Exception):
        module.create_live_session(
            course_id=1,
            payload=payload,
            tenant_id="tenant-1",
            db=None,
            current_user=current_user,
        )
