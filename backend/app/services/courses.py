from datetime import datetime
from typing import List, Any

from pydantic import BaseModel, ValidationError
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.models import Assignment, AssignmentSubmission, Course, CourseCategory, CourseLevel, CourseTag, Enrollment, EnrollmentStatus, Lesson, LessonCompletion, LiveClass, LiveClassAttendance, LiveClassRecording, LiveSessionProvider, Module, Organization, Quiz, QuizAttempt, Review, Role, User
from app.models.lms_models import course_instructors, course_tag_associations
from app.schemas.course import (
    AudioContent,
    CourseCreate,
    CourseUpdate,
    CourseVisibility,
    DOCContent,
    ExternalLinkContent,
    HTMLContent,
    IframeEmbedContent,
    LessonContentPayload,
    LessonContentType,
    LessonCreate,
    LessonUpdate,
    LiveLinkContent,
    LiveSessionCreate,
    LiveSessionUpdate,
    ModuleCreate,
    ModuleUpdate,
    PPTContent,
    PDFContent,
    ReviewCreate,
    SCORMContent,
    TextContent,
    VideoUploadContent,
    VimeoEmbedContent,
    YouTubeEmbedContent,
)
from app.services import certificates as certificate_service, gamification as gamification_service


def get_organization_courses(
    db: Session,
    organization_id: int,
    limit: int = 50,
    offset: int = 0,
    search: str | None = None,
    category_id: int | None = None,
    instructor_id: int | None = None,
    level: CourseLevel | None = None,
    min_rating: float | None = None,
) -> List[Course]:
    query = db.query(Course).filter(Course.organization_id == organization_id, Course.is_deleted == False)

    if search:
        search_pattern = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Course.title.ilike(search_pattern),
                Course.short_description.ilike(search_pattern),
                Course.description.ilike(search_pattern),
            )
        )

    if category_id is not None:
        query = query.filter(Course.category_id == category_id)

    if instructor_id is not None:
        query = query.filter(Course.instructors.any(User.id == instructor_id))

    if level is not None:
        query = query.filter(Course.level == level)

    if min_rating is not None:
        query = query.filter(Course.average_rating >= min_rating)

    return (
        query.order_by(Course.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )


def get_course_by_id(db: Session, course_id: int, organization_id: int) -> Course | None:
    return (
        db.query(Course)
        .filter(Course.id == course_id, Course.organization_id == organization_id, Course.is_deleted == False)
        .one_or_none()
    )


def get_course_by_slug(db: Session, slug: str, organization_id: int, exclude_course_id: int | None = None) -> Course | None:
    query = db.query(Course).filter(Course.slug == slug, Course.organization_id == organization_id)
    if exclude_course_id is not None:
        query = query.filter(Course.id != exclude_course_id)
    return query.one_or_none()


def create_course(db: Session, organization, creator: User, payload: CourseCreate) -> Course:
    # Ensure User is available in this scope
    from app.models import User as UserModel
    
    if get_course_by_slug(db, payload.slug, organization.id):
        raise ValueError("A course with this slug already exists for the organization.")
    category = None
    if payload.category_id is not None:
        category = (
            db.query(CourseCategory)
            .filter(CourseCategory.id == payload.category_id, CourseCategory.organization_id == organization.id, CourseCategory.is_deleted == False)
            .one_or_none()
        )
        if category is None:
            raise ValueError("Category not found for the organization.")

    tags = []
    if payload.tag_ids:
        tags = (
            db.query(CourseTag)
            .filter(CourseTag.organization_id == organization.id, CourseTag.id.in_(payload.tag_ids), CourseTag.is_deleted == False)
            .all()
        )
        if len(tags) != len(set(payload.tag_ids)):
            raise ValueError("One or more course tags were not found for the organization.")

    instructors = []
    if payload.instructor_ids:
        instructors = (
            db.query(UserModel)
            .filter(UserModel.organization_id == organization.id, UserModel.id.in_(payload.instructor_ids), UserModel.is_deleted == False)
            .all()
        )
        if len(instructors) != len(set(payload.instructor_ids)):
            raise ValueError("One or more instructors were not found for the organization.")
    else:
        instructors = [creator]

    course = Course(
        title=payload.title,
        slug=payload.slug,
        short_description=payload.short_description,
        description=payload.description,
        thumbnail_url=payload.thumbnail_url,
        objectives=payload.objectives,
        requirements=payload.requirements,
        level=payload.level,
        duration_minutes=payload.duration_minutes,
        visibility=payload.visibility,
        status=payload.status,
        is_published=payload.is_published,
        price=payload.price,
        is_featured=payload.is_featured,
        category=category,
        organization_id=organization.id,
        owner_id=payload.owner_id if payload.owner_id is not None else creator.id,
    )

    db.add(course)
    db.flush()

    if tags:
        db.execute(
            course_tag_associations.insert(),
            [
                {
                    "course_id": course.id,
                    "tag_id": tag.id,
                    "organization_id": organization.id,
                }
                for tag in tags
            ],
        )

    if instructors:
        db.execute(
            course_instructors.insert(),
            [
                {
                    "course_id": course.id,
                    "user_id": instructor.id,
                    "organization_id": organization.id,
                }
                for instructor in instructors
            ],
        )

    db.commit()
    db.refresh(course)

    try:
        from app.services.dashboard import create_notifications_for_users
        from app.models import User as UserModel

        if course.published:
            user_ids = [
                user.id
                for user in db.query(UserModel)
                .filter(
                    UserModel.organization_id == organization.id,
                    UserModel.is_deleted == False,
                )
                .all()
            ]
            if user_ids:
                create_notifications_for_users(
                    db,
                    user_ids,
                    organization.id,
                    f"Course published: {course.title}",
                    f"A new course is now available: {course.title}.",
                )
    except Exception:
        pass

    return course


def ensure_default_excel_course(db: Session, organization: Organization) -> Course | None:
    # Use organization-specific slug to avoid conflicts
    course_slug = f"{organization.slug}-microsoft-excel-fundamentals"
    existing = get_course_by_slug(db, course_slug, organization.id)
    if existing:
        return existing

    owner = (
        db.query(User)
        .filter(User.organization_id == organization.id, User.is_deleted == False)
        .order_by(User.id)
        .first()
    )
    if not owner:
        return None

    # Check if category exists, if not create it
    existing_category = (
        db.query(CourseCategory)
        .filter(CourseCategory.organization_id == organization.id, CourseCategory.name == 'Microsoft Excel', CourseCategory.is_deleted == False)
        .one_or_none()
    )
    if existing_category:
        category = existing_category
    else:
        category = create_course_category(db, organization, 'Microsoft Excel', 'Microsoft Excel fundamentals and skills')

    course_payload = CourseCreate(
        title='Microsoft Excel Fundamentals',
        slug=course_slug,
        short_description='Learn Microsoft Excel step-by-step including formulas, functions, charts, and data analysis.',
        description=(
            'Master Microsoft Excel from the basics through formulas, functions, charts, and data analysis. '
            'This course is designed to build practical skills that help you confidently use Excel for everyday tasks.'
        ),
        thumbnail_url='https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80',
        objectives=[
            'Understand Excel basics, interface, and navigation.',
            'Build and use formulas and functions for calculations.',
            'Analyze data using filtering, sorting, and pivot tables.',
            'Create charts and dashboards for data visualization.',
        ],
        requirements=['Basic computer literacy'],
        level=CourseLevel.beginner,
        duration_minutes=120,
        visibility=CourseVisibility.public,
        status='published',
        is_published=True,
        price=0.0,
        category_id=category.id,
        instructor_ids=[owner.id],
        owner_id=owner.id,
        is_featured=True,
    )

    course = create_course(db, organization, owner, course_payload)

    modules = [
        {
            'title': 'Module 1: Excel Basics',
            'description': 'Learn the spreadsheet interface, cells, ranges, rows, and columns.',
            'lessons': [
                {'title': 'Introduction to Excel', 'content': 'Get started with Excel and learn why it is one of the most powerful tools for data organization and analysis.'},
                {'title': 'Excel Interface', 'content': 'Explore the ribbon, workbook, worksheet, formula bar, name box, and status bar.'},
                {'title': 'Rows and Columns', 'content': 'Understand how rows and columns organize data and how to insert, resize, and manage them.'},
                {'title': 'Cells and Ranges', 'content': 'Learn how to select cells, work with ranges, and enter and edit worksheet data.'},
            ],
        },
        {
            'title': 'Module 2: Excel Formulas',
            'description': 'Build formulas and use core functions to calculate values efficiently.',
            'lessons': [
                {'title': 'Basic Formulas', 'content': 'Create formulas with addition, subtraction, multiplication, and division.'},
                {'title': 'SUM Function', 'content': 'Use the SUM function to add values across ranges quickly and accurately.'},
                {'title': 'AVERAGE Function', 'content': 'Use the AVERAGE function to compute the mean of numeric data sets.'},
                {'title': 'COUNT Function', 'content': 'Use COUNT and COUNTA to count numbers and non-empty cells.'},
            ],
        },
        {
            'title': 'Module 3: Excel Functions',
            'description': 'Use lookup and conditional functions to automate decision-making in spreadsheets.',
            'lessons': [
                {'title': 'IF Function', 'content': 'Write conditional formulas with the IF function to evaluate data based on logic.'},
                {'title': 'VLOOKUP', 'content': 'Use VLOOKUP to search for values in a table by row.'},
                {'title': 'HLOOKUP', 'content': 'Use HLOOKUP to search for values by column.'},
                {'title': 'INDEX and MATCH', 'content': 'Combine INDEX and MATCH for flexible and powerful lookups.'},
            ],
        },
        {
            'title': 'Module 4: Data Analysis',
            'description': 'Analyze spreadsheet data using filters, sorting, and pivot tables.',
            'lessons': [
                {'title': 'Sorting Data', 'content': 'Sort data to quickly organize values in ascending or descending order.'},
                {'title': 'Filtering Data', 'content': 'Apply filters to display only the rows that match your criteria.'},
                {'title': 'Pivot Tables', 'content': 'Build and analyze pivot tables to summarize large data sets.'},
            ],
        },
        {
            'title': 'Module 5: Charts',
            'description': 'Create charts and visual dashboards to communicate data clearly.',
            'lessons': [
                {'title': 'Creating Charts', 'content': 'Create column, line, pie, and bar charts from worksheet data.'},
                {'title': 'Formatting Charts', 'content': 'Customize chart titles, labels, colors, and layouts.'},
                {'title': 'Dashboard Visualization', 'content': 'Combine charts and reports to build a simple Excel dashboard.'},
            ],
        },
    ]

    for module_index, module_info in enumerate(modules, start=1):
        module_payload = ModuleCreate(
            course_id=course.id,
            title=module_info['title'],
            description=module_info['description'],
            position=module_index,
        )
        module = create_module(db, organization, module_payload)

        for lesson_index, lesson_info in enumerate(module_info['lessons'], start=1):
            lesson_payload = LessonCreate(
                course_id=course.id,
                module_id=module.id,
                title=lesson_info['title'],
                content=lesson_info['content'],
                content_type=LessonContentType.text,
                duration_minutes=5,
                position=lesson_index,
                content_payload={'body': lesson_info['content']},
            )
            create_lesson(db, organization, lesson_payload)

    return course


def _get_course_progress_counts(db: Session, user_id: int, course_id: int, organization_id: int) -> dict[str, int]:
    total_lessons = (
        db.query(func.count(Lesson.id))
        .filter(
            Lesson.course_id == course_id,
            Lesson.organization_id == organization_id,
            Lesson.is_deleted == False,
        )
        .scalar()
        or 0
    )

    total_quizzes = (
        db.query(func.count(Quiz.id))
        .filter(
            Quiz.course_id == course_id,
            Quiz.organization_id == organization_id,
            Quiz.is_deleted == False,
            Quiz.published == True,
        )
        .scalar()
        or 0
    )

    total_assignments = (
        db.query(func.count(Assignment.id))
        .filter(
            Assignment.course_id == course_id,
            Assignment.organization_id == organization_id,
            Assignment.is_deleted == False,
            Assignment.published == True,
        )
        .scalar()
        or 0
    )

    completed_lessons = (
        db.query(func.count(LessonCompletion.id))
        .filter(
            LessonCompletion.course_id == course_id,
            LessonCompletion.user_id == user_id,
            LessonCompletion.organization_id == organization_id,
            LessonCompletion.is_deleted == False,
            LessonCompletion.is_completed == True,
        )
        .scalar()
        or 0
    )

    completed_quizzes = (
        db.query(func.count(func.distinct(QuizAttempt.quiz_id)))
        .join(Quiz, Quiz.id == QuizAttempt.quiz_id)
        .filter(
            Quiz.course_id == course_id,
            QuizAttempt.user_id == user_id,
            QuizAttempt.organization_id == organization_id,
            QuizAttempt.is_deleted == False,
            QuizAttempt.completed_at.isnot(None),
        )
        .scalar()
        or 0
    )

    completed_assignments = (
        db.query(func.count(func.distinct(AssignmentSubmission.assignment_id)))
        .filter(
            AssignmentSubmission.user_id == user_id,
            AssignmentSubmission.organization_id == organization_id,
            AssignmentSubmission.is_deleted == False,
            AssignmentSubmission.assignment.has(
                Assignment.course_id == course_id,
                Assignment.organization_id == organization_id,
                Assignment.is_deleted == False,
                Assignment.published == True,
            ),
        )
        .scalar()
        or 0
    )

    return {
        "total_lessons": total_lessons,
        "total_quizzes": total_quizzes,
        "total_assignments": total_assignments,
        "completed_lessons": completed_lessons,
        "completed_quizzes": completed_quizzes,
        "completed_assignments": completed_assignments,
    }


def update_course_progress(db: Session, user_id: int, course_id: int, organization_id: int) -> float:
    counts = _get_course_progress_counts(db, user_id, course_id, organization_id)
    total_items = counts["total_lessons"] + counts["total_quizzes"] + counts["total_assignments"]
    completed_items = counts["completed_lessons"] + counts["completed_quizzes"] + counts["completed_assignments"]
    progress = float((completed_items / total_items) * 100.0) if total_items else 0.0

    enrollment = (
        db.query(Enrollment)
        .filter(
            Enrollment.user_id == user_id,
            Enrollment.course_id == course_id,
            Enrollment.organization_id == organization_id,
            Enrollment.is_deleted == False,
        )
        .one_or_none()
    )
    if enrollment:
        enrollment.progress = progress
        if progress >= 100.0:
            enrollment.status = EnrollmentStatus.completed
            if enrollment.completed_at is None:
                enrollment.completed_at = func.now()
        db.add(enrollment)
        db.commit()
        db.refresh(enrollment)

    return progress


def create_module(db: Session, organization, payload: ModuleCreate) -> Module:
    course = get_course_by_id(db, payload.course_id, organization.id)
    if not course:
        raise ValueError("Course not found for the organization.")

    position = payload.position
    if position is None:
        max_position = (
            db.query(func.max(Module.position))
            .filter(Module.course_id == course.id, Module.organization_id == organization.id, Module.is_deleted == False)
            .scalar()
        )
        position = (max_position or 0) + 1

    module = Module(
        course_id=course.id,
        organization_id=organization.id,
        title=payload.title,
        description=payload.description,
        position=position,
    )
    db.add(module)
    db.commit()
    db.refresh(module)
    return module


def get_module_by_id(db: Session, module_id: int, organization_id: int) -> Module | None:
    return (
        db.query(Module)
        .filter(Module.id == module_id, Module.organization_id == organization_id, Module.is_deleted == False)
        .one_or_none()
    )


def update_module(db: Session, module: Module, payload: ModuleUpdate) -> Module:
    if payload.title is not None:
        module.title = payload.title
    if payload.description is not None:
        module.description = payload.description
    if payload.position is not None:
        module.position = payload.position
    db.commit()
    db.refresh(module)
    return module


def reorder_course_modules(db: Session, organization_id: int, course_id: int, module_ids: list[int]) -> list[Module]:
    modules = (
        db.query(Module)
        .filter(Module.course_id == course_id, Module.organization_id == organization_id, Module.is_deleted == False)
        .all()
    )
    module_map = {module.id: module for module in modules}
    if set(module_ids) != set(module_map.keys()):
        raise ValueError("Module ID list must contain exactly the existing modules for the course.")

    for position, module_id in enumerate(module_ids, start=1):
        module_map[module_id].position = position

    db.commit()
    for module in modules:
        db.refresh(module)
    return sorted(modules, key=lambda module: module.position)


def soft_delete_module(db: Session, module: Module) -> Module:
    module.is_deleted = True
    db.commit()
    return module


def _validate_lesson_content_payload(content_type: LessonContentType, content_payload: Any) -> dict | None:
    if content_payload is None:
        raise ValueError(f"content_payload is required for lesson type '{content_type.value}'.")

    if isinstance(content_payload, BaseModel):
        payload_data = content_payload.dict(exclude_none=True)
    elif isinstance(content_payload, dict):
        payload_data = content_payload
    else:
        raise ValueError("content_payload must be a dictionary or a valid content payload object.")

    # Validate required fields based on content type
    if content_type == LessonContentType.youtube_embed:
        if "youtube_id" not in payload_data or not payload_data["youtube_id"]:
            raise ValueError("Invalid content_payload for lesson type 'youtube_embed'")
    elif content_type == LessonContentType.vimeo_embed:
        if "vimeo_id" not in payload_data or not payload_data["vimeo_id"]:
            raise ValueError("Invalid content_payload for lesson type 'vimeo_embed'")
    elif content_type == LessonContentType.text:
        if "body" not in payload_data or not payload_data["body"]:
            raise ValueError("Invalid content_payload for lesson type 'text'")
    elif content_type == LessonContentType.html:
        if "html" not in payload_data or not payload_data["html"]:
            raise ValueError("Invalid content_payload for lesson type 'html'")
    elif content_type in [
        LessonContentType.video_upload,
        LessonContentType.pdf,
        LessonContentType.ppt,
        LessonContentType.doc,
        LessonContentType.audio,
        LessonContentType.scorm,
    ]:
        if "file_url" not in payload_data and "package_url" not in payload_data:
            raise ValueError(f"Invalid content_payload for lesson type '{content_type.value}'")
    elif content_type in [LessonContentType.external_link, LessonContentType.live_link]:
        if "url" not in payload_data or not payload_data["url"]:
            raise ValueError(f"Invalid content_payload for lesson type '{content_type.value}'")
    elif content_type == LessonContentType.iframe_embed:
        if "iframe_url" not in payload_data or not payload_data["iframe_url"]:
            raise ValueError("Invalid content_payload for lesson type 'iframe_embed'")

    # Preserve all fields including extra ones like resources/materials
    return payload_data


def create_lesson(db: Session, organization, payload: LessonCreate) -> Lesson:
    course = get_course_by_id(db, payload.course_id, organization.id)
    if not course:
        raise ValueError("Course not found for the organization.")

    module = (
        db.query(Module)
        .filter(Module.id == payload.module_id, Module.course_id == course.id, Module.organization_id == organization.id, Module.is_deleted == False)
        .one_or_none()
    )
    if not module:
        raise ValueError("Module not found for the course.")

    parent_lesson = None
    if payload.parent_lesson_id is not None:
        parent_lesson = (
            db.query(Lesson)
            .filter(
                Lesson.id == payload.parent_lesson_id,
                Lesson.course_id == course.id,
                Lesson.organization_id == organization.id,
                Lesson.is_deleted == False,
            )
            .one_or_none()
        )
        if not parent_lesson:
            raise ValueError("Parent lesson not found for the course.")

    prerequisites = []
    if payload.prerequisite_ids:
        prerequisites = (
            db.query(Lesson)
            .filter(
                Lesson.organization_id == organization.id,
                Lesson.course_id == course.id,
                Lesson.id.in_(payload.prerequisite_ids),
                Lesson.is_deleted == False,
            )
            .all()
        )
        if len(prerequisites) != len(set(payload.prerequisite_ids)):
            raise ValueError("One or more prerequisite lessons were not found for the course.")

    position = payload.position
    if position is None:
        max_position = (
            db.query(func.max(Lesson.position))
            .filter(Lesson.module_id == module.id, Lesson.organization_id == organization.id, Lesson.is_deleted == False)
            .scalar()
        )
        position = (max_position or 0) + 1

    content_payload = _validate_lesson_content_payload(payload.content_type, payload.content_payload)

    lesson = Lesson(
        course_id=course.id,
        module_id=module.id,
        organization_id=organization.id,
        parent_lesson=parent_lesson,
        title=payload.title,
        content=payload.content,
        lesson_type=payload.content_type.value if payload.content_type else None,
        duration_minutes=payload.duration_minutes,
        position=position,
        resource_payload=content_payload,
        is_locked=payload.is_locked,
        is_mandatory=payload.is_mandatory,
        drip_enabled=payload.drip_enabled,
        available_at=payload.available_at,
        unlock_after_days=payload.unlock_after_days,
        prerequisites=prerequisites,
    )
    db.add(lesson)
    db.commit()
    db.refresh(lesson)

    try:
        from app.models import Enrollment
        from app.services.dashboard import create_notifications_for_users

        enrolled_user_ids = [
            enrollment.user_id
            for enrollment in db.query(Enrollment)
            .filter(
                Enrollment.course_id == course.id,
                Enrollment.organization_id == organization.id,
                Enrollment.is_deleted == False,
            )
            .all()
        ]
        if enrolled_user_ids:
            create_notifications_for_users(
                db,
                enrolled_user_ids,
                organization.id,
                f"New lesson added: {lesson.title}",
                f"A new lesson has been added to '{course.title}'. Check it out now.",
            )
    except Exception:
        pass

    return lesson


def get_lesson_by_id(db: Session, lesson_id: int, organization_id: int) -> Lesson | None:
    return (
        db.query(Lesson)
        .filter(Lesson.id == lesson_id, Lesson.organization_id == organization_id, Lesson.is_deleted == False)
        .one_or_none()
    )


def reorder_module_lessons(db: Session, organization_id: int, module_id: int, lesson_ids: list[int]) -> list[Lesson]:
    lessons = (
        db.query(Lesson)
        .filter(Lesson.module_id == module_id, Lesson.organization_id == organization_id, Lesson.is_deleted == False)
        .all()
    )
    lesson_map = {lesson.id: lesson for lesson in lessons}
    if set(lesson_ids) != set(lesson_map.keys()):
        raise ValueError("Lesson ID list must contain exactly the existing lessons for the module.")

    for position, lesson_id in enumerate(lesson_ids, start=1):
        lesson_map[lesson_id].position = position

    db.commit()
    for lesson in lessons:
        db.refresh(lesson)
    return sorted(lessons, key=lambda lesson: lesson.position)


def update_lesson(db: Session, lesson: Lesson, payload: LessonUpdate) -> Lesson:
    if payload.module_id is not None and payload.module_id != lesson.module_id:
        module = get_module_by_id(db, payload.module_id, lesson.organization_id)
        if not module or module.course_id != lesson.course_id:
            raise ValueError("Target module not found for the lesson's course.")
        lesson.module_id = module.id

    if payload.parent_lesson_id is not None:
        if payload.parent_lesson_id == lesson.id:
            raise ValueError("A lesson cannot be its own parent.")
        parent_lesson = get_lesson_by_id(db, payload.parent_lesson_id, lesson.organization_id)
        if not parent_lesson or parent_lesson.course_id != lesson.course_id:
            raise ValueError("Parent lesson not found for the course.")
        lesson.parent_lesson = parent_lesson

    if payload.title is not None:
        lesson.title = payload.title
    if payload.content is not None:
        lesson.content = payload.content
    if payload.duration_minutes is not None:
        lesson.duration_minutes = payload.duration_minutes
    if payload.position is not None:
        lesson.position = payload.position

    effective_content_type = LessonContentType(payload.content_type.value) if payload.content_type is not None else LessonContentType(lesson.content_type)

    if payload.content_type is not None:
        if payload.content_payload is None:
            raise ValueError("content_payload is required when changing lesson content_type.")
        lesson.content_type = payload.content_type.value

    if payload.content_payload is not None:
        lesson.content_payload = _validate_lesson_content_payload(effective_content_type, payload.content_payload)

    if payload.is_locked is not None:
        lesson.is_locked = payload.is_locked
    if payload.is_mandatory is not None:
        lesson.is_mandatory = payload.is_mandatory
    if payload.drip_enabled is not None:
        lesson.drip_enabled = payload.drip_enabled
    if payload.available_at is not None:
        lesson.available_at = payload.available_at
    if payload.unlock_after_days is not None:
        lesson.unlock_after_days = payload.unlock_after_days

    if payload.prerequisite_ids is not None:
        if payload.prerequisite_ids:
            prerequisites = (
                db.query(Lesson)
                .filter(
                    Lesson.organization_id == lesson.organization_id,
                    Lesson.course_id == lesson.course_id,
                    Lesson.id.in_(payload.prerequisite_ids),
                    Lesson.is_deleted == False,
                )
                .all()
            )
            if len(prerequisites) != len(set(payload.prerequisite_ids)):
                raise ValueError("One or more prerequisite lessons were not found for the course.")
            if lesson.id in payload.prerequisite_ids:
                raise ValueError("A lesson cannot be a prerequisite of itself.")
            lesson.prerequisites = prerequisites
        else:
            lesson.prerequisites = []

    db.commit()
    db.refresh(lesson)
    return lesson


def soft_delete_lesson(db: Session, lesson: Lesson) -> Lesson:
    lesson.is_deleted = True
    db.commit()
    return lesson


def get_course_live_classes(db: Session, course_id: int, organization_id: int, limit: int = 50, offset: int = 0) -> List[LiveClass]:
    return (
        db.query(LiveClass)
        .filter(LiveClass.course_id == course_id, LiveClass.organization_id == organization_id, LiveClass.is_deleted == False)
        .order_by(LiveClass.scheduled_at)
        .offset(offset)
        .limit(limit)
        .all()
    )


def get_live_class_by_id(db: Session, live_class_id: int, organization_id: int) -> LiveClass | None:
    return (
        db.query(LiveClass)
        .filter(LiveClass.id == live_class_id, LiveClass.organization_id == organization_id, LiveClass.is_deleted == False)
        .one_or_none()
    )


def create_live_class(db: Session, organization, payload: LiveSessionCreate) -> LiveClass:
    from app.models import User as UserModel
    
    course = get_course_by_id(db, payload.course_id, organization.id)
    if not course:
        raise ValueError("Course not found for the organization.")

    instructor = None
    if payload.instructor_id is not None:
        instructor = (
            db.query(UserModel)
            .filter(UserModel.id == payload.instructor_id, UserModel.organization_id == organization.id, UserModel.is_deleted == False)
            .one_or_none()
        )
        if not instructor:
            raise ValueError("Instructor not found for the organization.")

    if payload.provider == LiveSessionProvider.zoom and payload.provider_join_url is not None:
        if "zoom.us" not in payload.provider_join_url and "zoom.com" not in payload.provider_join_url:
            raise ValueError("Zoom live sessions must use a valid Zoom meeting URL.")
    if payload.provider == LiveSessionProvider.google_meet and payload.provider_join_url is not None:
        if "meet.google.com" not in payload.provider_join_url and "google.com" not in payload.provider_join_url:
            raise ValueError("Google Meet live sessions must use a valid Google Meet URL.")

    live_class = LiveClass(
        course_id=course.id,
        course_name=course.title,
        organization_id=organization.id,
        title=payload.title,
        description=payload.description,
        scheduled_at=payload.scheduled_at,
        duration_minutes=payload.duration_minutes,
        instructor_id=payload.instructor_id,
        provider=payload.provider.value,
        provider_meeting_id=payload.provider_meeting_id,
        provider_join_url=str(payload.provider_join_url) if payload.provider_join_url else None,
        provider_start_url=str(payload.provider_start_url) if payload.provider_start_url else None,
        provider_metadata=payload.provider_metadata,
        is_recurring=payload.is_recurring,
    )
    db.add(live_class)
    db.commit()
    db.refresh(live_class)

    try:
        from app.models import Enrollment
        from app.services.dashboard import create_notifications_for_users

        enrolled_user_ids = [
            enrollment.user_id
            for enrollment in db.query(Enrollment)
            .filter(
                Enrollment.course_id == course.id,
                Enrollment.organization_id == organization.id,
                Enrollment.is_deleted == False,
            )
            .all()
        ]

        if enrolled_user_ids:
            date_text = live_class.scheduled_at.isoformat() if live_class.scheduled_at else ""
            create_notifications_for_users(
                db,
                enrolled_user_ids,
                organization.id,
                f"New live class scheduled: {live_class.title}",
                f"A new live class for '{course.title}' is scheduled{f' at {date_text}' if date_text else ''}.",
            )
    except Exception:
        pass

    return live_class


def update_live_class(db: Session, live_class: LiveClass, payload: LiveSessionUpdate) -> LiveClass:
    original_title = live_class.title
    original_scheduled_at = live_class.scheduled_at

    if payload.title is not None:
        live_class.title = payload.title
    if payload.description is not None:
        live_class.description = payload.description
    if payload.scheduled_at is not None:
        live_class.scheduled_at = payload.scheduled_at
    if payload.duration_minutes is not None:
        live_class.duration_minutes = payload.duration_minutes
    if payload.instructor_id is not None:
        instructor = (
            db.query(UserModel)
            .filter(UserModel.id == payload.instructor_id, UserModel.organization_id == live_class.organization_id, UserModel.is_deleted == False)
            .one_or_none()
        )
        if not instructor:
            raise ValueError("Instructor not found for the organization.")
        live_class.instructor_id = payload.instructor_id
    if payload.is_recurring is not None:
        live_class.is_recurring = payload.is_recurring
    if payload.provider is not None:
        live_class.provider = payload.provider.value
    if payload.provider_meeting_id is not None:
        live_class.provider_meeting_id = payload.provider_meeting_id
    if payload.provider_join_url is not None:
        live_class.provider_join_url = str(payload.provider_join_url)
    if payload.provider_start_url is not None:
        live_class.provider_start_url = str(payload.provider_start_url)
    if payload.provider_metadata is not None:
        live_class.provider_metadata = payload.provider_metadata

    was_title_changed = payload.title is not None and payload.title != original_title
    was_schedule_changed = payload.scheduled_at is not None and payload.scheduled_at != original_scheduled_at

    db.commit()
    db.refresh(live_class)

    if was_title_changed or was_schedule_changed:
        try:
            from app.models import Enrollment
            from app.services.dashboard import create_notifications_for_users

            enrolled_user_ids = [
                enrollment.user_id
                for enrollment in db.query(Enrollment)
                .filter(
                    Enrollment.course_id == live_class.course_id,
                    Enrollment.organization_id == live_class.organization_id,
                    Enrollment.is_deleted == False,
                )
                .all()
            ]

            if enrolled_user_ids:
                changed_items = []
                if was_title_changed:
                    changed_items.append("title")
                if was_schedule_changed:
                    changed_items.append("schedule")
                details = " and ".join(changed_items)
                date_text = live_class.scheduled_at.isoformat() if live_class.scheduled_at else ""
                create_notifications_for_users(
                    db,
                    enrolled_user_ids,
                    live_class.organization_id,
                    f"Live class updated: {live_class.title}",
                    f"The live class for '{live_class.course.title}' has updated its {details}.{f' New time: {date_text}.' if date_text else ''}",
                )
        except Exception:
            pass

    return live_class


def soft_delete_live_class(db: Session, live_class: LiveClass) -> LiveClass:
    live_class.is_deleted = True
    db.commit()
    return live_class


def create_live_class_attendance(db: Session, live_class: LiveClass, user: User, status: str | None = None) -> LiveClassAttendance:
    attendance = (
        db.query(LiveClassAttendance)
        .filter(
            LiveClassAttendance.live_class_id == live_class.id,
            LiveClassAttendance.user_id == user.id,
            LiveClassAttendance.organization_id == live_class.organization_id,
            LiveClassAttendance.is_deleted == False,
        )
        .one_or_none()
    )
    if attendance is None:
        attendance = LiveClassAttendance(
            live_class_id=live_class.id,
            user_id=user.id,
            organization_id=live_class.organization_id,
            status=status or "present",
        )
        db.add(attendance)
    else:
        attendance.status = status or attendance.status
        attendance.attended_at = func.now()

    db.commit()
    db.refresh(attendance)
    return attendance


def get_live_class_attendance(db: Session, live_class_id: int, organization_id: int, limit: int = 50, offset: int = 0) -> List[LiveClassAttendance]:
    return (
        db.query(LiveClassAttendance)
        .filter(
            LiveClassAttendance.live_class_id == live_class_id,
            LiveClassAttendance.organization_id == organization_id,
            LiveClassAttendance.is_deleted == False,
        )
        .order_by(LiveClassAttendance.attended_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )


def create_live_class_recording(
    db: Session,
    live_class: LiveClass,
    uploaded_by: User | None,
    title: str,
    file_url: str,
    file_key: str,
    duration_minutes: int | None = None,
    notes: str | None = None,
) -> LiveClassRecording:
    recording = LiveClassRecording(
        live_class_id=live_class.id,
        uploaded_by_id=uploaded_by.id if uploaded_by else None,
        organization_id=live_class.organization_id,
        title=title,
        file_url=file_url,
        file_key=file_key,
        duration_minutes=duration_minutes,
        notes=notes,
    )
    db.add(recording)
    db.commit()
    db.refresh(recording)
    return recording


def list_live_class_recordings(db: Session, live_class_id: int, organization_id: int, limit: int = 50, offset: int = 0) -> List[LiveClassRecording]:
    return (
        db.query(LiveClassRecording)
        .filter(
            LiveClassRecording.live_class_id == live_class_id,
            LiveClassRecording.organization_id == organization_id,
            LiveClassRecording.is_deleted == False,
        )
        .order_by(LiveClassRecording.uploaded_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )


def get_lesson_completion(db: Session, user_id: int, lesson_id: int, organization_id: int) -> LessonCompletion | None:
    return (
        db.query(LessonCompletion)
        .filter(
            LessonCompletion.user_id == user_id,
            LessonCompletion.lesson_id == lesson_id,
            LessonCompletion.organization_id == organization_id,
            LessonCompletion.is_deleted == False,
        )
        .one_or_none()
    )


def complete_lesson(db: Session, user: User, lesson_id: int, organization_id: int) -> LessonCompletion:
    lesson = (
        db.query(Lesson)
        .filter(Lesson.id == lesson_id, Lesson.organization_id == organization_id, Lesson.is_deleted == False)
        .one_or_none()
    )
    if not lesson:
        raise ValueError("Lesson not found for the organization.")

    completion = get_lesson_completion(db, user.id, lesson.id, organization_id)
    is_new_completion = completion is None or not completion.is_completed

    total_lessons = (
        db.query(Lesson)
        .filter(Lesson.course_id == lesson.course_id, Lesson.organization_id == organization_id, Lesson.is_deleted == False)
        .count()
    )

    prior_completed_lessons = 0
    if is_new_completion:
        prior_completed_lessons = (
            db.query(LessonCompletion)
            .filter(
                LessonCompletion.user_id == user.id,
                LessonCompletion.course_id == lesson.course_id,
                LessonCompletion.organization_id == organization_id,
                LessonCompletion.is_deleted == False,
                LessonCompletion.is_completed == True,
                LessonCompletion.lesson_id != lesson.id,
            )
            .count()
        )

    if completion is None:
        completion = LessonCompletion(
            user_id=user.id,
            course_id=lesson.course_id,
            module_id=lesson.module_id,
            lesson_id=lesson.id,
            organization_id=organization_id,
            completed_at=func.now(),
            is_completed=True,
        )
        db.add(completion)
    else:
        completion.completed_at = func.now()
        completion.is_completed = True

    db.commit()
    db.refresh(completion)

    if is_new_completion:
        gamification_service.update_user_points(db, user, 10.0)
        gamification_service.trigger_gamification_event(
            db,
            user,
            "lesson_completed",
            {
                "lesson_id": lesson.id,
                "course_id": lesson.course_id,
                "completed_lessons": prior_completed_lessons + 1,
                "total_lessons": total_lessons,
            },
        )

        if total_lessons > 0 and prior_completed_lessons + 1 >= total_lessons:
            gamification_service.update_user_points(db, user, 50.0)
            gamification_service.trigger_gamification_event(
                db,
                user,
                "course_completed",
                {
                    "course_id": lesson.course_id,
                    "completed_lessons": total_lessons,
                    "total_lessons": total_lessons,
                },
            )

    certificate_service.issue_certificate_if_course_completed(db, user, lesson.course_id, organization_id)
    update_course_progress(db, user.id, lesson.course_id, organization_id)
    return completion


def get_course_structure(db: Session, organization_id: int, course_id: int) -> list[Module]:
    modules = (
        db.query(Module)
        .filter(Module.course_id == course_id, Module.organization_id == organization_id, Module.is_deleted == False)
        .order_by(Module.position)
        .all()
    )
    lessons = (
        db.query(Lesson)
        .filter(Lesson.course_id == course_id, Lesson.organization_id == organization_id, Lesson.is_deleted == False)
        .order_by(Lesson.position)
        .all()
    )

    lessons_by_id = {lesson.id: lesson for lesson in lessons}
    root_lessons_by_module: dict[int, list[Lesson]] = {module.id: [] for module in modules}

    for lesson in lessons:
        if lesson.parent_lesson_id and lesson.parent_lesson_id in lessons_by_id:
            parent = lessons_by_id[lesson.parent_lesson_id]
            parent.children.append(lesson)
        else:
            if lesson.module_id in root_lessons_by_module:
                root_lessons_by_module[lesson.module_id].append(lesson)

    for module in modules:
        module.lessons = root_lessons_by_module.get(module.id, [])

    return modules


def get_organization_categories(db: Session, organization_id: int, limit: int = 50, offset: int = 0) -> List[CourseCategory]:
    return (
        db.query(CourseCategory)
        .filter(CourseCategory.organization_id == organization_id, CourseCategory.is_deleted == False)
        .order_by(CourseCategory.name)
        .offset(offset)
        .limit(limit)
        .all()
    )


def get_organization_category(db: Session, category_id: int, organization_id: int) -> CourseCategory | None:
    return (
        db.query(CourseCategory)
        .filter(
            CourseCategory.id == category_id,
            CourseCategory.organization_id == organization_id,
            CourseCategory.is_deleted == False,
        )
        .one_or_none()
    )


def create_course_category(db: Session, organization, name: str, description: str | None = None) -> CourseCategory:
    existing = (
        db.query(CourseCategory)
        .filter(CourseCategory.organization_id == organization.id, CourseCategory.name == name, CourseCategory.is_deleted == False)
        .one_or_none()
    )
    if existing:
        raise ValueError("A category with that name already exists.")

    category = CourseCategory(name=name, description=description, organization_id=organization.id)
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


def update_course_category(db: Session, category: CourseCategory, name: str | None = None, description: str | None = None) -> CourseCategory:
    if name:
        duplicate = (
            db.query(CourseCategory)
            .filter(
                CourseCategory.organization_id == category.organization_id,
                CourseCategory.name == name,
                CourseCategory.id != category.id,
                CourseCategory.is_deleted == False,
            )
            .one_or_none()
        )
        if duplicate:
            raise ValueError("A category with that name already exists.")
        category.name = name
    if description is not None:
        category.description = description

    db.commit()
    db.refresh(category)
    return category


def soft_delete_course_category(db: Session, category: CourseCategory) -> CourseCategory:
    category.is_deleted = True
    db.commit()
    return category


def get_organization_tags(db: Session, organization_id: int, limit: int = 50, offset: int = 0) -> List[CourseTag]:
    return (
        db.query(CourseTag)
        .filter(CourseTag.organization_id == organization_id, CourseTag.is_deleted == False)
        .order_by(CourseTag.name)
        .offset(offset)
        .limit(limit)
        .all()
    )


def get_organization_tag(db: Session, tag_id: int, organization_id: int) -> CourseTag | None:
    return (
        db.query(CourseTag)
        .filter(CourseTag.id == tag_id, CourseTag.organization_id == organization_id, CourseTag.is_deleted == False)
        .one_or_none()
    )


def create_course_tag(db: Session, organization, name: str) -> CourseTag:
    existing = (
        db.query(CourseTag)
        .filter(CourseTag.organization_id == organization.id, CourseTag.name == name, CourseTag.is_deleted == False)
        .one_or_none()
    )
    if existing:
        raise ValueError("A tag with that name already exists.")

    tag = CourseTag(name=name, organization_id=organization.id)
    db.add(tag)
    db.commit()
    db.refresh(tag)
    return tag


def update_course_tag(db: Session, tag: CourseTag, name: str | None = None) -> CourseTag:
    if name:
        duplicate = (
            db.query(CourseTag)
            .filter(
                CourseTag.organization_id == tag.organization_id,
                CourseTag.name == name,
                CourseTag.id != tag.id,
                CourseTag.is_deleted == False,
            )
            .one_or_none()
        )
        if duplicate:
            raise ValueError("A tag with that name already exists.")
        tag.name = name

    db.commit()
    db.refresh(tag)
    return tag


def soft_delete_course_tag(db: Session, tag: CourseTag) -> CourseTag:
    tag.is_deleted = True
    db.commit()
    return tag


def _recalculate_course_rating(db: Session, course: Course) -> None:
    review_count, average_rating = (
        db.query(func.count(Review.id), func.avg(Review.rating))
        .filter(
            Review.course_id == course.id,
            Review.organization_id == course.organization_id,
            Review.is_deleted == False,
            Review.approved_at != None,
        )
        .one()
    )
    course.review_count = int(review_count or 0)
    course.average_rating = float(average_rating or 0.0)
    db.commit()
    db.refresh(course)


def _recalculate_instructor_rating(db: Session, instructor: User) -> None:
    review_count, average_rating = (
        db.query(func.count(Review.id), func.avg(Review.rating))
        .join(Course, Review.course_id == Course.id)
        .filter(
            Course.instructors.any(User.id == instructor.id),
            Review.organization_id == instructor.organization_id,
            Review.is_deleted == False,
            Review.approved_at != None,
        )
        .one()
    )
    instructor.review_count = int(review_count or 0)
    instructor.average_rating = float(average_rating or 0.0)
    db.commit()
    db.refresh(instructor)


def get_course_reviews(
    db: Session,
    course_id: int,
    organization_id: int,
    limit: int = 50,
    offset: int = 0,
    approved_only: bool = True,
) -> List[Review]:
    query = (
        db.query(Review)
        .filter(
            Review.course_id == course_id,
            Review.organization_id == organization_id,
            Review.is_deleted == False,
        )
    )

    if approved_only:
        query = query.filter(Review.approved_at != None)

    return (
        query.order_by(Review.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )


def get_review_by_id(db: Session, review_id: int, organization_id: int) -> Review | None:
    return (
        db.query(Review)
        .filter(
            Review.id == review_id,
            Review.organization_id == organization_id,
            Review.is_deleted == False,
        )
        .one_or_none()
    )


def update_review_moderation(db: Session, review: Review, is_featured: bool | None = None, approved_at: datetime | None = None) -> Review:
    previous_approved_at = review.approved_at
    if is_featured is not None:
        review.is_featured = is_featured
    if approved_at is not None:
        review.approved_at = approved_at

    db.commit()
    if review.approved_at != previous_approved_at:
        course = review.course
        _recalculate_course_rating(db, course)
        for instructor in course.instructors:
            _recalculate_instructor_rating(db, instructor)
    db.refresh(review)
    return review


def create_review(db: Session, course: Course, user: User, payload: ReviewCreate) -> Review:
    if course.organization_id != user.organization_id:
        raise ValueError("Cannot add review to a course in a different organization.")

    existing = (
        db.query(Review)
        .filter(
            Review.organization_id == course.organization_id,
            Review.user_id == user.id,
            Review.course_id == course.id,
            Review.is_deleted == False,
        )
        .one_or_none()
    )
    if existing:
        raise ValueError("You have already submitted a review for this course.")

    review = Review(
        user_id=user.id,
        course_id=course.id,
        organization_id=course.organization_id,
        rating=payload.rating,
        comment=payload.comment,
        is_featured=False,
        approved_at=None,
    )
    db.add(review)
    db.commit()
    db.refresh(review)
    return review


def update_course(db: Session, course: Course, payload: CourseUpdate) -> Course:
    if payload.slug is not None and payload.slug != course.slug:
        if get_course_by_slug(db, payload.slug, course.organization_id, exclude_course_id=course.id):
            raise ValueError("A course with this slug already exists for the organization.")

    if payload.category_id is not None:
        category = (
            db.query(CourseCategory)
            .filter(CourseCategory.id == payload.category_id, CourseCategory.organization_id == course.organization_id, CourseCategory.is_deleted == False)
            .one_or_none()
        )
        if category is None:
            raise ValueError("Category not found for the organization.")
        course.category = category

    if payload.tag_ids is not None:
        tags = (
            db.query(CourseTag)
            .filter(CourseTag.organization_id == course.organization_id, CourseTag.id.in_(payload.tag_ids), CourseTag.is_deleted == False)
            .all()
        )
        if len(tags) != len(set(payload.tag_ids)):
            raise ValueError("One or more course tags were not found for the organization.")
        db.execute(
            course_tag_associations.delete().where(course_tag_associations.c.course_id == course.id)
        )
        if tags:
            db.execute(
                course_tag_associations.insert(),
                [
                    {
                        "course_id": course.id,
                        "tag_id": tag.id,
                        "organization_id": course.organization_id,
                    }
                    for tag in tags
                ],
            )

    if payload.instructor_ids is not None:
        instructors = (
            db.query(User)
            .filter(User.organization_id == course.organization_id, User.id.in_(payload.instructor_ids), User.is_deleted == False)
            .all()
        )
        if len(instructors) != len(set(payload.instructor_ids)):
            raise ValueError("One or more instructors were not found for the organization.")
        db.execute(
            course_instructors.delete().where(course_instructors.c.course_id == course.id)
        )
        if instructors:
            db.execute(
                course_instructors.insert(),
                [
                    {
                        "course_id": course.id,
                        "user_id": instructor.id,
                        "organization_id": course.organization_id,
                    }
                    for instructor in instructors
                ],
            )

    was_published = course.is_published

    update_fields = {
        "title": payload.title,
        "slug": payload.slug,
        "short_description": payload.short_description,
        "description": payload.description,
        "thumbnail_url": payload.thumbnail_url,
        "objectives": payload.objectives,
        "requirements": payload.requirements,
        "level": payload.level,
        "duration_minutes": payload.duration_minutes,
        "visibility": payload.visibility,
        "status": payload.status,
        "is_published": payload.is_published,
        "price": payload.price,
        "owner_id": payload.owner_id,
        "is_featured": payload.is_featured,
    }

    for field, value in update_fields.items():
        if value is not None:
            setattr(course, field, value)

    db.commit()
    db.refresh(course)

    if not was_published and course.is_published:
        try:
            from app.models import Enrollment
            from app.services.dashboard import create_notifications_for_users

            enrolled_user_ids = [
                enrollment.user_id
                for enrollment in db.query(Enrollment)
                .filter(
                    Enrollment.course_id == course.id,
                    Enrollment.organization_id == course.organization_id,
                    Enrollment.is_deleted == False,
                )
                .all()
            ]
            if enrolled_user_ids:
                create_notifications_for_users(
                    db,
                    enrolled_user_ids,
                    course.organization_id,
                    f"Course published: {course.title}",
                    f"The course '{course.title}' is now live. Start learning today.",
                )
        except Exception:
            pass

    return course


def soft_delete_course(db: Session, course: Course) -> Course:
    course.is_deleted = True
    db.commit()
    return course
