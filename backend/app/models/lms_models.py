from __future__ import annotations

import enum
from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Table,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import declared_attr, relationship, synonym
from sqlalchemy.sql import func

from app.database import Base


class TimestampMixin:
    @declared_attr
    def created_at(cls):
        return Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)

    @declared_attr
    def updated_at(cls):
        return Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False, index=True)


class SoftDeleteMixin:
    @declared_attr
    def is_deleted(cls):
        return Column(Boolean, nullable=False, default=False, server_default="false", index=True)

    @declared_attr
    def deleted_at(cls):
        return Column(DateTime(timezone=True), nullable=True, index=True)


class OrganizationMixin:
    @declared_attr
    def organization_id(cls):
        return Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)


class CourseStatus(str, enum.Enum):
    draft = "draft"
    published = "published"
    archived = "archived"


class CourseLevel(str, enum.Enum):
    beginner = "beginner"
    intermediate = "intermediate"
    advanced = "advanced"


class CourseVisibility(str, enum.Enum):
    public = "public"
    private = "private"


class EnrollmentStatus(str, enum.Enum):
    pending = "pending"
    active = "active"
    completed = "completed"
    cancelled = "cancelled"


class PaymentStatus(str, enum.Enum):
    pending = "pending"
    succeeded = "succeeded"
    failed = "failed"
    refunded = "refunded"


class NotificationStatus(str, enum.Enum):
    unread = "unread"
    read = "read"


class LiveSessionProvider(str, enum.Enum):
    manual = "manual"
    zoom = "zoom"
    google_meet = "google_meet"
    microsoft_teams = "microsoft_teams"


class QuestionType(str, enum.Enum):
    multiple_choice = "multiple_choice"
    multiple_select = "multiple_select"
    true_false = "true_false"
    short_answer = "short_answer"
    long_answer = "long_answer"
    file_upload = "file_upload"
    coding_question = "coding_question"


class AssignmentStatus(str, enum.Enum):
    draft = "draft"
    published = "published"
    submitted = "submitted"
    graded = "graded"


class QuizAttemptStatus(str, enum.Enum):
    in_progress = "in_progress"
    submitted = "submitted"
    graded = "graded"
    pending_review = "pending_review"
    expired = "expired"


class LeaderboardMetric(str, enum.Enum):
    score = "score"
    completion_rate = "completion_rate"
    engagement = "engagement"
    quiz_accuracy = "quiz_accuracy"


