from __future__ import annotations

import enum
import uuid
from sqlalchemy import (
    Boolean,
    Column,
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
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from app.database import Base


class TimestampMixin:
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
        index=True,
    )


class SoftDeleteMixin:
    is_deleted = Column(Boolean, nullable=False, default=False, server_default="false", index=True)
    deleted_at = Column(DateTime(timezone=True), nullable=True, index=True)


class OrganizationMixin:
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)


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


class LeaderboardMetric(str, enum.Enum):
    score = "score"
    completion_rate = "completion_rate"
    engagement = "engagement"
    quiz_accuracy = "quiz_accuracy"


course_instructors = Table(
    "course_instructors",
    Base.metadata,
    Column("course_id", UUID(as_uuid=True), ForeignKey("courses.id", ondelete="CASCADE"), primary_key=True),
    Column("user_id", UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("organization_id", UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True),
    Index("ix_course_instructors_org", "organization_id"),
)

course_tag_associations = Table(
    "course_tag_associations",
    Base.metadata,
    Column("course_id", UUID(as_uuid=True), ForeignKey("courses.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", UUID(as_uuid=True), ForeignKey("course_tags.id", ondelete="CASCADE"), primary_key=True),
    Column("organization_id", UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True),
    Index("ix_course_tag_associations_org", "organization_id"),
)

learning_path_courses = Table(
    "learning_path_courses",
    Base.metadata,
    Column("learning_path_id", UUID(as_uuid=True), ForeignKey("learning_paths.id", ondelete="CASCADE"), primary_key=True),
    Column("course_id", UUID(as_uuid=True), ForeignKey("courses.id", ondelete="CASCADE"), primary_key=True),
    Column("position", Float, nullable=False, default=0.0, server_default="0.0"),
    Column("organization_id", UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True),
    Index("ix_learning_path_courses_org", "organization_id"),
)


class Organization(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "organizations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"), index=True)
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
    certificates = relationship("Certificate", back_populates="organization", cascade="all, delete-orphan")
    live_sessions = relationship("LiveSession", back_populates="organization", cascade="all, delete-orphan")
    departments = relationship("Department", back_populates="organization", cascade="all, delete-orphan")
    invitations = relationship("Invitation", back_populates="organization", cascade="all, delete-orphan")
    settings = relationship("OrganizationSettings", back_populates="organization", cascade="all, delete-orphan", uselist=False)
    subscription = relationship("OrganizationSubscription", back_populates="organization", cascade="all, delete-orphan", uselist=False)
    groups = relationship("UserGroup", back_populates="organization", cascade="all, delete-orphan")
    leaderboards = relationship("Leaderboard", back_populates="organization", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_organizations_name", "name"),
        Index("ix_organizations_domain", "domain"),
    )


class Role(Base, TimestampMixin, SoftDeleteMixin, OrganizationMixin):
    __tablename__ = "roles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"), index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    permissions = Column(JSONB, nullable=True, default=list)

    organization = relationship("Organization", back_populates="roles")
    users = relationship("User", back_populates="role")

    __table_args__ = (
        UniqueConstraint("organization_id", "name", name="uq_role_org_name"),
        Index("ix_roles_org_name", "organization_id", "name"),
    )


