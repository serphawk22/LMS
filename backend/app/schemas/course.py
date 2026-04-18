from __future__ import annotations

import enum
from datetime import datetime
from typing import List

from pydantic import BaseModel, ConfigDict, Field, HttpUrl

from .user import UserRead
from .assignment import AssignmentRead
from .quiz import QuizRead
from .announcement import AnnouncementRead


class CourseLevel(str, enum.Enum):
    beginner = "beginner"
    intermediate = "intermediate"
    advanced = "advanced"


class CourseVisibility(str, enum.Enum):
    public = "public"
    private = "private"


class CourseCategoryRead(BaseModel):
    id: int
    name: str
    description: str | None = None

    model_config = ConfigDict(from_attributes=True)


class CourseTagRead(BaseModel):
    id: int
    name: str

    model_config = ConfigDict(from_attributes=True)


class CourseCategoryCreate(BaseModel):
    name: str
    description: str | None = None


class CourseCategoryUpdate(BaseModel):
    name: str | None = None
    description: str | None = None


class CourseTagCreate(BaseModel):
    name: str


class CourseTagUpdate(BaseModel):
    name: str | None = None


class ReviewBase(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    comment: str | None = None


class ReviewCreate(ReviewBase):
    pass


class ReviewModerationUpdate(BaseModel):
    is_featured: bool | None = None
    approved_at: datetime | None = None


class ReviewRead(BaseModel):
    id: int
    course_id: int
    rating: int
    comment: str | None = None
    is_featured: bool
    approved_at: datetime | None = None
    user: UserRead
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class InstructorCourseRead(BaseModel):
    course_id: int
    title: str
    slug: str
    thumbnail_url: str | None = None
    is_published: bool
    is_featured: bool
    owner_id: int | None = None
    instructor_count: int

    model_config = ConfigDict(from_attributes=True)


class EnrolledStudentRead(BaseModel):
    user_id: int
    full_name: str | None = None
    email: str | None = None
    progress: float
    status: str
    enrolled_at: datetime | None = None
    completed_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class AdminStudentActivitySummaryRead(BaseModel):
    user_id: int
    full_name: str | None = None
    email: str | None = None
    courses_enrolled: int
    assignments_submitted: int
    quizzes_attempted: int
    completion_progress: float
    last_login: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class AdminStudentActivityCourseRead(BaseModel):
    course_id: int
    title: str
    progress: float
    status: str
    enrolled_at: datetime | None = None
    completed_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class AdminStudentQuizAttemptRead(BaseModel):
    attempt_id: int
    quiz_id: int
    quiz_title: str | None = None
    course_title: str | None = None
    score: float
    passed: bool
    completed_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class AdminStudentAssignmentSubmissionRead(BaseModel):
    submission_id: int
    assignment_id: int
    assignment_title: str | None = None
    course_title: str | None = None
    grade: float | None = None
    status: str
    submitted_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class AdminStudentActivityDetailRead(BaseModel):
    overall_progress: float
    courses: List[AdminStudentActivityCourseRead]
    quiz_attempts: List[AdminStudentQuizAttemptRead]
    assignment_submissions: List[AdminStudentAssignmentSubmissionRead]

    model_config = ConfigDict(from_attributes=True)


class AdminInstructorActivitySummaryRead(BaseModel):
    user_id: int
    full_name: str | None = None
    email: str | None = None
    courses_created: int
    lessons_uploaded: int
    quizzes_created: int
    assignments_created: int
    students_enrolled: int

    model_config = ConfigDict(from_attributes=True)


class AdminInstructorCourseRead(BaseModel):
    course_id: int
    title: str
    status: str
    is_published: bool
    created_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class AdminInstructorLessonRead(BaseModel):
    lesson_id: int
    title: str
    course_id: int
    course_title: str | None = None
    created_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class AdminInstructorQuizRead(BaseModel):
    quiz_id: int
    title: str
    course_id: int
    course_title: str | None = None
    question_count: int
    created_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class AdminInstructorAssignmentRead(BaseModel):
    assignment_id: int
    title: str
    course_id: int
    course_title: str | None = None
    max_score: int
    created_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class AdminInstructorActivityDetailRead(BaseModel):
    courses: List[AdminInstructorCourseRead]
    lessons: List[AdminInstructorLessonRead]
    quizzes: List[AdminInstructorQuizRead]
    assignments: List[AdminInstructorAssignmentRead]
    total_students_enrolled: int

    model_config = ConfigDict(from_attributes=True)


class AdminCommentRead(BaseModel):
    id: int
    admin_name: str
    content: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AdminCommentCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=2000)


