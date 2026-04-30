from datetime import datetime, timedelta
from types import SimpleNamespace

from fastapi import HTTPException
from fastapi.testclient import TestClient
from pytest import raises

from app.main import app
from app.routers.quizzes import get_quiz, list_quizzes
from app.schemas.quiz import QuizAnswer, QuizAttemptSubmit
from app.services import auth as auth_service
from app.services import enrollment as enrollment_service
from app.services import quizzes as quiz_service


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


def make_quiz(published: bool):
    now = datetime.utcnow()
    return SimpleNamespace(
        id=1,
        course_id=1,
        title="Test Quiz",
        description="Short quiz",
        total_points=10,
        passing_score=5,
        pass_percentage=50,
        time_limit_minutes=10,
        randomize_questions=False,
        question_count=0,
        max_attempts=1,
        auto_grade_enabled=True,
        published=published,
        due_date=now + timedelta(days=7),
        created_at=now,
        updated_at=now,
    )


def test_list_quizzes_student_sees_only_published(monkeypatch):
    organization = make_org()
    student = make_user("student")
    published = make_quiz(True)

    monkeypatch.setattr(auth_service, "get_organization_by_tenant", lambda db, tenant_id: organization)

    def fake_get_quizzes(db, organization_id, include_unpublished=False, limit=50, offset=0, user=None):
        assert organization_id == organization.id
        assert include_unpublished is False
        assert user is student
        return [published]

    monkeypatch.setattr(quiz_service, "get_organization_quizzes", fake_get_quizzes)

    result = list_quizzes(limit=10, offset=0, tenant_id="tenant-1", db=None, current_user=student)
    assert result == [published]


def test_list_quizzes_instructor_sees_unpublished(monkeypatch):
    organization = make_org()
    instructor = make_user("instructor")
    published = make_quiz(True)
    unpublished = make_quiz(False)

    monkeypatch.setattr(auth_service, "get_organization_by_tenant", lambda db, tenant_id: organization)

    def fake_get_quizzes(db, organization_id, include_unpublished=False, limit=50, offset=0, user=None):
        assert organization_id == organization.id
        assert include_unpublished is True
        assert user is instructor
        return [published, unpublished]

    monkeypatch.setattr(quiz_service, "get_organization_quizzes", fake_get_quizzes)

    result = list_quizzes(limit=10, offset=0, tenant_id="tenant-1", db=None, current_user=instructor)
    assert result == [published, unpublished]


def test_get_quiz_unpublished_returns_404_for_student(monkeypatch):
    organization = make_org()
    student = make_user("student")
    unpublished = make_quiz(False)

    monkeypatch.setattr(auth_service, "get_organization_by_tenant", lambda db, tenant_id: organization)
    monkeypatch.setattr(quiz_service, "get_quiz_by_id", lambda db, quiz_id, organization_id: unpublished)

    with raises(HTTPException) as exc:
        get_quiz(quiz_id=1, tenant_id="tenant-1", db=None, current_user=student)

    assert exc.value.status_code == 404


def test_get_quiz_published_allows_student(monkeypatch):
    organization = make_org()
    student = make_user("student")
    published = make_quiz(True)

    monkeypatch.setattr(auth_service, "get_organization_by_tenant", lambda db, tenant_id: organization)
    monkeypatch.setattr(quiz_service, "get_quiz_by_id", lambda db, quiz_id, organization_id: published)
    monkeypatch.setattr(enrollment_service, "get_user_enrollment", lambda db, user_id, course_id, organization_id: object())

    result = get_quiz(quiz_id=1, tenant_id="tenant-1", db=None, current_user=student)
    assert result["id"] == published.id