class User(Base, TimestampMixin, SoftDeleteMixin, OrganizationMixin):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"), index=True)
    email = Column(String(255), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True, server_default="true")
    is_verified = Column(Boolean, nullable=False, default=False, server_default="false", index=True)
    is_staff = Column(Boolean, nullable=False, default=False, server_default="false")
    role_id = Column(UUID(as_uuid=True), ForeignKey("roles.id", ondelete="SET NULL"), nullable=True, index=True)

    organization = relationship("Organization", back_populates="users")
    role = relationship("Role", back_populates="users")
    department_id = Column(UUID(as_uuid=True), ForeignKey("departments.id", ondelete="SET NULL"), nullable=True, index=True)
    department = relationship("Department", back_populates="users", foreign_keys=[department_id])
    group_memberships = relationship("UserGroupMembership", back_populates="user", cascade="all, delete-orphan")
    enrollments = relationship("Enrollment", back_populates="user", cascade="all, delete-orphan")

    @property
    def role_name(self) -> str | None:
        return self.role.name if self.role else None
    quiz_attempts = relationship("QuizAttempt", back_populates="user", cascade="all, delete-orphan")
    assignment_submissions = relationship("AssignmentSubmission", back_populates="user", cascade="all, delete-orphan")
    reviews = relationship("Review", back_populates="user", cascade="all, delete-orphan")
    certificates = relationship("Certificate", back_populates="user", cascade="all, delete-orphan")
    payments = relationship("Payment", back_populates="user", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")
    badges = relationship("UserBadge", back_populates="user", cascade="all, delete-orphan")
    instructed_courses = relationship("Course", secondary=course_instructors, back_populates="instructors")

    __table_args__ = (
        UniqueConstraint("organization_id", "email", name="uq_user_org_email"),
        Index("ix_users_org_email", "organization_id", "email"),
    )


class Course(Base, TimestampMixin, SoftDeleteMixin, OrganizationMixin):
    __tablename__ = "courses"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"), index=True)
    title = Column(String(255), nullable=False)
    slug = Column(String(255), nullable=False)
    short_description = Column(String(512), nullable=True)
    description = Column(Text, nullable=True)
    thumbnail_url = Column(String(512), nullable=True)
    objectives = Column(JSONB, nullable=True, default=list)
    requirements = Column(JSONB, nullable=True, default=list)
    level = Column(Enum(CourseLevel), nullable=False, default=CourseLevel.beginner, server_default=CourseLevel.beginner.value)
    duration_minutes = Column(Float, nullable=True)
    visibility = Column(Enum(CourseVisibility), nullable=False, default=CourseVisibility.private, server_default=CourseVisibility.private.value)
    status = Column(Enum(CourseStatus), nullable=False, default=CourseStatus.draft, server_default=CourseStatus.draft.value)
    is_published = Column(Boolean, nullable=False, default=False, server_default="false")
    price = Column(Float, nullable=False, default=0.0, server_default="0.0")
    category_id = Column(UUID(as_uuid=True), ForeignKey("course_categories.id", ondelete="SET NULL"), nullable=True, index=True)
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    average_rating = Column(Float, nullable=False, default=0.0, server_default="0.0")
    review_count = Column(Float, nullable=False, default=0.0, server_default="0.0")
    is_featured = Column(Boolean, nullable=False, default=False, server_default="false")

    organization = relationship("Organization", back_populates="courses")
    owner = relationship("User")
    category = relationship("CourseCategory", back_populates="courses")
    instructors = relationship("User", secondary=course_instructors, back_populates="instructed_courses")
    tags = relationship("CourseTag", secondary="course_tag_associations", back_populates="courses")
    modules = relationship("Module", back_populates="course", cascade="all, delete-orphan")
    enrollments = relationship("Enrollment", back_populates="course", cascade="all, delete-orphan")
    quizzes = relationship("Quiz", back_populates="course", cascade="all, delete-orphan")
    assignments = relationship("Assignment", back_populates="course", cascade="all, delete-orphan")
    reviews = relationship("Review", back_populates="course", cascade="all, delete-orphan")
    certificates = relationship("Certificate", back_populates="course", cascade="all, delete-orphan")
    live_sessions = relationship("LiveSession", back_populates="course", cascade="all, delete-orphan")
    learning_paths = relationship("LearningPath", secondary=learning_path_courses, back_populates="courses")

    __table_args__ = (
        UniqueConstraint("organization_id", "slug", name="uq_course_org_slug"),
        Index("ix_courses_org_title", "organization_id", "title"),
    )


class Module(Base, TimestampMixin, SoftDeleteMixin, OrganizationMixin):
    __tablename__ = "modules"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"), index=True)
    course_id = Column(UUID(as_uuid=True), ForeignKey("courses.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    position = Column(Float, nullable=False, default=0.0, server_default="0.0")

    course = relationship("Course", back_populates="modules")
    lessons = relationship("Lesson", back_populates="module", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_modules_course_position", "course_id", "position"),
        UniqueConstraint("course_id", "title", name="uq_module_course_title"),
    )


class Lesson(Base, TimestampMixin, SoftDeleteMixin, OrganizationMixin):
    __tablename__ = "lessons"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"), index=True)
    module_id = Column(UUID(as_uuid=True), ForeignKey("modules.id", ondelete="CASCADE"), nullable=False, index=True)
    course_id = Column(UUID(as_uuid=True), ForeignKey("courses.id", ondelete="CASCADE"), nullable=False, index=True)
    parent_lesson_id = Column(UUID(as_uuid=True), ForeignKey("lessons.id", ondelete="SET NULL"), nullable=True, index=True)
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=True)
    lesson_type = Column(String(50), nullable=False, default="video_upload", server_default="video_upload")
    duration_minutes = Column(Float, nullable=True)
    position = Column(Float, nullable=False, default=0.0, server_default="0.0")
    resource_payload = Column(JSONB, nullable=True)
    is_locked = Column(Boolean, nullable=False, default=False, server_default="false")
    is_mandatory = Column(Boolean, nullable=False, default=False, server_default="false")
    drip_enabled = Column(Boolean, nullable=False, default=False, server_default="false")
    available_at = Column(DateTime(timezone=True), nullable=True)
    unlock_after_days = Column(Float, nullable=True)

    module = relationship("Module", back_populates="lessons")
    course = relationship("Course")
    parent_lesson = relationship("Lesson", remote_side=[id], back_populates="children")
    children = relationship("Lesson", back_populates="parent_lesson", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_lessons_module_position", "module_id", "position"),
        UniqueConstraint("module_id", "title", name="uq_lesson_module_title"),
    )


class Enrollment(Base, TimestampMixin, SoftDeleteMixin, OrganizationMixin):
    __tablename__ = "enrollments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"), index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    course_id = Column(UUID(as_uuid=True), ForeignKey("courses.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(Enum(EnrollmentStatus), nullable=False, default=EnrollmentStatus.active, server_default=EnrollmentStatus.active.value)
    progress = Column(Float, nullable=False, default=0.0, server_default="0.0")
    enrolled_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User", back_populates="enrollments")
    course = relationship("Course", back_populates="enrollments")

    __table_args__ = (
        UniqueConstraint("organization_id", "user_id", "course_id", name="uq_enrollment_org_user_course"),
        Index("ix_enrollments_org_user", "organization_id", "user_id"),
        Index("ix_enrollments_org_course", "organization_id", "course_id"),
    )


class Quiz(Base, TimestampMixin, SoftDeleteMixin, OrganizationMixin):
    __tablename__ = "quizzes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"), index=True)
    course_id = Column(UUID(as_uuid=True), ForeignKey("courses.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    total_points = Column(Float, nullable=False, default=0.0, server_default="0.0")
    passing_score = Column(Float, nullable=False, default=0.0, server_default="0.0")
    pass_percentage = Column(Float, nullable=False, default=0.0, server_default="0.0")
    time_limit_minutes = Column(Float, nullable=False, default=0.0, server_default="0.0")
    randomize_questions = Column(Boolean, nullable=False, default=False, server_default="false")
    question_count = Column(Float, nullable=False, default=0.0, server_default="0.0")
    max_attempts = Column(Float, nullable=False, default=0.0, server_default="0.0")
    auto_grade_enabled = Column(Boolean, nullable=False, default=True, server_default="true")
    published = Column(Boolean, nullable=False, default=False, server_default="false")
    due_date = Column(DateTime(timezone=True), nullable=True)

    course = relationship("Course", back_populates="quizzes")
    questions = relationship("Question", back_populates="quiz", cascade="all, delete-orphan")
    attempts = relationship("QuizAttempt", back_populates="quiz", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("organization_id", "course_id", "title", name="uq_quiz_course_title"),
        Index("ix_quizzes_org_course", "organization_id", "course_id"),
    )


class Question(Base, TimestampMixin, SoftDeleteMixin, OrganizationMixin):
    __tablename__ = "questions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"), index=True)
    quiz_id = Column(UUID(as_uuid=True), ForeignKey("quizzes.id", ondelete="CASCADE"), nullable=False, index=True)
    text = Column(Text, nullable=False)
    question_type = Column(Enum(QuestionType), nullable=False, default=QuestionType.multiple_choice, server_default=QuestionType.multiple_choice.value)
    choices = Column(JSONB, nullable=True)
    correct_answer = Column(JSONB, nullable=True)
    points = Column(Float, nullable=False, default=1.0, server_default="1.0")

    quiz = relationship("Quiz", back_populates="questions")

    __table_args__ = (
        Index("ix_questions_org_quiz", "organization_id", "quiz_id"),
    )


class QuizAttempt(Base, TimestampMixin, SoftDeleteMixin, OrganizationMixin):
    __tablename__ = "quiz_attempts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"), index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    quiz_id = Column(UUID(as_uuid=True), ForeignKey("quizzes.id", ondelete="CASCADE"), nullable=False, index=True)
    score = Column(Float, nullable=False, default=0.0, server_default="0.0")
    answers = Column(JSONB, nullable=True)
    attempt_number = Column(Float, nullable=False, default=1.0, server_default="1.0")
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

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"), index=True)
    course_id = Column(UUID(as_uuid=True), ForeignKey("courses.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    instructions = Column(Text, nullable=True)
    due_date = Column(DateTime(timezone=True), nullable=True)
    max_score = Column(Float, nullable=False, default=0.0, server_default="0.0")
    published = Column(Boolean, nullable=False, default=False, server_default="false")

    course = relationship("Course", back_populates="assignments")
    submissions = relationship("AssignmentSubmission", back_populates="assignment", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("organization_id", "course_id", "title", name="uq_assignment_course_title"),
        Index("ix_assignments_org_course", "organization_id", "course_id"),
    )


class AssignmentSubmission(Base, TimestampMixin, SoftDeleteMixin, OrganizationMixin):
    __tablename__ = "assignment_submissions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"), index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    assignment_id = Column(UUID(as_uuid=True), ForeignKey("assignments.id", ondelete="CASCADE"), nullable=False, index=True)
    submitted_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    content = Column(Text, nullable=True)
    attachments = Column(JSONB, nullable=True)
    grade = Column(Float, nullable=True)
    feedback = Column(Text, nullable=True)
    status = Column(Enum(AssignmentStatus), nullable=False, default=AssignmentStatus.submitted, server_default=AssignmentStatus.submitted.value)

    user = relationship("User", back_populates="assignment_submissions")
    assignment = relationship("Assignment", back_populates="submissions")

    __table_args__ = (
        UniqueConstraint("organization_id", "user_id", "assignment_id", name="uq_assignmentsubmission_org_user_assignment"),
        Index("ix_assignmentsubmissions_org_user", "organization_id", "user_id"),
    )


class CertificateTemplate(Base, TimestampMixin, SoftDeleteMixin, OrganizationMixin):
    __tablename__ = "certificate_templates"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"), index=True)
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

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"), index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    course_id = Column(UUID(as_uuid=True), ForeignKey("courses.id", ondelete="CASCADE"), nullable=False, index=True)
    template_id = Column(UUID(as_uuid=True), ForeignKey("certificate_templates.id", ondelete="SET NULL"), nullable=True, index=True)
    issued_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    grade = Column(String(64), nullable=True)
    verification_token = Column(String(255), nullable=False, unique=True, index=True)
    share_token = Column(String(255), nullable=True, unique=True, index=True)
    data = Column(JSONB, nullable=True)

    user = relationship("User", back_populates="certificates")
    course = relationship("Course", back_populates="certificates")
    template = relationship("CertificateTemplate", back_populates="certificates")

    __table_args__ = (
        UniqueConstraint("organization_id", "user_id", "course_id", name="uq_certificate_org_user_course"),
        Index("ix_certificates_org_user", "organization_id", "user_id"),
    )


class Payment(Base, TimestampMixin, SoftDeleteMixin, OrganizationMixin):
    __tablename__ = "payments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"), index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
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

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"), index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
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

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"), index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    course_id = Column(UUID(as_uuid=True), ForeignKey("courses.id", ondelete="CASCADE"), nullable=False, index=True)
    rating = Column(Float, nullable=False)
    comment = Column(Text, nullable=True)
    is_featured = Column(Boolean, nullable=False, default=False, server_default="false")
    approved_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User", back_populates="reviews")
    course = relationship("Course", back_populates="reviews")

    __table_args__ = (
        UniqueConstraint("organization_id", "user_id", "course_id", name="uq_review_org_user_course"),
        Index("ix_reviews_org_course", "organization_id", "course_id"),
    )