class AdminCommentTargetType(str, enum.Enum):
    student = "student"
    instructor = "instructor"


class AdminCommentCreateRequest(BaseModel):
    target_type: AdminCommentTargetType
    target_id: int
    comment: str = Field(..., min_length=1, max_length=2000)


class AdminCommentListRead(BaseModel):
    id: int
    target_type: str
    target_name: str | None = None
    comment: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CourseStudentProgressRead(BaseModel):
    user_id: int
    full_name: str | None = None
    email: str | None = None
    progress: float
    status: str
    completed_lessons: int
    enrolled_at: datetime | None = None
    completed_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class CourseAnalyticsRead(BaseModel):
    course_id: int
    total_students: int
    active_students: int
    completed_students: int
    average_progress: float
    total_lessons: int
    completed_lessons: int
    lesson_completion_rate: float
    average_rating: float
    review_count: int
    rating_breakdown: dict[str, int] = Field(default_factory=dict)
    quiz_performance: List[CourseQuizPerformanceItem] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class LessonContentType(str, enum.Enum):
    video_upload = "video_upload"
    youtube_embed = "youtube_embed"
    vimeo_embed = "vimeo_embed"
    pdf = "pdf"
    ppt = "ppt"
    doc = "doc"
    audio = "audio"
    text = "text"
    html = "html"
    external_link = "external_link"
    scorm = "scorm"
    live_link = "live_link"
    iframe_embed = "iframe_embed"

    @classmethod
    def _missing_(cls, value):
        if value == "video":
            return cls.video_upload
        return super()._missing_(value)


class LessonContentPayloadBase(BaseModel):
    model_config = ConfigDict(extra='allow')


class VideoUploadContent(LessonContentPayloadBase):
    file_url: HttpUrl
    mime_type: str | None = None
    file_size_bytes: int | None = None


class YouTubeEmbedContent(LessonContentPayloadBase):
    youtube_id: str
    start_time_seconds: int | None = None
    autoplay: bool | None = None


class VimeoEmbedContent(LessonContentPayloadBase):
    vimeo_id: str
    start_time_seconds: int | None = None


class PDFContent(LessonContentPayloadBase):
    file_url: HttpUrl
    page_count: int | None = None


class PPTContent(LessonContentPayloadBase):
    file_url: HttpUrl
    slide_count: int | None = None


class DOCContent(LessonContentPayloadBase):
    file_url: HttpUrl
    document_type: str | None = None


class AudioContent(LessonContentPayloadBase):
    file_url: HttpUrl
    duration_seconds: int | None = None


class TextContent(LessonContentPayloadBase):
    body: str


class HTMLContent(LessonContentPayloadBase):
    html: str


class ExternalLinkContent(LessonContentPayloadBase):
    url: HttpUrl
    title: str | None = None


class SCORMContent(LessonContentPayloadBase):
    package_url: HttpUrl
    version: str | None = None
    launch_parameters: dict | None = None


class LiveLinkContent(LessonContentPayloadBase):
    url: HttpUrl
    start_time: datetime | None = None
    duration_minutes: int | None = None
    host: str | None = None


class IframeEmbedContent(LessonContentPayloadBase):
    iframe_url: HttpUrl
    width: int | None = None
    height: int | None = None


