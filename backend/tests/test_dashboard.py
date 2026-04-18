from types import SimpleNamespace

from app.services import auth as auth_service
from app.services import dashboard as dashboard_service


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


def test_admin_overview_returns_metrics(monkeypatch):
    organization = make_org()
    admin = make_user("organization_admin")
    summary = {
        "total_users": 25,
        "total_courses": 8,
        "total_organizations": 1,
        "revenue": 1299.5,
        "active_users": 18,
    }

    monkeypatch.setattr(auth_service, "get_organization_by_tenant", lambda db, tenant_id: organization)
    monkeypatch.setattr(dashboard_service, "get_admin_dashboard_overview", lambda db, user: summary)

    router = __import__("app.routers.dashboard", fromlist=["router"])
    result = router.get_admin_dashboard_overview(
        tenant_id="tenant-1",
        db=None,
        current_user=admin,
    )

    assert result == summary


def test_course_analytics_returns_quiz_performance(monkeypatch):
    organization = make_org()
    instructor = make_user("instructor")
    analytics_data = {
        "course_id": 1,
        "total_students": 12,
        "active_students": 7,
        "completed_students": 4,
        "average_progress": 68.3,
        "total_lessons": 10,
        "completed_lessons": 156,
        "lesson_completion_rate": 78.0,
        "average_rating": 4.5,
        "review_count": 9,
        "rating_breakdown": {"5": 6, "4": 2, "3": 1},
        "quiz_performance": [
            {
                "quiz_id": 11,
                "title": "Intro Quiz",
                "total_attempts": 24,
                "average_score": 8.7,
                "pass_rate": 83.3,
            }
        ],
    }

    monkeypatch.setattr(auth_service, "get_organization_by_tenant", lambda db, tenant_id: organization)
    monkeypatch.setattr(dashboard_service, "get_course_analytics", lambda db, course_id, user: analytics_data)

    router = __import__("app.routers.dashboard", fromlist=["router"])
    result = router.get_course_analytics(
        course_id=1,
        tenant_id="tenant-1",
        db=None,
        current_user=instructor,
    )

    assert result["quiz_performance"] == analytics_data["quiz_performance"]