class LearningPath(Base, TimestampMixin, SoftDeleteMixin, OrganizationMixin):
    __tablename__ = "learning_paths"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"), index=True)
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


class LiveSession(Base, TimestampMixin, SoftDeleteMixin, OrganizationMixin):
    __tablename__ = "live_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"), index=True)
    course_id = Column(UUID(as_uuid=True), ForeignKey("courses.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    scheduled_at = Column(DateTime(timezone=True), nullable=False)
    duration_minutes = Column(Float, nullable=True)
    instructor_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    is_recurring = Column(Boolean, nullable=False, default=False, server_default="false")

    organization = relationship("Organization", back_populates="live_sessions")
    course = relationship("Course", back_populates="live_sessions")
    instructor = relationship("User")

    __table_args__ = (
        Index("ix_live_sessions_org_course", "organization_id", "course_id"),
    )


class Badge(Base, TimestampMixin, SoftDeleteMixin, OrganizationMixin):
    __tablename__ = "badges"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"), index=True)
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

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"), index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    badge_id = Column(UUID(as_uuid=True), ForeignKey("badges.id", ondelete="CASCADE"), nullable=False, index=True)
    awarded_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User", back_populates="badges")
    badge = relationship("Badge", back_populates="user_badges")

    __table_args__ = (
        UniqueConstraint("organization_id", "user_id", "badge_id", name="uq_user_badge_org_user_badge"),
        Index("ix_user_badges_org_user", "organization_id", "user_id"),
    )


class CourseCategory(Base, TimestampMixin, SoftDeleteMixin, OrganizationMixin):
    __tablename__ = "course_categories"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"), index=True)
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

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"), index=True)
    name = Column(String(255), nullable=False)

    organization = relationship("Organization", back_populates="course_tags")
    courses = relationship("Course", secondary=course_tag_associations, back_populates="tags")

    __table_args__ = (
        UniqueConstraint("organization_id", "name", name="uq_coursetag_org_name"),
        Index("ix_course_tags_org_name", "organization_id", "name"),
    )


class Department(Base, TimestampMixin, SoftDeleteMixin, OrganizationMixin):
    __tablename__ = "departments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"), index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    manager_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)

    organization = relationship("Organization", back_populates="departments")
    users = relationship("User", back_populates="department", foreign_keys=lambda: [User.department_id])
    manager = relationship("User", foreign_keys=[manager_id])

    __table_args__ = (
        UniqueConstraint("organization_id", "name", name="uq_department_org_name"),
        Index("ix_departments_org_name", "organization_id", "name"),
    )