def test_start_quiz_returns_expiration_when_timed(monkeypatch):
    organization = make_org()
    student = make_user("student")
    quiz = make_quiz(True)
    quiz.time_limit_minutes = 15
    quiz.questions = [SimpleNamespace(id=1, text="Q1", question_type="multiple_choice", choices=["A", "B"], points=1)]

    attempt = SimpleNamespace(id=99, question_ids=[1])

    monkeypatch.setattr(auth_service, "get_organization_by_tenant", lambda db, tenant_id: organization)
    monkeypatch.setattr(quiz_service, "get_quiz_by_id", lambda db, quiz_id, organization_id: quiz)
    monkeypatch.setattr(quiz_service, "start_quiz_attempt", lambda db, quiz, user: attempt)
    monkeypatch.setattr(enrollment_service, "get_user_enrollment", lambda db, user_id, course_id, organization_id: object())

    result = __import__("app.routers.quizzes", fromlist=["router"]).start_quiz(
        quiz_id=1,
        tenant_id="tenant-1",
        db=None,
        current_user=student,
    )

    assert result.attempt_id == 99
    assert result.quiz_id == quiz.id
    assert result.time_limit_minutes == 15
    assert result.expires_at is not None
    assert result.questions[0].id == 1


def test_submit_quiz_auto_grades(monkeypatch):
    organization = make_org()
    student = make_user("student")
    quiz = make_quiz(True)
    attempt = SimpleNamespace(id=100, status="in_progress")
    quiz.questions = []

    graded_attempt = SimpleNamespace(
        id=100,
        quiz_id=quiz.id,
        score=10.0,
        passed=True,
        status="graded",
        attempt_number=1,
        started_at=datetime.utcnow(),
        completed_at=datetime.utcnow(),
        auto_graded=True,
        answers=[{"question_id": 1, "answer": "A"}],
    )

    monkeypatch.setattr(auth_service, "get_organization_by_tenant", lambda db, tenant_id: organization)
    monkeypatch.setattr(quiz_service, "get_quiz_by_id", lambda db, quiz_id, organization_id: quiz)
    monkeypatch.setattr(quiz_service, "get_quiz_attempt_by_id", lambda db, attempt_id, user_id, organization_id: attempt)
    monkeypatch.setattr(quiz_service, "submit_quiz_attempt", lambda db, quiz, attempt_obj, answers: graded_attempt)

    payload = QuizAttemptSubmit(
        attempt_id=100,
        answers=[QuizAnswer(question_id=1, answer="A")],
    )
    router = __import__("app.routers.quizzes", fromlist=["router"])
    result = router.submit_quiz(
        quiz_id=1,
        payload=payload,
        tenant_id="tenant-1",
        db=None,
        current_user=student,
    )

    assert result["id"] == graded_attempt.id
    assert result["passed"] is True
    assert result["submitted_at"] == graded_attempt.completed_at


def test_quiz_analytics_requires_instructor(monkeypatch):
    organization = make_org()
    instructor = make_user("instructor")
    quiz = make_quiz(True)
    analytics_data = {
        "quiz_id": quiz.id,
        "total_attempts": 3,
        "average_score": 7.5,
        "pass_rate": 66.6667,
        "average_time_minutes": 12.0,
        "question_summary": [],
    }

    monkeypatch.setattr(auth_service, "get_organization_by_tenant", lambda db, tenant_id: organization)
    monkeypatch.setattr(quiz_service, "get_quiz_by_id", lambda db, quiz_id, organization_id: quiz)
    monkeypatch.setattr(quiz_service, "get_quiz_analytics", lambda db, quiz_obj: analytics_data)

    router = __import__("app.routers.quizzes", fromlist=["router"])
    result = router.quiz_analytics(
        quiz_id=1,
        tenant_id="tenant-1",
        db=None,
        current_user=instructor,
    )

    assert result.quiz_id == quiz.id
    assert result.total_attempts == 3
    assert result.average_score == 7.5