LessonContentPayload = (
    VideoUploadContent
    | YouTubeEmbedContent
    | VimeoEmbedContent
    | PDFContent
    | PPTContent
    | DOCContent
    | AudioContent
    | TextContent
    | HTMLContent
    | ExternalLinkContent
    | SCORMContent
    | LiveLinkContent
    | IframeEmbedContent
    | dict
)


class ModuleCreate(BaseModel):
    course_id: int
    title: str
    description: str | None = None
    position: int | None = None


class ModuleUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    position: int | None = None


class LessonCreate(BaseModel):
    course_id: int
    module_id: int
    parent_lesson_id: int | None = None
    title: str
    content: str | None = None
    content_type: LessonContentType = LessonContentType.video_upload
    duration_minutes: int | None = None
    position: int | None = None
    content_payload: LessonContentPayload | None = None
    is_locked: bool = False
    is_mandatory: bool = False
    drip_enabled: bool = False
    available_at: datetime | None = None
    unlock_after_days: int | None = None
    prerequisite_ids: List[int] | None = None


class LessonCreateSimple(BaseModel):
    module_id: int
    title: str
    type: str
    video_url: str
    description: str | None = None
    duration: int | None = None
    resources: List[dict] | None = None


class Lesson(BaseModel):
    module_id: int
    title: str
    type: str
    video_url: str
    description: str
    duration: int


class LessonUpdate(BaseModel):
    module_id: int | None = None
    parent_lesson_id: int | None = None
    title: str | None = None
    content: str | None = None
    content_type: LessonContentType | None = None
    duration_minutes: int | None = None
    position: int | None = None
    content_payload: dict | None = None
    is_locked: bool | None = None
    is_mandatory: bool | None = None
    drip_enabled: bool | None = None
    available_at: datetime | None = None
    unlock_after_days: int | None = None
    prerequisite_ids: List[int] | None = None


class ModuleOrderUpdate(BaseModel):
    module_ids: List[int]


class LessonOrderUpdate(BaseModel):
    lesson_ids: List[int]


class LessonCompletionCreate(BaseModel):
    lesson_id: int


class LessonCompletionRead(BaseModel):
    id: int
    user_id: int
    course_id: int
    module_id: int
    lesson_id: int
    completed_at: datetime | None = None
    is_completed: bool

    model_config = ConfigDict(from_attributes=True)


class LessonRead(BaseModel):
    id: int
    course_id: int
    module_id: int
    parent_lesson_id: int | None = None
    title: str
    content: str | None = None
    content_type: LessonContentType
    duration_minutes: int | None = None
    position: int
    content_payload: LessonContentPayload | None = None
    video_url: str | None = None
    is_locked: bool
    is_mandatory: bool
    drip_enabled: bool
    available_at: datetime | None = None
    unlock_after_days: int | None = None
    prerequisite_ids: List[int] = Field(default_factory=list)
    children: List["LessonRead"] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CourseLessonRead(BaseModel):
    id: int
    title: str
    video_url: str | None = None
    description: str | None = None
    content_payload: LessonContentPayload | None = None

    model_config = ConfigDict(from_attributes=True)


class AdminStudentSubmissionRead(BaseModel):
    student_id: int
    student_name: str
    course_title: str
    assignment_or_quiz: str  # "Assignment: Title" or "Quiz: Title"
    submission_date: datetime
    admin_comment: str | None = None
    comment_id: int | None = None
    related_id: int  # assignment_submission_id or quiz_attempt_id
    comment_type: str  # "assignment_submission" or "quiz_attempt"

    model_config = ConfigDict(from_attributes=True)


class AdminInstructorActivityRead(BaseModel):
    instructor_id: int
    instructor_name: str
    course_title: str
    lessons_uploaded: int
    quizzes_created: int
    admin_feedback: str | None = None
    comment_id: int | None = None
    related_id: int  # course_id for instructor_course or instructor_activity
    comment_type: str  # "instructor_course" or "instructor_activity"

    model_config = ConfigDict(from_attributes=True)