class Invitation(Base, TimestampMixin, OrganizationMixin):
    __tablename__ = "invitations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"), index=True)
    email = Column(String(255), nullable=False, index=True)
    token = Column(String(255), nullable=False, unique=True, index=True)
    role_id = Column(UUID(as_uuid=True), ForeignKey("roles.id", ondelete="SET NULL"), nullable=True, index=True)
    department_id = Column(UUID(as_uuid=True), ForeignKey("departments.id", ondelete="SET NULL"), nullable=True, index=True)
    group_id = Column(UUID(as_uuid=True), ForeignKey("user_groups.id", ondelete="SET NULL"), nullable=True, index=True)
    invited_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    accepted_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
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

    @property
    def role_name(self) -> str | None:
        return self.role.name if self.role else None

    __table_args__ = (
        UniqueConstraint("organization_id", "email", name="uq_invitation_org_email"),
        Index("ix_invitations_org_email", "organization_id", "email"),
        Index("ix_invitations_org_token", "token"),
    )


class OrganizationSettings(Base, TimestampMixin):
    __tablename__ = "organization_settings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"), index=True)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    brand_name = Column(String(255), nullable=True)
    brand_color = Column(String(20), nullable=True)
    logo_url = Column(String(512), nullable=True)
    favicon_url = Column(String(512), nullable=True)
    custom_domain = Column(String(255), nullable=True, unique=True)
    storage_limit_mb = Column(Float, nullable=False, default=1024.0, server_default="1024.0")
    user_limit = Column(Float, nullable=False, default=50.0, server_default="50.0")
    billing_email = Column(String(255), nullable=True)
    support_email = Column(String(255), nullable=True)
    theme = Column(JSONB, nullable=True)
    extra_metadata = Column(JSONB, nullable=True)

    organization = relationship("Organization", back_populates="settings")


