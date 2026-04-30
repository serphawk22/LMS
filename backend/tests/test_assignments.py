import asyncio
from datetime import datetime, timedelta
from types import SimpleNamespace

from fastapi import HTTPException
from pytest import raises

from app.routers.assignments import get_assignment, get_my_assignment_submission, list_assignments, submit_assignment
from app.services import auth as auth_service
from app.services import assignments as assignment_service


def make_org():
    return SimpleNamespace(id=1)


def make_user(role_name: str):
    return SimpleNamespace(
        id=42,
        organization_id=1,
        role_name=role_name,
        is_active=True,
        is_verified=True,
    )


def make_assignment(published: bool):
    now = datetime.utcnow()
    return SimpleNamespace(
        id=1,
        course_id=1,
        title="Test Assignment",
        instructions="Instructions",
        due_date=now + timedelta(days=7),
        max_score=100,
        published=published,
        created_at=now,
        updated_at=now,
    )


def test_list_assignments_student_sees_only_published(monkeypatch):
    organization = make_org()
    student = make_user("student")
    published = make_assignment(True)

    monkeypatch.setattr(auth_service, "get_organization_by_tenant", lambda db, tenant_id: organization)
    monkeypatch.setattr(assignment_service, "get_assignment_submissions", lambda db, assignment_id, organization_id: [])

    def fake_get_assignments(db, organization_id, course_id=None, include_unpublished=False, creator_id=None):
        assert organization_id == organization.id
        assert include_unpublished is False
        return [published]

    monkeypatch.setattr(assignment_service, "get_organization_assignments", fake_get_assignments)

    result = list_assignments(course_id=None, tenant_id="tenant-1", db=None, current_user=student)
    assert len(result) == 1
    assert result[0].id == published.id
    assert result[0].course_name is None
    assert result[0].submissions_count == 0


def test_list_assignments_instructor_sees_unpublished(monkeypatch):
    organization = make_org()
    instructor = make_user("instructor")
    published = make_assignment(True)
    unpublished = make_assignment(False)
    published.course = SimpleNamespace(title="Test Course")
    unpublished.course = SimpleNamespace(title="Test Course")

    monkeypatch.setattr(auth_service, "get_organization_by_tenant", lambda db, tenant_id: organization)
    monkeypatch.setattr(assignment_service, "get_assignment_submissions", lambda db, assignment_id, organization_id: [])

    def fake_get_assignments(db, organization_id, course_id=None, include_unpublished=False, creator_id=None):
        assert organization_id == organization.id
        assert include_unpublished is True
        return [published, unpublished]

    monkeypatch.setattr(assignment_service, "get_organization_assignments", fake_get_assignments)

    result = list_assignments(course_id=None, tenant_id="tenant-1", db=None, current_user=instructor)
    assert len(result) == 2
    assert result[0].id == published.id
    assert result[0].course_name == "Test Course"
    assert result[0].submissions_count == 0
    assert result[1].id == unpublished.id
    assert result[1].course_name == "Test Course"
    assert result[1].submissions_count == 0


def test_get_assignment_unpublished_returns_404_for_student(monkeypatch):
    organization = make_org()
    student = make_user("student")
    unpublished = make_assignment(False)

    monkeypatch.setattr(auth_service, "get_organization_by_tenant", lambda db, tenant_id: organization)
    monkeypatch.setattr(assignment_service, "get_assignment_by_id", lambda db, assignment_id, organization_id: unpublished)

    with raises(HTTPException) as exc:
        get_assignment(assignment_id=1, tenant_id="tenant-1", db=None, current_user=student)

    assert exc.value.status_code == 404


def test_get_assignment_published_allows_student(monkeypatch):
    organization = make_org()
    student = make_user("student")
    published = make_assignment(True)

    monkeypatch.setattr(auth_service, "get_organization_by_tenant", lambda db, tenant_id: organization)
    monkeypatch.setattr(assignment_service, "get_assignment_by_id", lambda db, assignment_id, organization_id: published)

    result = get_assignment(assignment_id=1, tenant_id="tenant-1", db=None, current_user=student)
    assert result is published


def test_create_assignment_with_files_includes_allow_late_submission(monkeypatch):
    organization = make_org()
    instructor = make_user("instructor")
    assignment = make_assignment(True)
    assignment.allow_late_submission = True

    monkeypatch.setattr(auth_service, "get_organization_by_tenant", lambda db, tenant_id: organization)

    def fake_create_assignment(db, organization_obj, current_user, payload):
        assert organization_obj is organization
        assert current_user is instructor
        assert payload.allow_late_submission is True
        return assignment

    monkeypatch.setattr(assignment_service, "create_assignment", fake_create_assignment)

    module = __import__("app.routers.assignments", fromlist=["create_assignment_with_files"])
    result = asyncio.run(module.create_assignment_with_files(
        course_id=1,
        title="Late Assignment",
        instructions="Submit after due date",
        due_date=None,
        max_score=50,
        published=True,
        allow_late_submission=True,
        attachments=None,
        tenant_id="tenant-1",
        db=None,
        current_user=instructor,
    ))

    assert result is assignment


