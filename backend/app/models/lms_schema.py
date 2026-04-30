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
    String,
    Text,
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


class Organization(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "organizations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"), index=True)
    name = Column(String(255), nullable=False)
    slug = Column(String(255), nullable=False, unique=True, index=True)
    domain = Column(String(255), nullable=True, unique=True)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True, server_default="true")

    users = relationship("User", back_populates="organization", cascade="all, delete-orphan")
    roles = relationship("Role", back_populates="organization", cascade="all, delete-orphan")
    courses = relationship("Course", back_populates="organization", cascade="all, delete-orphan")
    enrollments = relationship("Enrollment", back_populates="organization", cascade="all, delete-orphan")
    quizzes = relationship("Quiz", back_populates="organization", cascade="all, delete-orphan")
    assignments = relationship("Assignment", back_populates="organization", cascade="all, delete-orphan")
    certificates = relationship("Certificate", back_populates="organization", cascade="all, delete-orphan")
    payments = relationship("Payment", back_populates="organization", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="organization", cascade="all, delete-orphan")
    reviews = relationship("Review", back_populates="organization", cascade="all, delete-orphan")
    learning_paths = relationship("LearningPath", back_populates="organization", cascade="all, delete-orphan")
    live_sessions = relationship("LiveSession", back_populates="organization", cascade="all, delete-orphan")
    badges = relationship("Badge", back_populates="organization", cascade="all, delete-orphan")
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
    role_id = Column(UUID(as_uuid=True), ForeignKey("roles.id", ondelete="SET NULL"), nullable=True, index=True)

    organization = relationship("Organization", back_populates="users")
    role = relationship("Role", back_populates="users")
    enrollments = relationship("Enrollment", back_populates="user", cascade="all, delete-orphan")
    quiz_attempts = relationship("QuizAttempt", back_populates="user", cascade="all, delete-orphan")
    submissions = relationship("Submission", back_populates="user", cascade="all, delete-orphan")
    certificates = relationship("Certificate", back_populates="user", cascade="all, delete-orphan")
    payments = relationship("Payment", back_populates="user", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")
    reviews = relationship("Review", back_populates="user", cascade="all, delete-orphan")
    badges = relationship("Badge", secondary="user_badges", back_populates="users")

    __table_args__ = (
        Index("ix_users_org_email", "organization_id", "email"),
    )


class Course(Base, TimestampMixin, SoftDeleteMixin, OrganizationMixin):
    __tablename__ = "courses"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"), index=True)
    title = Column(String(255), nullable=False)
    slug = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    short_description = Column(String(512), nullable=True)
    visibility = Column(Enum(CourseVisibility), nullable=False, default=CourseVisibility.private, server_default=CourseVisibility.private.value)
    status = Column(Enum(CourseStatus), nullable=False, default=CourseStatus.draft, server_default=CourseStatus.draft.value)
    price = Column(Float, nullable=False, default=0.0, server_default="0.0")
    duration_minutes = Column(Float, nullable=True)
    average_rating = Column(Float, nullable=False, default=0.0, server_default="0.0")
    review_count = Column(Float, nullable=False, default=0.0, server_default="0.0")
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)

    organization = relationship("Organization", back_populates="courses")
    owner = relationship("User")
    modules = relationship("Module", back_populates="course", cascade="all, delete-orphan")
    enrollments = relationship("Enrollment", back_populates="course", cascade="all, delete-orphan")
    quizzes = relationship("Quiz", back_populates="course", cascade="all, delete-orphan")
    assignments = relationship("Assignment", back_populates="course", cascade="all, delete-orphan")
    reviews = relationship("Review", back_populates="course", cascade="all, delete-orphan")
    certificates = relationship("Certificate", back_populates="course", cascade="all, delete-orphan")
    live_sessions = relationship("LiveSession", back_populates="course", cascade="all, delete-orphan")
    learning_paths = relationship("LearningPath", secondary="learning_path_courses", back_populates="courses")

    __table_args__ = (
        Index("ix_courses_org_slug", "organization_id", "slug"),
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
        Index("ix_modules_org_course_position", "organization_id", "course_id", "position"),
    )