class OrganizationSubscription(Base, TimestampMixin):
    __tablename__ = "organization_subscriptions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"), index=True)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    plan = Column(String(100), nullable=False, default="starter", server_default="starter")
    status = Column(String(50), nullable=False, default="active", server_default="active")
    seats_allocated = Column(Float, nullable=False, default=50.0, server_default="50.0")
    seats_used = Column(Float, nullable=False, default=0.0, server_default="0.0")
    storage_allocated_mb = Column(Float, nullable=False, default=1024.0, server_default="1024.0")
    storage_used_mb = Column(Float, nullable=False, default=0.0, server_default="0.0")
    current_period_end = Column(DateTime(timezone=True), nullable=True)
    next_payment_date = Column(DateTime(timezone=True), nullable=True)
    provider = Column(String(100), nullable=True)
    provider_reference = Column(String(255), nullable=True)

    organization = relationship("Organization", back_populates="subscription")


class UserGroup(Base, TimestampMixin, SoftDeleteMixin, OrganizationMixin):
    __tablename__ = "user_groups"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"), index=True)
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

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"), index=True)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    group_id = Column(UUID(as_uuid=True), ForeignKey("user_groups.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String(100), nullable=True)

    group = relationship("UserGroup", back_populates="memberships")
    user = relationship("User", back_populates="group_memberships")

    __table_args__ = (
        UniqueConstraint("organization_id", "group_id", "user_id", name="uq_usergroupmembership_org_group_user"),
        Index("ix_usergroupmemberships_org_user", "organization_id", "user_id"),
    )