class LiveSessionProvider(str, enum.Enum):
    manual = "manual"
    zoom = "zoom"
    google_meet = "google_meet"


class LiveSessionCreate(BaseModel):
    course_id: int
    title: str
    description: str | None = None
    scheduled_at: datetime
    duration_minutes: int | None = None
    instructor_id: int | None = None
    is_recurring: bool = False
    provider: LiveSessionProvider = LiveSessionProvider.manual
    provider_meeting_id: str | None = None
    provider_join_url: HttpUrl | None = None
    provider_start_url: HttpUrl | None = None
    provider_metadata: dict | None = None


class LiveSessionUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    scheduled_at: datetime | None = None
    duration_minutes: int | None = None
    instructor_id: int | None = None
    is_recurring: bool | None = None
    provider: LiveSessionProvider | None = None
    provider_meeting_id: str | None = None
    provider_join_url: HttpUrl | None = None
    provider_start_url: HttpUrl | None = None
    provider_metadata: dict | None = None


class LiveSessionRead(BaseModel):
    id: int
    course_id: int
    title: str
    description: str | None = None
    scheduled_at: datetime
    duration_minutes: int | None = None
    instructor_id: int | None = None
    provider: LiveSessionProvider
    provider_meeting_id: str | None = None
    provider_join_url: HttpUrl | None = None
    provider_start_url: HttpUrl | None = None
    provider_metadata: dict | None = None
    is_recurring: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class LiveSessionAttendanceCreate(BaseModel):
    status: str | None = None


class LiveSessionAttendanceRead(BaseModel):
    id: int
    user_id: int
    status: str
    attended_at: datetime


class StudentQuizScoreRead(BaseModel):
    title: str
    score: float | None = None
    total: float


class StudentAssignmentScoreRead(BaseModel):
    title: str
    score: float | None = None
    total: float
    reviewed: bool
    feedback: str | None = None
    status: str


class StudentCourseScoresRead(BaseModel):
    quizzes: List[StudentQuizScoreRead]
    assignments: List[StudentAssignmentScoreRead]

    model_config = ConfigDict(from_attributes=True)


class LiveSessionRecordingCreate(BaseModel):
    title: str
    duration_minutes: int | None = None
    notes: str | None = None


class LiveSessionRecordingRead(BaseModel):
    id: int
    title: str
    file_url: HttpUrl
    file_key: str
    duration_minutes: int | None = None
    notes: str | None = None
    uploaded_at: datetime
    uploaded_by_id: int | None = None

    model_config = ConfigDict(from_attributes=True)


class ModuleRead(BaseModel):
    id: int
    course_id: int
    title: str
    description: str | None = None
    position: int
    lessons: List[LessonRead] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class CourseStructureRead(BaseModel):
    id: int
    title: str
    slug: str
    description: str | None = None
    modules: List[ModuleRead] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class DashboardCourseItem(BaseModel):
    course_id: int
    title: str
    slug: str
    thumbnail_url: str | None = None
    progress: float
    status: str
    enrolled_at: datetime | None = None
    completed_at: datetime | None = None
    is_featured: bool
    total_items: int
    completed_items: int
    completed_lessons: int
    completed_quizzes: int
    completed_assignments: int

    model_config = ConfigDict(from_attributes=True)


class DashboardCertificateItem(BaseModel):
    id: int
    course_id: int
    course_title: str
    issued_at: datetime
    expires_at: datetime | None = None
    grade: str | None = None
    data: dict | None = None

    model_config = ConfigDict(from_attributes=True)


class DashboardNotificationItem(BaseModel):
    id: int
    title: str
    message: str | None = None
    status: str
    channel: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DashboardActivityItem(BaseModel):
    id: int
    activity_type: str
    course_id: int | None = None
    course_title: str | None = None
    description: str | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AdminDashboardOverviewRead(BaseModel):
    total_users: int
    total_courses: int
    total_organizations: int
    revenue: float
    active_users: int

    model_config = ConfigDict(from_attributes=True)