def test_submit_assignment_with_link(monkeypatch):
    organization = make_org()
    student = make_user("student")
    assignment = make_assignment(True)
    submission_link = "https://example.com/my-work"

    submission = SimpleNamespace(
        id=301,
        assignment_id=assignment.id,
        user_id=student.id,
        submitted_at=datetime.utcnow(),
        content=submission_link,
        attachments=None,
        grade=None,
        feedback=None,
        status="submitted",
    )

    monkeypatch.setattr(auth_service, "get_organization_by_tenant", lambda db, tenant_id: organization)
    monkeypatch.setattr(assignment_service, "get_assignment_by_id", lambda db, assignment_id, organization_id: assignment)

    def fake_submit(db, assignment_obj, user, payload):
        assert assignment_obj is assignment
        assert user is student
        assert payload.content == submission_link
        assert payload.attachments is None
        return submission

    monkeypatch.setattr(assignment_service, "submit_assignment", fake_submit)

    result = asyncio.run(submit_assignment(
        assignment_id=assignment.id,
        submission_link=submission_link,
        text_content=None,
        student_id=None,
        assignment_id_form=None,
        tenant_id="tenant-1",
        db=None,
        current_user=student,
    ))

    assert result.content == submission_link
    assert result.late is False


def test_get_assignment_submission_attachment_download_with_s3(monkeypatch):
    organization = make_org()
    student = make_user("student")
    assignment = make_assignment(True)
    submission = SimpleNamespace(
        id=103,
        assignment_id=assignment.id,
        user_id=student.id,
        submitted_at=datetime.utcnow(),
        content="File answer",
        attachments=[
            {
                "filename": "essay.txt",
                "mime_type": "text/plain",
                "size": 18,
                "key": "assignments/1/42/essay.txt",
            }
        ],
        grade=None,
        feedback=None,
        status="submitted",
    )

    monkeypatch.setattr(auth_service, "get_organization_by_tenant", lambda db, tenant_id: organization)
    monkeypatch.setattr(assignment_service, "get_submission_by_id", lambda db, submission_id, organization_id: submission)
    monkeypatch.setattr(assignment_service, "get_assignment_by_id", lambda db, assignment_id, organization_id: assignment)

    module = __import__("app.routers.assignments", fromlist=["settings", "S3StorageClient"])
    monkeypatch.setattr(module.settings, "s3_bucket", "bucket")
    monkeypatch.setattr(module.settings, "s3_region", "us-east-1")
    monkeypatch.setattr(
        module.S3StorageClient,
        "generate_presigned_url",
        lambda self, key, expires_in=900: f"https://bucket.s3.us-east-1.amazonaws.com/{key}?signed=true",
    )

    result = module.get_assignment_submission_attachment_download(
        submission_id=submission.id,
        filename="essay.txt",
        tenant_id="tenant-1",
        db=None,
        current_user=student,
    )

    assert result["url"] == "https://bucket.s3.us-east-1.amazonaws.com/assignments/1/42/essay.txt?signed=true"
    assert "signed=true" in result["url"]


def test_get_my_assignment_submission_marks_late(monkeypatch):
    organization = make_org()
    student = make_user("student")
    assignment = make_assignment(True)
    assignment.due_date = datetime.utcnow() - timedelta(days=1)
    submission = SimpleNamespace(
        id=101,
        assignment_id=assignment.id,
        user_id=student.id,
        user=student,
        submitted_at=datetime.utcnow(),
        content="My work",
        attachments=[{"filename": "essay.txt", "mime_type": "text/plain", "size": 1024}],
        grade=85.0,
        feedback="Good work",
        status="submitted",
    )

    monkeypatch.setattr(auth_service, "get_organization_by_tenant", lambda db, tenant_id: organization)
    monkeypatch.setattr(assignment_service, "get_assignment_by_id", lambda db, assignment_id, organization_id: assignment)
    monkeypatch.setattr(
        assignment_service,
        "get_user_assignment_submission",
        lambda db, assignment_id, user_id, organization_id: submission,
    )

    result = get_my_assignment_submission(assignment_id=assignment.id, tenant_id="tenant-1", db=None, current_user=student)
    assert result.late is True
    assert result.grade == 85.0
    assert result.feedback == "Good work"


def test_grade_assignment_submission_marks_reviewed(monkeypatch):
    from app.services.assignments import grade_assignment_submission
    import app.services.dashboard as dashboard_service

    submission = SimpleNamespace(
        id=500,
        assignment=SimpleNamespace(title="Test Assignment"),
        grade=None,
        feedback=None,
        status="submitted",
        reviewed=False,
        user_id=42,
        user=SimpleNamespace(id=42),
    )
    payload = SimpleNamespace(grade=92.0, feedback="Great work", status="graded")

    db = SimpleNamespace(
        add=lambda x: None,
        commit=lambda: None,
        refresh=lambda x: None,
    )

    monkeypatch.setattr(dashboard_service, "create_notification", lambda db_arg, user_arg, title, message: None)

    updated_submission = grade_assignment_submission(db=db, submission=submission, payload=payload, graded_by=100)

    assert updated_submission.grade == 92.0
    assert updated_submission.feedback == "Great work"
    assert updated_submission.status == "graded"
    assert updated_submission.reviewed is True
    assert updated_submission.graded_by == 100
