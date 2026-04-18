from datetime import datetime
from types import SimpleNamespace

from app.services import auth as auth_service
from app.services import gamification as gamification_service
from app import schemas


def make_org():
    return SimpleNamespace(id=1)


def make_user(role_name: str = "organization_admin"):
    return SimpleNamespace(
        id=42,
        organization_id=1,
        role_name=role_name,
        is_active=True,
        is_verified=True,
    )


def test_admin_create_badge(monkeypatch):
    organization = make_org()
    admin = make_user()
    badge_payload = schemas.BadgeCreate(name="Champion", description="Complete 10 lessons")
    badge = SimpleNamespace(
        id=1,
        organization_id=organization.id,
        name="Champion",
        description="Complete 10 lessons",
        icon=None,
        criteria=None,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )

    monkeypatch.setattr(auth_service, "get_organization_by_tenant", lambda db, tenant_id: organization)
    monkeypatch.setattr(gamification_service, "create_badge", lambda db, organization, payload: badge)

    router = __import__("app.routers.gamification", fromlist=["router"])
    result = router.create_badge(
        payload=badge_payload,
        tenant_id="tenant-1",
        db=None,
        current_user=admin,
    )

    assert result == badge
    assert result.name == "Champion"


def test_user_get_my_badges(monkeypatch):
    organization = make_org()
    user = make_user("user")
    badge = SimpleNamespace(
        id=1,
        badge=SimpleNamespace(
            id=5,
            name="Explorer",
            description="Visit a course",
            icon=None,
            criteria=None,
            organization_id=organization.id,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        ),
        awarded_at=datetime.utcnow(),
    )

    monkeypatch.setattr(auth_service, "get_organization_by_tenant", lambda db, tenant_id: organization)
    monkeypatch.setattr(gamification_service, "list_user_badges", lambda db, current_user: [badge])

    router = __import__("app.routers.gamification", fromlist=["router"])
    result = router.get_my_badges(
        tenant_id="tenant-1",
        db=None,
        current_user=user,
    )

    assert len(result) == 1
    assert result[0].badge.name == "Explorer"


def test_add_my_points(monkeypatch):
    organization = make_org()
    user = make_user("user")
    progress = SimpleNamespace(
        user_id=user.id,
        total_points=120.0,
        current_level=SimpleNamespace(id=2, name="Intermediate", description="Mid level", threshold_points=100.0),
        next_level_threshold=250.0,
        badges=[],
        achievements=[],
    )

    monkeypatch.setattr(auth_service, "get_organization_by_tenant", lambda db, tenant_id: organization)
    monkeypatch.setattr(gamification_service, "update_user_points", lambda db, current_user, points_delta: progress)

    router = __import__("app.routers.gamification", fromlist=["router"])
    payload = schemas.UserPointsUpdate(points_delta=50.0)
    result = router.add_my_points(
        payload=payload,
        tenant_id="tenant-1",
        db=None,
        current_user=user,
    )

    assert result.total_points == 120.0
    assert result.current_level.name == "Intermediate"


def test_admin_award_badge(monkeypatch):
    organization = make_org()
    admin = make_user()
    target_user = make_user("user")
    badge = SimpleNamespace(id=1, organization_id=organization.id)
    awarded = SimpleNamespace(id=1, badge=badge, awarded_at=datetime.utcnow())

    monkeypatch.setattr(auth_service, "get_organization_by_tenant", lambda db, tenant_id: organization)
    monkeypatch.setattr(gamification_service, "award_badge", lambda db, user, badge_obj: awarded)

    router = __import__("app.routers.gamification", fromlist=["router"])
    monkeypatch.setattr(router, "User", target_user.__class__)

    # Directly monkeypatch query path by replacing db.query on the router call is not needed for this interface test;
    # ensure the award route can be resolved and returns the expected object when the service is mocked.
    
    class FakeDB:
        def query(self, *_args, **kwargs):
            class Query:
                def __init__(self):
                    self._filters = {}

                def filter_by(self, **_kwargs):
                    self._filters = _kwargs
                    return self

                def first(self):
                    if self._filters.get("id") == target_user.id or self._filters.get("user_id") == target_user.id:
                        return target_user
                    return badge

            return Query()

    result = router.award_badge(
        user_id=target_user.id,
        badge_id=badge.id,
        tenant_id="tenant-1",
        db=FakeDB(),
        current_user=admin,
    )

    assert result == awarded


def test_trigger_gamification_event_matches_criteria(monkeypatch):
    user = make_user("user")
    badge = SimpleNamespace(id=1, organization_id=user.organization_id, criteria={"event": "lesson_completed", "min_count": 2})
    achievement = SimpleNamespace(id=2, organization_id=user.organization_id, criteria={"event": "course_completed", "course_id": 1})
    awarded_badge = SimpleNamespace(id=3, badge=badge)
    awarded_achievement = SimpleNamespace(id=4, achievement=achievement)

    class FakeQuery:
        def __init__(self, results):
            self._results = results

        def filter_by(self, **_kwargs):
            return self

        def all(self):
            return self._results

    class FakeDB:
        def query(self, model):
            if model is gamification_service.Badge:
                return FakeQuery([badge])
            if model is gamification_service.Achievement:
                return FakeQuery([achievement])
            raise ValueError("Unexpected model")

    monkeypatch.setattr(gamification_service, "award_badge", lambda db, current_user, badge_obj: awarded_badge)
    monkeypatch.setattr(gamification_service, "award_achievement", lambda db, current_user, achievement_obj: awarded_achievement)

    result = gamification_service.trigger_gamification_event(
        FakeDB(),
        user,
        "lesson_completed",
        {"lesson_id": 1, "course_id": 1, "count": 2},
    )

    assert result["badges"] == [awarded_badge]
    assert result["achievements"] == []

    result = gamification_service.trigger_gamification_event(
        FakeDB(),
        user,
        "course_completed",
        {"course_id": 1, "completed_lessons": 5, "total_lessons": 5},
    )

    assert result["badges"] == []
    assert result["achievements"] == [awarded_achievement]
