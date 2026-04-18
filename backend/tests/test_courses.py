from types import SimpleNamespace

from app import schemas
from app.models import CourseLevel
from app.routers.courses import list_course_reviews, list_courses
from app.services import auth as auth_service
from app.services import courses as course_service


def make_org():
    return SimpleNamespace(id=1)


def make_user():
    return SimpleNamespace(id=42, organization_id=1, role_name="student", is_active=True, is_verified=True)


class FakeQuery:
    def __init__(self):
        self.filters = []
        self.order_by_args = None
        self.offset_val = None
        self.limit_val = None

    def filter(self, *args):
        self.filters.append(args)
        return self

    def order_by(self, *args):
        self.order_by_args = args
        return self

    def offset(self, value):
        self.offset_val = value
        return self

    def limit(self, value):
        self.limit_val = value
        return self

    def all(self):
        return ["result"]


def test_list_courses_forwards_query_params(monkeypatch):
    organization = make_org()
    student = make_user()

    monkeypatch.setattr(auth_service, "get_organization_by_tenant", lambda db, tenant_id: organization)

    def fake_get_organization_courses(
        db,
        organization_id,
        limit=50,
        offset=0,
        search=None,
        category_id=None,
        instructor_id=None,
        level=None,
        min_rating=None,
    ):
        assert organization_id == organization.id
        assert limit == 10
        assert offset == 5
        assert search == "python"
        assert category_id == 3
        assert instructor_id == 42
        assert level == CourseLevel.intermediate
        assert min_rating == 4.0
        return ["matched"]

    monkeypatch.setattr(course_service, "get_organization_courses", fake_get_organization_courses)

    result = list_courses(
        limit=10,
        offset=5,
        search="python",
        category_id=3,
        instructor_id=42,
        level=CourseLevel.intermediate,
        min_rating=4.0,
        tenant_id="tenant-1",
        db=None,
        current_user=student,
    )

    assert result == ["matched"]


def test_list_course_reviews_returns_only_approved(monkeypatch):
    organization = make_org()

    monkeypatch.setattr(auth_service, "get_organization_by_tenant", lambda db, tenant_id: organization)

    def fake_get_course_reviews(db, course_id, organization_id, limit=50, offset=0, approved_only=True):
        assert course_id == 1
        assert organization_id == organization.id
        assert approved_only is True
        return ["approved"]

    monkeypatch.setattr(course_service, "get_course_reviews", fake_get_course_reviews)
    monkeypatch.setattr(course_service, "get_course_by_id", lambda db, course_id, organization_id: SimpleNamespace(id=course_id, organization_id=organization.id))

    result = list_course_reviews(course_id=1, limit=5, offset=0, tenant_id="tenant-1", db=None)
    assert result == ["approved"]


def test_user_read_includes_rating_fields():
    user = SimpleNamespace(
        id=1,
        email="instructor@example.com",
        full_name="Instructor",
        role_name="instructor",
        is_active=True,
        is_verified=True,
        organization_id=1,
        average_rating=4.7,
        review_count=12,
    )
    result = schemas.UserRead.from_orm(user)

    assert result.average_rating == 4.7
    assert result.review_count == 12


def test_get_course_by_slug_returns_matching_course():
    class FakeQuery:
        def filter(self, *args):
            return self

        def one_or_none(self):
            return SimpleNamespace(id=7)

    class FakeDB:
        def query(self, model):
            return FakeQuery()

    course = course_service.get_course_by_slug(FakeDB(), "existing-slug", 1)

    assert course is not None
    assert course.id == 7


def test_get_course_by_slug_checks_all_courses_when_validating_slug():
    filter_calls = []

    class FakeQuery:
        def filter(self, *args):
            filter_calls.append(args)
            return self

        def one_or_none(self):
            return None

    class FakeDB:
        def query(self, model):
            return FakeQuery()

    course_service.get_course_by_slug(FakeDB(), "existing-slug", 1)

    assert len(filter_calls) == 1
    assert len(filter_calls[0]) == 2