class Lesson(Base, TimestampMixin, SoftDeleteMixin, OrganizationMixin):
    __tablename__ = "lessons"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"), index=True)
    module_id = Column(UUID(as_uuid=True), ForeignKey("modules.id", ondelete="CASCADE"), nullable=False, index=True)
    course_id = Column(UUID(as_uuid=True), ForeignKey("courses.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=True)
    position = Column(Float, nullable=False, default=0.0, server_default="0.0")
    duration_minutes = Column(Float, nullable=True)
    lesson_type = Column(String(100), nullable=False, default="video", server_default="video")
    is_optional = Column(Boolean, nullable=False, default=False, server_default="false")

    module = relationship("Module", back_populates="lessons")
    course = relationship("Course")

    __table_args__ = (
        Index("ix_lessons_org_module_position", "organization_id", "module_id", "position"),
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

    organization = relationship("Organization", back_populates="enrollments")
    user = relationship("User", back_populates="enrollments")
    course = relationship("Course", back_populates="enrollments")

    __table_args__ = (
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
    time_limit_minutes = Column(Float, nullable=False, default=0.0, server_default="0.0")
    is_published = Column(Boolean, nullable=False, default=False, server_default="false")
    max_attempts = Column(Float, nullable=False, default=1.0, server_default="1.0")
    randomize_questions = Column(Boolean, nullable=False, default=False, server_default="false")

    organization = relationship("Organization", back_populates="quizzes")
    course = relationship("Course", back_populates="quizzes")
    questions = relationship("Question", back_populates="quiz", cascade="all, delete-orphan")
    attempts = relationship("QuizAttempt", back_populates="quiz", cascade="all, delete-orphan")

    __table_args__ = (
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

    user = relationship("User", back_populates="quiz_attempts")
    quiz = relationship("Quiz", back_populates="attempts")

    __table_args__ = (
        Index("ix_quiz_attempts_org_user", "organization_id", "user_id"),
        Index("ix_quiz_attempts_org_quiz", "organization_id", "quiz_id"),
    )


class Assignment(Base, TimestampMixin, SoftDeleteMixin, OrganizationMixin):
    __tablename__ = "assignments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"), index=True)
    course_id = Column(UUID(as_uuid=True), ForeignKey("courses.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    instructions = Column(Text, nullable=True)
    max_score = Column(Float, nullable=False, default=0.0, server_default="0.0")
    due_date = Column(DateTime(timezone=True), nullable=True)
    is_published = Column(Boolean, nullable=False, default=False, server_default="false")

    organization = relationship("Organization", back_populates="assignments")
    course = relationship("Course", back_populates="assignments")
    submissions = relationship("Submission", back_populates="assignment", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_assignments_org_course", "organization_id", "course_id"),
    )


class Submission(Base, TimestampMixin, SoftDeleteMixin, OrganizationMixin):
    __tablename__ = "submissions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"), index=True)
    assignment_id = Column(UUID(as_uuid=True), ForeignKey("assignments.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    submitted_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    content = Column(Text, nullable=True)
    attachments = Column(JSONB, nullable=True)
    grade = Column(Float, nullable=True)
    feedback = Column(Text, nullable=True)
    status = Column(Enum(AssignmentStatus), nullable=False, default=AssignmentStatus.submitted, server_default=AssignmentStatus.submitted.value)

    assignment = relationship("Assignment", back_populates="submissions")
    user = relationship("User", back_populates="submissions")

    __table_args__ = (
        Index("ix_submissions_org_user", "organization_id", "user_id"),
        Index("ix_submissions_org_assignment", "organization_id", "assignment_id"),
    )


class Certificate(Base, TimestampMixin, SoftDeleteMixin, OrganizationMixin):
    __tablename__ = "certificates"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"), index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    course_id = Column(UUID(as_uuid=True), ForeignKey("courses.id", ondelete="CASCADE"), nullable=False, index=True)
    issued_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    grade = Column(String(64), nullable=True)
    verification_token = Column(String(255), nullable=False, unique=True, index=True)
    data = Column(JSONB, nullable=True)

    organization = relationship("Organization", back_populates="certificates")
    user = relationship("User", back_populates="certificates")
    course = relationship("Course", back_populates="certificates")

    __table_args__ = (
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
    metadata = Column(JSONB, nullable=True)

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
    sent_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    read_at = Column(DateTime(timezone=True), nullable=True)

    organization = relationship("Organization", back_populates="notifications")
    user = relationship("User", back_populates="notifications")

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
    approved_at = Column(DateTime(timezone=True), nullable=True)

    organization = relationship("Organization", back_populates="reviews")
    user = relationship("User", back_populates="reviews")
    course = relationship("Course", back_populates="reviews")

    __table_args__ = (
        Index("ix_reviews_org_course", "organization_id", "course_id"),
        Index("ix_reviews_org_user", "organization_id", "user_id"),
    )


class LearningPath(Base, TimestampMixin, SoftDeleteMixin, OrganizationMixin):
    __tablename__ = "learning_paths"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"), index=True)
    title = Column(String(255), nullable=False)
    slug = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    is_published = Column(Boolean, nullable=False, default=False, server_default="false")

    organization = relationship("Organization", back_populates="learning_paths")
    courses = relationship("Course", secondary="learning_path_courses", back_populates="learning_paths")

    __table_args__ = (
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
    users = relationship("User", secondary="user_badges", back_populates="badges")

    __table_args__ = (
        Index("ix_badges_org_name", "organization_id", "name"),
    )


class Leaderboard(Base, TimestampMixin, SoftDeleteMixin, OrganizationMixin):
    __tablename__ = "leaderboards"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"), index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    metric = Column(Enum(LeaderboardMetric), nullable=False, default=LeaderboardMetric.score, server_default=LeaderboardMetric.score.value)
    is_public = Column(Boolean, nullable=False, default=True, server_default="true")

    organization = relationship("Organization", back_populates="leaderboards")
    entries = relationship("LeaderboardEntry", back_populates="leaderboard", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_leaderboards_org_name", "organization_id", "name"),
    )


class LeaderboardEntry(Base, TimestampMixin, SoftDeleteMixin, OrganizationMixin):
    __tablename__ = "leaderboard_entries"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"), index=True)
    leaderboard_id = Column(UUID(as_uuid=True), ForeignKey("leaderboards.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    score = Column(Float, nullable=False, default=0.0, server_default="0.0")
    rank = Column(Float, nullable=False, default=0.0, server_default="0.0")

    leaderboard = relationship("Leaderboard", back_populates="entries")
    user = relationship("User")

    __table_args__ = (
        Index("ix_leaderboard_entries_org_user", "organization_id", "user_id"),
        Index("ix_leaderboard_entries_org_leaderboard", "organization_id", "leaderboard_id"),
    )


class LearningPathCourse(Base):
    __tablename__ = "learning_path_courses"

    learning_path_id = Column(UUID(as_uuid=True), ForeignKey("learning_paths.id", ondelete="CASCADE"), primary_key=True)
    course_id = Column(UUID(as_uuid=True), ForeignKey("courses.id", ondelete="CASCADE"), primary_key=True)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)

    __table_args__ = (
        Index("ix_learning_path_courses_org", "organization_id"),
    )


class UserBadge(Base):
    __tablename__ = "user_badges"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    badge_id = Column(UUID(as_uuid=True), ForeignKey("badges.id", ondelete="CASCADE"), primary_key=True)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    awarded_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        Index("ix_user_badges_org", "organization_id"),
    )