def test_list_user_quiz_attempts_returns_titles(monkeypatch):
    organization = make_org()
    student = make_user("student")
    quiz_attempt = {
        "id": 100,
        "quiz_id": 2,
        "score": 8.0,
        "passed": True,
        "status": "graded",
        "attempt_number": 1,
        "started_at": datetime.utcnow(),
        "completed_at": datetime.utcnow(),
        "auto_graded": True,
        "answers": [],
        "quiz_title": "Intro Quiz",
        "course_title": "Test Course",
        "student_name": None,
    }

    monkeypatch.setattr(auth_service, "get_organization_by_tenant", lambda db, tenant_id: organization)
    monkeypatch.setattr(
        quiz_service,
        "get_user_all_quiz_attempts",
        lambda db, user_id, organization_id, limit=50, offset=0: [quiz_attempt],
    )

    router = __import__("app.routers.quizzes", fromlist=["router"])
    result = router.list_user_quiz_attempts(limit=10, offset=0, tenant_id="tenant-1", db=None, current_user=student)
    assert result[0]["quiz_title"] == "Intro Quiz"
    assert result[0]["course_title"] == "Test Course"


def test_list_quiz_results_requires_instructor(monkeypatch):
    organization = make_org()
    instructor = make_user("instructor")

    monkeypatch.setattr(auth_service, "get_organization_by_tenant", lambda db, tenant_id: organization)
    monkeypatch.setattr(
        quiz_service,
        "get_quiz_results",
        lambda db, organization_id, limit=25, offset=0: [
            {
                "id": 100,
                "quiz_id": 2,
                "score": 8.0,
                "passed": True,
                "status": "graded",
                "attempt_number": 1,
                "started_at": datetime.utcnow(),
                "completed_at": datetime.utcnow(),
                "auto_graded": True,
                "quiz_title": "Intro Quiz",
                "course_title": "Test Course",
                "student_name": "Test Learner",
            }
        ],
    )

    router = __import__("app.routers.quizzes", fromlist=["router"])
    result = router.list_quiz_results(limit=10, offset=0, tenant_id="tenant-1", db=None, current_user=instructor)
    assert result[0]["quiz_title"] == "Intro Quiz"
    assert result[0]["student_name"] == "Test Learner"


def test_list_quiz_results_returns_empty_when_no_attempts(monkeypatch):
    organization = make_org()
    instructor = make_user("instructor")

    monkeypatch.setattr(auth_service, "get_organization_by_tenant", lambda db, tenant_id: organization)
    monkeypatch.setattr(quiz_service, "get_quiz_results", lambda db, organization_id, limit=25, offset=0: [])

    router = __import__("app.routers.quizzes", fromlist=["router"])
    result = router.list_quiz_results(limit=10, offset=0, tenant_id="tenant-1", db=None, current_user=instructor)

    assert result == []


def test_submit_quiz_returns_error_when_answers_incomplete(monkeypatch):
    organization = make_org()
    student = make_user("student")
    quiz = make_quiz(True)
    attempt = SimpleNamespace(id=100, status="in_progress")

    monkeypatch.setattr(auth_service, "get_organization_by_tenant", lambda db, tenant_id: organization)
    monkeypatch.setattr(quiz_service, "get_quiz_by_id", lambda db, quiz_id, organization_id: quiz)
    monkeypatch.setattr(quiz_service, "get_quiz_attempt_by_id", lambda db, attempt_id, user_id, organization_id: attempt)
    monkeypatch.setattr(quiz_service, "submit_quiz_attempt", lambda db, quiz_obj, attempt_obj, answers: (_ for _ in ()).throw(ValueError("Please answer all quiz questions before submitting.")))

    payload = QuizAttemptSubmit(attempt_id=100, answers=[])
    router = __import__("app.routers.quizzes", fromlist=["router"])

    with raises(HTTPException) as exc:
        router.submit_quiz(quiz_id=1, payload=payload, tenant_id="tenant-1", db=None, current_user=student)

    assert exc.value.status_code == 400
    assert "Please answer all quiz questions" in str(exc.value.detail)


def test_quizzes_attempts_route_does_not_match_quiz_id_path():
    client = TestClient(app)
    response = client.get("/api/v1/quizzes/attempts", headers={"x-tenant-id": "tenant-1"})

    assert response.status_code != 422
    assert response.status_code in {400, 401, 403}