course_instructors = Table(
    "course_instructors",
    Base.metadata,
    Column("course_id", Integer, ForeignKey("courses.id", ondelete="CASCADE"), primary_key=True),
    Column("user_id", Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("organization_id", Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True),
    Index("ix_course_instructors_org", "organization_id"),
)


course_tag_associations = Table(
    "course_tag_associations",
    Base.metadata,
    Column("course_id", Integer, ForeignKey("courses.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", Integer, ForeignKey("course_tags.id", ondelete="CASCADE"), primary_key=True),
    Column("organization_id", Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True),
    Index("ix_course_tag_associations_org", "organization_id"),
)


lesson_prerequisites = Table(
    "lesson_prerequisites",
    Base.metadata,
    Column("lesson_id", Integer, ForeignKey("lessons.id", ondelete="CASCADE"), primary_key=True),
    Column("prerequisite_id", Integer, ForeignKey("lessons.id", ondelete="CASCADE"), primary_key=True),
    Column("organization_id", Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True),
    Index("ix_lesson_prerequisites_org", "organization_id"),
)


class CourseCategory(Base, TimestampMixin, SoftDeleteMixin, OrganizationMixin):
    __tablename__ = "course_categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)

    organization = relationship("Organization", back_populates="course_categories")
    courses = relationship("Course", back_populates="category", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("organization_id", "name", name="uq_coursecategory_org_name"),
        Index("ix_course_categories_org_name", "organization_id", "name"),
    )


class CourseTag(Base, TimestampMixin, SoftDeleteMixin, OrganizationMixin):
    __tablename__ = "course_tags"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)

    organization = relationship("Organization", back_populates="course_tags")
    courses = relationship("Course", secondary=course_tag_associations, back_populates="tags")

    __table_args__ = (
        UniqueConstraint("organization_id", "name", name="uq_coursetag_org_name"),
        Index("ix_course_tags_org_name", "organization_id", "name"),
    )


class Organization(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "organizations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    slug = Column(String(255), nullable=False, unique=True, index=True)
    domain = Column(String(255), nullable=True, unique=True)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True, server_default="true")

    users = relationship("User", back_populates="organization", cascade="all, delete-orphan")
    courses = relationship("Course", back_populates="organization", cascade="all, delete-orphan")
    course_categories = relationship("CourseCategory", back_populates="organization", cascade="all, delete-orphan")
    course_tags = relationship("CourseTag", back_populates="organization", cascade="all, delete-orphan")
    roles = relationship("Role", back_populates="organization", cascade="all, delete-orphan")
    payments = relationship("Payment", back_populates="organization", cascade="all, delete-orphan")
    learning_paths = relationship("LearningPath", back_populates="organization", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="organization", cascade="all, delete-orphan")
    badges = relationship("Badge", back_populates="organization", cascade="all, delete-orphan")
    achievements = relationship("Achievement", back_populates="organization", cascade="all, delete-orphan")
    levels = relationship("LevelDefinition", back_populates="organization", cascade="all, delete-orphan")
    leaderboards = relationship("Leaderboard", back_populates="organization", cascade="all, delete-orphan")
    user_progress = relationship("UserProgress", back_populates="organization", cascade="all, delete-orphan")
    settings = relationship(
        "OrganizationSettings",
        back_populates="organization",
        cascade="all, delete-orphan",
        uselist=False,
    )
    subscription = relationship(
        "OrganizationSubscription",
        back_populates="organization",
        cascade="all, delete-orphan",
        uselist=False,
    )
    departments = relationship("Department", back_populates="organization", cascade="all, delete-orphan")
    groups = relationship("UserGroup", back_populates="organization", cascade="all, delete-orphan")
    invitations = relationship("Invitation", back_populates="organization", cascade="all, delete-orphan")
    announcements = relationship("Announcement", back_populates="organization", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_organizations_name", "name"),
        Index("ix_organizations_domain", "domain"),
    )


class OrganizationSettings(Base, TimestampMixin):
    __tablename__ = "organization_settings"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    brand_name = Column(String(255), nullable=True)
    brand_color = Column(String(20), nullable=True)
    logo_url = Column(String(512), nullable=True)
    favicon_url = Column(String(512), nullable=True)
    custom_domain = Column(String(255), nullable=True, unique=True)
    storage_limit_mb = Column(Integer, nullable=False, default=1024, server_default="1024")
    user_limit = Column(Integer, nullable=False, default=50, server_default="50")
    billing_email = Column(String(255), nullable=True)
    support_email = Column(String(255), nullable=True)
    theme = Column(JSONB, nullable=True)
    extra_metadata = Column(JSONB, nullable=True)

    organization = relationship("Organization", back_populates="settings")


class OrganizationSubscription(Base, TimestampMixin):
    __tablename__ = "organization_subscriptions"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    plan = Column(String(100), nullable=False, default="starter", server_default="starter")
    status = Column(String(50), nullable=False, default="active", server_default="active")
    seats_allocated = Column(Integer, nullable=False, default=50, server_default="50")
    seats_used = Column(Integer, nullable=False, default=0, server_default="0")
    storage_allocated_mb = Column(Integer, nullable=False, default=1024, server_default="1024")
    storage_used_mb = Column(Integer, nullable=False, default=0, server_default="0")
    current_period_end = Column(DateTime(timezone=True), nullable=True)
    next_payment_date = Column(DateTime(timezone=True), nullable=True)
    provider = Column(String(100), nullable=True)
    provider_reference = Column(String(255), nullable=True)

    organization = relationship("Organization", back_populates="subscription")


class Department(Base, TimestampMixin, SoftDeleteMixin, OrganizationMixin):
    __tablename__ = "departments"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    manager_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    organization = relationship("Organization", back_populates="departments")
    users = relationship("User", back_populates="department", foreign_keys=lambda: [User.department_id])
    manager = relationship("User", foreign_keys=[manager_id])

    __table_args__ = (
        UniqueConstraint("organization_id", "name", name="uq_department_org_name"),
        Index("ix_departments_org_name", "organization_id", "name"),
    )


class UserGroup(Base, TimestampMixin, SoftDeleteMixin, OrganizationMixin):
    __tablename__ = "user_groups"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)

    organization = relationship("Organization", back_populates="groups")
    memberships = relationship("UserGroupMembership", back_populates="group", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("organization_id", "name", name="uq_usergroup_org_name"),
        Index("ix_user_groups_org_name", "organization_id", "name"),
    )