class LessonCompletion(Base, TimestampMixin, SoftDeleteMixin, OrganizationMixin):
    __tablename__ = "lesson_completions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"), index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    course_id = Column(UUID(as_uuid=True), ForeignKey("courses.id", ondelete="CASCADE"), nullable=False, index=True)
    module_id = Column(UUID(as_uuid=True), ForeignKey("modules.id", ondelete="CASCADE"), nullable=False, index=True)
    lesson_id = Column(UUID(as_uuid=True), ForeignKey("lessons.id", ondelete="CASCADE"), nullable=False, index=True)
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


class Leaderboard(Base, TimestampMixin, SoftDeleteMixin, OrganizationMixin):
    __tablename__ = "leaderboards"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"), index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    metric = Column(Enum(LeaderboardMetric), nullable=False, default=LeaderboardMetric.score, server_default=LeaderboardMetric.score.value)
    is_public = Column(Boolean, nullable=False, default=True, server_default="true")

    organization = relationship("Organization", back_populates="leaderboards")
    entries = relationship("LeaderBoardEntry", back_populates="leaderboard", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("organization_id", "name", name="uq_leaderboard_org_name"),
        Index("ix_leaderboards_org_name", "organization_id", "name"),
    )


class LeaderBoardEntry(Base, TimestampMixin, SoftDeleteMixin, OrganizationMixin):
    __tablename__ = "leaderboard_entries"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"), index=True)
    leaderboard_id = Column(UUID(as_uuid=True), ForeignKey("leaderboards.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    score = Column(Float, nullable=False, default=0.0, server_default="0.0")
    rank = Column(Float, nullable=False, default=0.0, server_default="0.0")

    leaderboard = relationship("Leaderboard", back_populates="entries")
    user = relationship("User")

    __table_args__ = (
        UniqueConstraint("organization_id", "leaderboard_id", "user_id", name="uq_leaderboardentry_org_board_user"),
        Index("ix_leaderboard_entries_org_user", "organization_id", "user_id"),
        Index("ix_leaderboard_entries_org_leaderboard", "organization_id", "leaderboard_id"),
    )


__all__ = [
    "Organization",
    "Role",
    "User",
    "Course",
    "CourseCategory",
    "CourseTag",
    "Module",
    "Lesson",
    "LessonCompletion",
    "Enrollment",
    "Quiz",
    "Question",
    "QuizAttempt",
    "Assignment",
    "AssignmentSubmission",
    "CertificateTemplate",
    "Certificate",
    "Payment",
    "Notification",
    "Review",
    "LearningPath",
    "LiveSession",
    "Badge",
    "UserBadge",
    "Department",
    "Invitation",
    "OrganizationSettings",
    "OrganizationSubscription",
    "UserGroup",
    "UserGroupMembership",
    "Leaderboard",
    "LeaderBoardEntry",
]