class StudentCourseDashboardRead(BaseModel):
    lessons: List[LessonRead] = Field(default_factory=list)
    assignments: List[AssignmentRead] = Field(default_factory=list)
    quizzes: List[QuizRead] = Field(default_factory=list)
    announcements: List[AnnouncementRead] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class StudentMarksRead(BaseModel):
    quizzes: List[StudentQuizScoreRead] = Field(default_factory=list)
    assignments: List[StudentAssignmentScoreRead] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class CourseQuizPerformanceItem(BaseModel):
    quiz_id: int
    title: str
    total_attempts: int
    average_score: float
    pass_rate: float

    model_config = ConfigDict(from_attributes=True)


class DashboardLearningPathProgressItem(BaseModel):
    learning_path_id: int
    title: str
    slug: str
    description: str | None = None
    completed_courses: int
    total_courses: int
    enrolled_courses: int
    progress: float

    model_config = ConfigDict(from_attributes=True)


class DashboardOverviewRead(BaseModel):
    enrolled_courses: List[DashboardCourseItem] = Field(default_factory=list)
    continue_learning: List[DashboardCourseItem] = Field(default_factory=list)
    completed_courses: List[DashboardCourseItem] = Field(default_factory=list)
    certificates: List[DashboardCertificateItem] = Field(default_factory=list)
    notifications: List[DashboardNotificationItem] = Field(default_factory=list)
    recommended_courses: List[DashboardCourseItem] = Field(default_factory=list)
    recent_activity: List[DashboardActivityItem] = Field(default_factory=list)
    learning_path_progress: List[DashboardLearningPathProgressItem] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class EnrollmentCreate(BaseModel):
    course_id: int


class EnrollmentRead(BaseModel):
    id: int
    user_id: int
    course_id: int
    status: str
    progress: float
    enrolled_at: datetime
    completed_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class CourseBase(BaseModel):
    title: str
    slug: str
    short_description: str | None = None
    description: str | None = None
    thumbnail_url: str | None = None
    objectives: List[str] | None = None
    requirements: List[str] | None = None
    level: CourseLevel = CourseLevel.beginner
    duration_minutes: int | None = None
    visibility: CourseVisibility = CourseVisibility.private
    status: str = "draft"
    is_published: bool = False
    price: float = 0.0
    category_id: int | None = None
    tag_ids: List[int] | None = None
    instructor_ids: List[int] | None = None
    owner_id: int | None = None
    is_featured: bool = False


class CourseCreate(CourseBase):
    pass


class CourseUpdate(BaseModel):
    title: str | None = None
    slug: str | None = None
    short_description: str | None = None
    description: str | None = None
    thumbnail_url: str | None = None
    objectives: List[str] | None = None
    requirements: List[str] | None = None
    level: CourseLevel | None = None
    duration_minutes: int | None = None
    visibility: CourseVisibility | None = None
    status: str | None = None
    is_published: bool | None = None
    price: float | None = None
    category_id: int | None = None
    tag_ids: List[int] | None = None
    instructor_ids: List[int] | None = None
    owner_id: int | None = None
    is_featured: bool | None = None


class CourseRead(BaseModel):
    id: int
    title: str
    slug: str
    short_description: str | None = None
    description: str | None = None
    thumbnail_url: str | None = None
    objectives: List[str] | None = None
    requirements: List[str] | None = None
    level: CourseLevel
    duration_minutes: int | None = None
    visibility: CourseVisibility
    status: str
    is_published: bool
    price: float
    category: CourseCategoryRead | None = None
    tags: List[CourseTagRead] = []
    instructors: List[UserRead] = []
    instructor_name: str | None = None
    owner_id: int | None = None
    average_rating: float
    review_count: int
    is_featured: bool
    syllabus: str | None = None
    lessons: List[CourseLessonRead] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