class UserGroupMembership(Base, TimestampMixin):
    __tablename__ = "user_group_memberships"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    group_id = Column(Integer, ForeignKey("user_groups.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String(100), nullable=True)

    group = relationship("UserGroup", back_populates="memberships")
    user = relationship("User", back_populates="group_memberships")

    __table_args__ = (
        UniqueConstraint("organization_id", "group_id", "user_id", name="uq_usergroupmembership_org_group_user"),
        Index("ix_usergroupmemberships_org_user", "organization_id", "user_id"),
    )


class Invitation(Base, TimestampMixin):
    __tablename__ = "invitations"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    email = Column(String(255), nullable=False, index=True)
    token = Column(String(255), nullable=False, unique=True, index=True)
    role_id = Column(Integer, ForeignKey("roles.id", ondelete="SET NULL"), nullable=True)
    department_id = Column(Integer, ForeignKey("departments.id", ondelete="SET NULL"), nullable=True)
    group_id = Column(Integer, ForeignKey("user_groups.id", ondelete="SET NULL"), nullable=True)
    invited_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    accepted_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    accepted_at = Column(DateTime(timezone=True), nullable=True)
    message = Column(Text, nullable=True)
    is_revoked = Column(Boolean, nullable=False, default=False, server_default="false")

    organization = relationship("Organization", back_populates="invitations")
    role = relationship("Role")
    department = relationship("Department")
    group = relationship("UserGroup")
    invited_by = relationship("User", foreign_keys=[invited_by_id])
    accepted_user = relationship("User", foreign_keys=[accepted_user_id])

    __table_args__ = (
        UniqueConstraint("organization_id", "email", name="uq_invitation_org_email"),
        Index("ix_invitations_org_email", "organization_id", "email"),
        Index("ix_invitations_org_token", "token"),
    )


class Role(Base, TimestampMixin, SoftDeleteMixin, OrganizationMixin):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    permissions = Column(JSONB, nullable=True, default=list)

    organization = relationship("Organization", back_populates="roles")
    users = relationship("User", back_populates="role", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("organization_id", "name", name="uq_role_org_name"),
        Index("ix_roles_org_name", "organization_id", "name"),
    )


class User(Base, TimestampMixin, SoftDeleteMixin, OrganizationMixin):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True, server_default="true")
    is_verified = Column(Boolean, nullable=False, default=False, server_default="false", index=True)
    is_staff = Column(Boolean, nullable=False, default=False, server_default="false")
    role_id = Column(Integer, ForeignKey("roles.id", ondelete="SET NULL"), nullable=True)
    age = Column(Integer, nullable=True)
    joined_at = Column(Date, nullable=True)
    github_url = Column(String(255), nullable=True)
    linkedin_url = Column(String(255), nullable=True)
    avatar_url = Column(String(512), nullable=True)

    organization = relationship("Organization", back_populates="users")
    role = relationship("Role", back_populates="users")
    department_id = Column(Integer, ForeignKey("departments.id", ondelete="SET NULL"), nullable=True, index=True)
    department = relationship("Department", back_populates="users", foreign_keys=[department_id])
    average_rating = Column(Float, nullable=False, default=0.0, server_default="0.0")
    review_count = Column(Integer, nullable=False, default=0, server_default="0")
    group_memberships = relationship("UserGroupMembership", back_populates="user", cascade="all, delete-orphan")
    enrollments = relationship("Enrollment", back_populates="user", cascade="all, delete-orphan")
    quiz_attempts = relationship("QuizAttempt", back_populates="user", cascade="all, delete-orphan")
    assignment_submissions = relationship("AssignmentSubmission", back_populates="user", cascade="all, delete-orphan", foreign_keys="AssignmentSubmission.user_id")
    graded_submissions = relationship("AssignmentSubmission", back_populates="graded_by_user", foreign_keys="AssignmentSubmission.graded_by")
    reviews = relationship("Review", back_populates="user", cascade="all, delete-orphan")
    certificates = relationship("Certificate", back_populates="user", cascade="all, delete-orphan")
    payments = relationship("Payment", back_populates="user", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")
    badges = relationship("UserBadge", back_populates="user", cascade="all, delete-orphan")
    achievements = relationship("UserAchievement", back_populates="user", cascade="all, delete-orphan")
    progress = relationship("UserProgress", back_populates="user", uselist=False, cascade="all, delete-orphan")
    sessions = relationship("AuthSession", back_populates="user", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("organization_id", "email", name="uq_user_org_email"),
        Index("ix_users_org_email", "organization_id", "email"),
    )

    @property
    def role_name(self) -> str | None:
        return self.role.name if self.role else None


class Course(Base, TimestampMixin, SoftDeleteMixin, OrganizationMixin):
    __tablename__ = "courses"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    slug = Column(String(255), nullable=False)
    short_description = Column(String(512), nullable=True)
    description = Column(Text, nullable=True)
    thumbnail_url = Column(String(512), nullable=True)
    objectives = Column(JSONB, nullable=True, default=list)
    requirements = Column(JSONB, nullable=True, default=list)
    level = Column(Enum(CourseLevel), nullable=False, default=CourseLevel.beginner, server_default=CourseLevel.beginner.value)
    duration_minutes = Column(Integer, nullable=True)
    visibility = Column(Enum(CourseVisibility), nullable=False, default=CourseVisibility.private, server_default=CourseVisibility.private.value)
    status = Column(Enum(CourseStatus), nullable=False, default=CourseStatus.draft, server_default=CourseStatus.draft.value)
    is_published = Column(Boolean, nullable=False, default=False, server_default="false")
    price = Column(Float, nullable=False, default=0.0, server_default="0.0")
    category_id = Column(Integer, ForeignKey("course_categories.id", ondelete="SET NULL"), nullable=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    average_rating = Column(Float, nullable=False, default=0.0, server_default="0.0")
    review_count = Column(Integer, nullable=False, default=0, server_default="0")
    is_featured = Column(Boolean, nullable=False, default=False, server_default="false")

    @property
    def syllabus(self) -> str | None:
        if self.description:
            return self.description
        if self.objectives:
            if isinstance(self.objectives, list):
                return " \n".join(str(item) for item in self.objectives if item)
            return str(self.objectives)
        if self.requirements:
            if isinstance(self.requirements, list):
                return " \n".join(str(item) for item in self.requirements if item)
            return str(self.requirements)
        return None

    @property
    def instructor_name(self) -> str | None:
        if self.instructors:
            first_instructor = self.instructors[0]
            return first_instructor.full_name or first_instructor.email
        if self.owner:
            return self.owner.full_name or self.owner.email
        return None

    organization = relationship("Organization", back_populates="courses")
    owner = relationship("User", backref="courses_owned")
    category = relationship("CourseCategory", back_populates="courses")
    instructors = relationship("User", secondary=course_instructors, backref="instructed_courses")
    tags = relationship("CourseTag", secondary=course_tag_associations, back_populates="courses")
    modules = relationship("Module", back_populates="course", cascade="all, delete-orphan")
    enrollments = relationship("Enrollment", back_populates="course", cascade="all, delete-orphan")
    quizzes = relationship("Quiz", back_populates="course", cascade="all, delete-orphan")
    assignments = relationship("Assignment", back_populates="course", cascade="all, delete-orphan")
    reviews = relationship("Review", back_populates="course", cascade="all, delete-orphan")
    certifications = relationship("Certificate", back_populates="course", cascade="all, delete-orphan")
    learning_paths = relationship("LearningPath", secondary="learning_path_courses", back_populates="courses")

    __table_args__ = (
        UniqueConstraint("organization_id", "slug", name="uq_course_org_slug"),
        Index("ix_courses_org_title", "organization_id", "title"),
        Index("ix_courses_org_level", "organization_id", "level"),
    )


class Module(Base, TimestampMixin, SoftDeleteMixin, OrganizationMixin):
    __tablename__ = "modules"

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    position = Column(Integer, nullable=False, default=0, server_default="0")

    course = relationship("Course", back_populates="modules")
    lessons = relationship("Lesson", back_populates="module", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_modules_course_position", "course_id", "position"),
        UniqueConstraint("course_id", "title", name="uq_module_course_title"),
    )


class Lesson(Base, TimestampMixin, SoftDeleteMixin, OrganizationMixin):
    __tablename__ = "lessons"

    id = Column(Integer, primary_key=True, index=True)
    module_id = Column(Integer, ForeignKey("modules.id", ondelete="CASCADE"), nullable=False)
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    parent_lesson_id = Column(Integer, ForeignKey("lessons.id", ondelete="SET NULL"), nullable=True, index=True)
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=True)
    lesson_type = Column(String(50), nullable=False, default="video_upload")
    duration_minutes = Column(Integer, nullable=True)
    position = Column(Integer, nullable=False, default=0, server_default="0")
    resource_payload = Column(JSONB, nullable=True)
    is_locked = Column(Boolean, nullable=False, default=False, server_default="false")

    @property
    def content_type(self) -> str:
        return self.lesson_type

    @content_type.setter
    def content_type(self, value: str) -> None:
        self.lesson_type = value

    @property
    def content_payload(self) -> dict | None:
        return self.resource_payload

    @content_payload.setter
    def content_payload(self, value: dict | None) -> None:
        self.resource_payload = value
    is_mandatory = Column(Boolean, nullable=False, default=False, server_default="false")
    drip_enabled = Column(Boolean, nullable=False, default=False, server_default="false")
    available_at = Column(DateTime(timezone=True), nullable=True)
    unlock_after_days = Column(Integer, nullable=True)

    module = relationship("Module", back_populates="lessons")
    course = relationship("Course")
    parent_lesson = relationship("Lesson", remote_side=[id], back_populates="children")
    children = relationship("Lesson", back_populates="parent_lesson", cascade="all, delete-orphan")
    prerequisites = relationship(
        "Lesson",
        secondary=lesson_prerequisites,
        primaryjoin=id == lesson_prerequisites.c.lesson_id,
        secondaryjoin=id == lesson_prerequisites.c.prerequisite_id,
        backref="dependent_lessons",
    )

    @property
    def prerequisite_ids(self) -> list[int]:
        return [lesson.id for lesson in self.prerequisites]

    __table_args__ = (
        Index("ix_lessons_module_position", "module_id", "position"),
        UniqueConstraint("module_id", "title", name="uq_lesson_module_title"),
    )


class LessonCompletion(Base, TimestampMixin, SoftDeleteMixin, OrganizationMixin):
    __tablename__ = "lesson_completions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    module_id = Column(Integer, ForeignKey("modules.id", ondelete="CASCADE"), nullable=False)
    lesson_id = Column(Integer, ForeignKey("lessons.id", ondelete="CASCADE"), nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    is_completed = Column(Boolean, nullable=False, default=False, server_default="false")

    user = relationship("User")
    course = relationship("Course")
    module = relationship("Module")
    lesson = relationship("Lesson")

    __table_args__ = (
        UniqueConstraint("organization_id", "user_id", "lesson_id", name="uq_lessoncompletion_org_user_lesson"),
        Index("ix_lesson_completions_org_user", "organization_id", "user_id"),
        Index("ix_lesson_completions_org_course", "organization_id", "course_id"),
    )


class AuthSession(Base, TimestampMixin, SoftDeleteMixin, OrganizationMixin):
    __tablename__ = "auth_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    session_id = Column(String(100), nullable=False, unique=True, index=True)
    refresh_token_hash = Column(String(128), nullable=False)
    is_revoked = Column(Boolean, nullable=False, default=False, server_default="false", index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    last_used_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User", back_populates="sessions")


class Enrollment(Base, TimestampMixin, SoftDeleteMixin, OrganizationMixin):
    __tablename__ = "enrollments"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    status = Column(Enum(EnrollmentStatus), nullable=False, default=EnrollmentStatus.active, server_default=EnrollmentStatus.active.value)
    progress = Column(Float, nullable=False, default=0.0, server_default="0.0")
    enrolled_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User", back_populates="enrollments")
    course = relationship("Course", back_populates="enrollments")

    __table_args__ = (
        UniqueConstraint("organization_id", "user_id", "course_id", name="uq_enrollment_org_user_course"),
        Index("ix_enrollments_org_user", "organization_id", "user_id"),
    )


class Quiz(Base, TimestampMixin, SoftDeleteMixin, OrganizationMixin):
    __tablename__ = "quizzes"

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    total_points = Column(Integer, nullable=False, default=0, server_default="0")
    passing_score = Column(Integer, nullable=False, default=0, server_default="0")
    pass_percentage = Column(Integer, nullable=False, default=0, server_default="0")
    time_limit_minutes = Column(Integer, nullable=False, default=0, server_default="0")
    randomize_questions = Column(Boolean, nullable=False, default=False, server_default="false")
    question_count = Column(Integer, nullable=False, default=0, server_default="0")
    max_attempts = Column(Integer, nullable=False, default=0, server_default="0")
    auto_grade_enabled = Column(Boolean, nullable=False, default=True, server_default="true")
    published = Column(Boolean, nullable=False, default=False, server_default="false")
    start_time = Column(DateTime(timezone=True), nullable=True)
    due_date = Column(DateTime(timezone=True), nullable=True)

    course = relationship("Course", back_populates="quizzes")
    questions = relationship("Question", back_populates="quiz", cascade="all, delete-orphan")
    attempts = relationship("QuizAttempt", back_populates="quiz", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_quizzes_org_course", "organization_id", "course_id"),
        UniqueConstraint("organization_id", "course_id", "title", name="uq_quiz_course_title"),
    )


class QuestionBank(Base, TimestampMixin, SoftDeleteMixin, OrganizationMixin):
    __tablename__ = "question_banks"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)

    questions = relationship("Question", back_populates="bank", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("organization_id", "title", name="uq_question_bank_org_title"),
    )


class Question(Base, TimestampMixin, SoftDeleteMixin, OrganizationMixin):
    __tablename__ = "questions"

    id = Column(Integer, primary_key=True, index=True)
    quiz_id = Column(Integer, ForeignKey("quizzes.id", ondelete="CASCADE"), nullable=True)
    bank_id = Column(Integer, ForeignKey("question_banks.id", ondelete="CASCADE"), nullable=True, index=True)
    text = Column(Text, nullable=False)
    question_type = Column(Enum(QuestionType), nullable=False, default=QuestionType.multiple_choice, server_default=QuestionType.multiple_choice.value)
    choices = Column(JSONB, nullable=True)
    correct_answer = Column(JSONB, nullable=True)
    points = Column(Integer, nullable=False, default=0, server_default="0")

    quiz = relationship("Quiz", back_populates="questions")
    bank = relationship("QuestionBank", back_populates="questions")

    __table_args__ = (
        Index("ix_questions_org_quiz", "organization_id", "quiz_id"),
    )


class QuizAttempt(Base, TimestampMixin, SoftDeleteMixin, OrganizationMixin):
    __tablename__ = "quiz_attempts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    quiz_id = Column(Integer, ForeignKey("quizzes.id", ondelete="CASCADE"), nullable=False)
    score = Column(Float, nullable=False, default=0.0, server_default="0.0")
    answers = Column(JSONB, nullable=True)
    question_ids = Column(JSONB, nullable=True)
    attempt_number = Column(Integer, nullable=False, default=1, server_default="1")
    started_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    passed = Column(Boolean, nullable=False, default=False, server_default="false")
    auto_graded = Column(Boolean, nullable=False, default=False, server_default="false")
    status = Column(String(50), nullable=False, default="in_progress", server_default="in_progress")

    user = relationship("User", back_populates="quiz_attempts")
    quiz = relationship("Quiz", back_populates="attempts")

    __table_args__ = (
        Index("ix_quizattempts_org_user_quiz", "organization_id", "user_id", "quiz_id"),
        Index("ix_quizattempts_org_user", "organization_id", "user_id"),
    )


class Assignment(Base, TimestampMixin, SoftDeleteMixin, OrganizationMixin):
    __tablename__ = "assignments"

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    creator_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    title = Column(String(255), nullable=False)
    instructions = Column(Text, nullable=True)
    due_date = Column(DateTime(timezone=True), nullable=True)
    max_score = Column(Integer, nullable=False, default=0, server_default="0")
    published = Column(Boolean, nullable=False, default=False, server_default="false")
    allow_late_submission = Column(Boolean, nullable=False, default=False, server_default="false")
    attachments = Column(JSONB, nullable=True)

    course = relationship("Course", back_populates="assignments")
    creator = relationship("User", backref="created_assignments")
    submissions = relationship("AssignmentSubmission", back_populates="assignment", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_assignments_org_course", "organization_id", "course_id"),
        UniqueConstraint("organization_id", "course_id", "title", name="uq_assignment_course_title"),
    )


class AssignmentSubmission(Base, TimestampMixin, SoftDeleteMixin, OrganizationMixin):
    __tablename__ = "assignment_submissions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    assignment_id = Column(Integer, ForeignKey("assignments.id", ondelete="CASCADE"), nullable=False)
    submitted_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    content = Column(Text, nullable=True)
    attachments = Column(JSONB, nullable=True)
    grade = Column(Float, nullable=True)
    feedback = Column(Text, nullable=True)
    status = Column(Enum(AssignmentStatus), nullable=False, default=AssignmentStatus.submitted, server_default=AssignmentStatus.submitted.value)
    late = Column(Boolean, nullable=False, default=False, server_default="false")
    reviewed = Column(Boolean, nullable=False, default=False, server_default="false")
    graded_at = Column(DateTime(timezone=True), nullable=True)
    graded_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    user = relationship("User", back_populates="assignment_submissions", foreign_keys=[user_id])
    assignment = relationship("Assignment", back_populates="submissions")
    graded_by_user = relationship("User", back_populates="graded_submissions", foreign_keys=[graded_by])

    __table_args__ = (
        UniqueConstraint(
            "organization_id",
            "user_id",
            "assignment_id",
            name="uq_assignmentsubmission_org_user_assignment",
        ),
        Index("ix_assignmentsubmissions_org_user", "organization_id", "user_id"),
    )


class CertificateTemplate(Base, TimestampMixin, SoftDeleteMixin, OrganizationMixin):
    __tablename__ = "certificate_templates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    template_html = Column(Text, nullable=False)

    certificates = relationship("Certificate", back_populates="template")

    __table_args__ = (
        UniqueConstraint("organization_id", "name", name="uq_certificate_template_org_name"),
        Index("ix_certificate_templates_org_name", "organization_id", "name"),
    )


class Certificate(Base, TimestampMixin, SoftDeleteMixin, OrganizationMixin):
    __tablename__ = "certificates"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    template_id = Column(Integer, ForeignKey("certificate_templates.id", ondelete="SET NULL"), nullable=True)
    issued_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    grade = Column(String(64), nullable=True)
    verification_token = Column(String(255), nullable=False, unique=True, index=True)
    share_token = Column(String(255), nullable=True, unique=True, index=True)
    data = Column(JSONB, nullable=True)

    user = relationship("User", back_populates="certificates")
    course = relationship("Course", back_populates="certifications")
    template = relationship("CertificateTemplate", back_populates="certificates")

    __table_args__ = (
        UniqueConstraint("organization_id", "user_id", "course_id", name="uq_certificate_org_user_course"),
        Index("ix_certificates_org_user", "organization_id", "user_id"),
    )


class Payment(Base, TimestampMixin, SoftDeleteMixin, OrganizationMixin):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    amount = Column(Float, nullable=False, default=0.0, server_default="0.0")
    currency = Column(String(10), nullable=False, default="USD", server_default="USD")
    provider = Column(String(100), nullable=False)
    provider_reference = Column(String(255), nullable=True)
    status = Column(Enum(PaymentStatus), nullable=False, default=PaymentStatus.pending, server_default=PaymentStatus.pending.value)
    payment_metadata = Column(JSONB, nullable=True)

    organization = relationship("Organization", back_populates="payments")
    user = relationship("User", back_populates="payments")

    __table_args__ = (
        Index("ix_payments_org_status", "organization_id", "status"),
    )


class Notification(Base, TimestampMixin, SoftDeleteMixin, OrganizationMixin):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=True)
    status = Column(Enum(NotificationStatus), nullable=False, default=NotificationStatus.unread, server_default=NotificationStatus.unread.value)
    channel = Column(String(50), nullable=False, default="in_app", server_default="in_app")

    user = relationship("User", back_populates="notifications")
    organization = relationship("Organization", back_populates="notifications")

    __table_args__ = (
        Index("ix_notifications_org_user", "organization_id", "user_id"),
    )


class Review(Base, TimestampMixin, SoftDeleteMixin, OrganizationMixin):
    __tablename__ = "reviews"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    rating = Column(Integer, nullable=False)
    comment = Column(Text, nullable=True)
    is_featured = Column(Boolean, nullable=False, default=False, server_default="false")
    approved_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User", back_populates="reviews")
    course = relationship("Course", back_populates="reviews")

    __table_args__ = (
        UniqueConstraint("organization_id", "user_id", "course_id", name="uq_review_org_user_course"),
        Index("ix_reviews_org_course", "organization_id", "course_id"),
    )


class Announcement(Base, TimestampMixin, SoftDeleteMixin, OrganizationMixin):
    __tablename__ = "announcements"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="CASCADE"), nullable=True)
    priority = Column(String(20), nullable=False, default="normal", server_default="normal")
    target_audience = Column(String(50), nullable=False, default="all", server_default="all")
    published = Column(Boolean, nullable=False, default=False, server_default="false")
    published_at = Column(DateTime(timezone=True), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    created_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    created_by = relationship("User")
    organization = relationship("Organization", back_populates="announcements")

    __table_args__ = (
        Index("ix_announcements_org_published", "organization_id", "published"),
        Index("ix_announcements_org_priority", "organization_id", "priority"),
    )


learning_path_courses = Table(
    "learning_path_courses",
    Base.metadata,
    Column("learning_path_id", Integer, ForeignKey("learning_paths.id", ondelete="CASCADE"), primary_key=True),
    Column("course_id", Integer, ForeignKey("courses.id", ondelete="CASCADE"), primary_key=True),
    Column("position", Integer, nullable=False, default=0, server_default="0"),
    Column("created_at", DateTime(timezone=True), server_default=func.now(), nullable=False),
    Column("organization_id", Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True),
    Index("ix_learning_path_courses_org", "organization_id"),
)


class LearningPath(Base, TimestampMixin, SoftDeleteMixin, OrganizationMixin):
    __tablename__ = "learning_paths"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    slug = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    is_published = Column(Boolean, nullable=False, default=False, server_default="false")

    organization = relationship("Organization", back_populates="learning_paths")
    courses = relationship("Course", secondary=learning_path_courses, back_populates="learning_paths")

    __table_args__ = (
        UniqueConstraint("organization_id", "slug", name="uq_learning_path_org_slug"),
        Index("ix_learning_paths_org_title", "organization_id", "title"),
    )


class LiveClass(Base, TimestampMixin, SoftDeleteMixin, OrganizationMixin):
    __tablename__ = "live_classes"

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False, index=True)
    course_name = Column(String(255), nullable=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    scheduled_at = Column(DateTime(timezone=True), nullable=False)
    duration_minutes = Column(Integer, nullable=True)
    instructor_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    provider = Column(Enum(LiveSessionProvider), nullable=False, default=LiveSessionProvider.manual, server_default=LiveSessionProvider.manual.value)
    provider_meeting_id = Column(String(255), nullable=True)
    provider_join_url = Column(String(512), nullable=True)
    provider_start_url = Column(String(512), nullable=True)
    provider_metadata = Column(JSONB, nullable=True)
    is_recurring = Column(Boolean, nullable=False, default=False, server_default="false")

    instructor = relationship("User")
    attendances = relationship("LiveClassAttendance", back_populates="live_class", cascade="all, delete-orphan")
    recordings = relationship("LiveClassRecording", back_populates="live_class", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_live_classes_org_course", "organization_id", "course_name"),
    )


class LiveClassAttendance(Base, TimestampMixin, SoftDeleteMixin, OrganizationMixin):
    __tablename__ = "live_class_attendances"

    id = Column(Integer, primary_key=True, index=True)
    live_class_id = Column(Integer, ForeignKey("live_classes.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    attended_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    status = Column(String(50), nullable=False, default="present", server_default="present")

    live_class = relationship("LiveClass", back_populates="attendances")
    user = relationship("User")

    __table_args__ = (
        UniqueConstraint("organization_id", "live_class_id", "user_id", name="uq_live_class_attendance_org_session_user"),
        Index("ix_live_class_attendances_org_session", "organization_id", "live_class_id"),
    )


class LiveClassRecording(Base, TimestampMixin, SoftDeleteMixin, OrganizationMixin):
    __tablename__ = "live_class_recordings"

    id = Column(Integer, primary_key=True, index=True)
    live_class_id = Column(Integer, ForeignKey("live_classes.id", ondelete="CASCADE"), nullable=False, index=True)
    uploaded_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    title = Column(String(255), nullable=False)
    file_url = Column(String(512), nullable=False)
    file_key = Column(String(512), nullable=False)
    duration_minutes = Column(Float, nullable=True)
    notes = Column(Text, nullable=True)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)

    live_class = relationship("LiveClass", back_populates="recordings")
    uploaded_by = relationship("User")

    __table_args__ = (
        Index("ix_live_class_recordings_org_session", "organization_id", "live_class_id"),
    )


class Badge(Base, TimestampMixin, SoftDeleteMixin, OrganizationMixin):
    __tablename__ = "badges"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    icon = Column(String(255), nullable=True)
    criteria = Column(JSONB, nullable=True)

    organization = relationship("Organization", back_populates="badges")
    user_badges = relationship("UserBadge", back_populates="badge", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("organization_id", "name", name="uq_badge_org_name"),
        Index("ix_badges_org_name", "organization_id", "name"),
    )


class UserBadge(Base, TimestampMixin, SoftDeleteMixin, OrganizationMixin):
    __tablename__ = "user_badges"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    badge_id = Column(Integer, ForeignKey("badges.id", ondelete="CASCADE"), nullable=False)
    awarded_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User", back_populates="badges")
    badge = relationship("Badge", back_populates="user_badges")

    __table_args__ = (
        UniqueConstraint("organization_id", "user_id", "badge_id", name="uq_user_badge_org_user_badge"),
        Index("ix_user_badges_org_user", "organization_id", "user_id"),
    )


class Achievement(Base, TimestampMixin, SoftDeleteMixin, OrganizationMixin):
    __tablename__ = "achievements"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    icon = Column(String(255), nullable=True)
    criteria = Column(JSONB, nullable=True)
    points_reward = Column(Float, nullable=False, default=0.0, server_default="0.0")

    organization = relationship("Organization", back_populates="achievements")
    user_achievements = relationship("UserAchievement", back_populates="achievement", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("organization_id", "name", name="uq_achievement_org_name"),
        Index("ix_achievements_org_name", "organization_id", "name"),
    )


class UserAchievement(Base, TimestampMixin, SoftDeleteMixin, OrganizationMixin):
    __tablename__ = "user_achievements"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    achievement_id = Column(Integer, ForeignKey("achievements.id", ondelete="CASCADE"), nullable=False, index=True)
    awarded_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User", back_populates="achievements")
    achievement = relationship("Achievement", back_populates="user_achievements")

    __table_args__ = (
        UniqueConstraint("organization_id", "user_id", "achievement_id", name="uq_user_achievement_org_user_achievement"),
        Index("ix_user_achievements_org_user", "organization_id", "user_id"),
    )


class LevelDefinition(Base, TimestampMixin, SoftDeleteMixin, OrganizationMixin):
    __tablename__ = "level_definitions"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    threshold_points = Column(Float, nullable=False, default=0.0, server_default="0.0")

    organization = relationship("Organization", back_populates="levels")
    users = relationship("UserProgress", back_populates="level")

    __table_args__ = (
        UniqueConstraint("organization_id", "name", name="uq_level_org_name"),
        Index("ix_levels_org_threshold", "organization_id", "threshold_points"),
    )


class UserProgress(Base, TimestampMixin, SoftDeleteMixin, OrganizationMixin):
    __tablename__ = "user_progress"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    level_id = Column(Integer, ForeignKey("level_definitions.id", ondelete="SET NULL"), nullable=True, index=True)
    total_points = Column(Float, nullable=False, default=0.0, server_default="0.0")

    user = relationship("User", back_populates="progress")
    level = relationship("LevelDefinition", back_populates="users")
    organization = relationship("Organization", back_populates="user_progress")

    __table_args__ = (
        UniqueConstraint("organization_id", "user_id", name="uq_user_progress_org_user"),
        Index("ix_user_progress_org_user", "organization_id", "user_id"),
    )


class Leaderboard(Base, TimestampMixin, SoftDeleteMixin, OrganizationMixin):
    __tablename__ = "leaderboards"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    metric = Column(Enum(LeaderboardMetric), nullable=False, default=LeaderboardMetric.score, server_default=LeaderboardMetric.score.value)
    is_public = Column(Boolean, nullable=False, default=True, server_default="true")

    organization = relationship("Organization", back_populates="leaderboards")
    entries = relationship("LeaderboardEntry", back_populates="leaderboard", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("organization_id", "name", name="uq_leaderboard_org_name"),
        Index("ix_leaderboards_org_name", "organization_id", "name"),
    )


class LeaderboardEntry(Base, TimestampMixin, SoftDeleteMixin, OrganizationMixin):
    __tablename__ = "leaderboard_entries"

    id = Column(Integer, primary_key=True, index=True)
    leaderboard_id = Column(Integer, ForeignKey("leaderboards.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    score = Column(Float, nullable=False, default=0.0, server_default="0.0")
    rank = Column(Float, nullable=False, default=0.0, server_default="0.0")

    leaderboard = relationship("Leaderboard", back_populates="entries")
    user = relationship("User")

    __table_args__ = (
        UniqueConstraint("organization_id", "leaderboard_id", "user_id", name="uq_leaderboardentry_org_board_user"),
        Index("ix_leaderboard_entries_org_user", "organization_id", "user_id"),
        Index("ix_leaderboard_entries_org_leaderboard", "organization_id", "leaderboard_id"),
    )


class AdminCommentType(str, enum.Enum):
    assignment_submission = "assignment_submission"
    quiz_attempt = "quiz_attempt"
    instructor_course = "instructor_course"
    instructor_activity = "instructor_activity"
    student = "student"
    instructor = "instructor"


class AdminComment(Base, TimestampMixin, SoftDeleteMixin, OrganizationMixin):
    __tablename__ = "admin_comments"

    id = Column(Integer, primary_key=True, index=True)
    admin_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    comment_type = Column(Enum(AdminCommentType), nullable=False, index=True)
    related_id = Column(Integer, nullable=False, index=True)
    content = Column(Text, nullable=False)

    target_type = synonym("comment_type")
    target_id = synonym("related_id")
    comment = synonym("content")

    admin = relationship("User", backref="admin_comments")

    __table_args__ = (
        Index("ix_admin_comments_org_type_related", "organization_id", "comment_type", "related_id"),
        Index("ix_admin_comments_org_related_id", "organization_id", "related_id"),
    )


class DailyLearningVideo(Base, TimestampMixin, SoftDeleteMixin, OrganizationMixin):
    __tablename__ = "daily_learning_videos"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    description = Column(String(500), nullable=False)
    video_type = Column(String(32), nullable=False, default="upload", server_default="upload")
    video_url = Column(String(512), nullable=False)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)

    user = relationship("User")

    __table_args__ = (
        Index("ix_daily_learning_videos_org_user", "organization_id", "user_id"),
        Index("ix_daily_learning_videos_org_uploaded", "organization_id", "uploaded_at"),
    )
