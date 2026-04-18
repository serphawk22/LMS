import re
from typing import List

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import schemas
from app.dependencies import get_current_active_user, get_current_admin_user, get_db, get_tenant, require_roles
from app.models import User, Quiz
from app.schemas.course import CourseLevel
from app.services import courses as course_service
from app.services import auth as auth_service
from app.services import enrollment as enrollment_service
from app.services.storage import FileStorageService


def extract_vimeo_id(value: str) -> str | None:
    if not value:
        return None
    value = value.strip()
    match = re.search(r"(?:https?://)?(?:www\.)?(?:player\.)?vimeo\.com/(?:video/)?(\d+)", value)
    if match:
        return match.group(1)
    return value if re.fullmatch(r"\d+", value) else None


def extract_youtube_id(value: str) -> str | None:
    if not value:
        return None
    value = value.strip()
    match = re.search(r"(?:youtube\.com/(?:watch\?v=|embed/)|youtu\.be/)([A-Za-z0-9_-]{11})", value)
    if match:
        return match.group(1)
    return value if re.fullmatch(r"[A-Za-z0-9_-]{11}", value) else None

router = APIRouter()


@router.get("/", response_model=List[schemas.CourseRead])
def list_courses(
    limit: int = 25,
    offset: int = 0,
    search: str | None = None,
    category_id: int | None = None,
    instructor_id: int | None = None,
    level: CourseLevel | None = None,
    min_rating: float | None = None,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")
    return course_service.get_organization_courses(
        db,
        organization.id,
        limit=limit,
        offset=offset,
        search=search,
        category_id=category_id,
        instructor_id=instructor_id,
        level=level,
        min_rating=min_rating,
    )


@router.get("/{course_id}", response_model=schemas.CourseRead)
def get_course(
    course_id: int,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")

    course = course_service.get_course_by_id(db, course_id, organization.id)
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found.")
    
    # Fetch lessons for this course
    from app.models import Lesson, Module
    lessons_query = (
        db.query(Lesson)
        .join(Module, Lesson.module_id == Module.id)
        .filter(
            Lesson.course_id == course_id,
            Lesson.organization_id == organization.id,
            Lesson.is_deleted == False,
            Module.is_deleted == False,
        )
        .order_by(Module.position, Lesson.position)
    )
    
    lessons = lessons_query.all()
    
    # Convert lessons to CourseLessonRead format
    course_lessons = []
    for lesson in lessons:
        video_url = None
        if lesson.content_type == "vimeo_embed" and lesson.content_payload and "vimeo_id" in lesson.content_payload:
            vimeo_id = extract_vimeo_id(str(lesson.content_payload['vimeo_id']))
            if vimeo_id:
                video_url = f"https://player.vimeo.com/video/{vimeo_id}"
        elif lesson.content_type == "youtube_embed" and lesson.content_payload and "youtube_id" in lesson.content_payload:
            youtube_id = extract_youtube_id(str(lesson.content_payload['youtube_id']))
            if youtube_id:
                video_url = f"https://www.youtube.com/embed/{youtube_id}"
        elif lesson.content_payload and "file_url" in lesson.content_payload:
            video_url = lesson.content_payload["file_url"]
        
        course_lessons.append(schemas.CourseLessonRead(
            id=lesson.id,
            title=lesson.title,
            video_url=video_url,
            description=lesson.content,
            content_payload=lesson.content_payload
        ))
    
    # Create CourseRead with lessons
    course_data = schemas.CourseRead(
        id=course.id,
        title=course.title,
        slug=course.slug,
        short_description=course.short_description,
        description=course.description,
        thumbnail_url=course.thumbnail_url,
        objectives=course.objectives,
        requirements=course.requirements,
        level=course.level,
        duration_minutes=course.duration_minutes,
        visibility=course.visibility,
        status=course.status,
        is_published=course.is_published,
        price=course.price,
        category=course.category,
        tags=course.tags,
        instructors=course.instructors,
        instructor_name=course.instructor_name,
        owner_id=course.owner_id,
        average_rating=course.average_rating,
        review_count=course.review_count,
        is_featured=course.is_featured,
        syllabus=course.syllabus,
        created_at=course.created_at,
        updated_at=course.updated_at,
        lessons=course_lessons,
    )
    
    return course_data


@router.get("/{course_id}/lessons", response_model=List[schemas.LessonRead])
def list_course_lessons(
    course_id: int,
    limit: int = 100,
    offset: int = 0,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    from app.services import enrollment as enrollment_service
    
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")

    course = course_service.get_course_by_id(db, course_id, organization.id)
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found.")

    # Check if user is enrolled in the course (or is an instructor/admin)
    is_instructor = (current_user.role_name or "").lower() in {"instructor", "organization_admin", "super_admin", "admin"}
    if not is_instructor:
        enrollment = enrollment_service.get_user_enrollment(db, current_user.id, course_id, organization.id)
        if not enrollment:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not enrolled in this course.",
            )

    # Get all lessons for this course, ordered by module position and lesson position
    from app.models import Lesson, Module
    
    lessons = (
        db.query(Lesson)
        .join(Module, Lesson.module_id == Module.id)
        .filter(
            Lesson.course_id == course_id,
            Lesson.organization_id == organization.id,
            Lesson.is_deleted == False,
            Module.is_deleted == False,
        )
        .order_by(Module.position, Lesson.position)
        .offset(offset)
        .limit(limit)
        .all()
    )
    return lessons


@router.get("/{course_id}/quizzes", response_model=List[schemas.QuizRead])
def list_course_quizzes(
    course_id: int,
    limit: int = 25,
    offset: int = 0,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    from app.services import enrollment as enrollment_service
    
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")

    course = course_service.get_course_by_id(db, course_id, organization.id)
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found.")

    # Check if user is enrolled in the course (or is an instructor/admin)
    is_instructor = (current_user.role_name or "").lower() in {"instructor", "organization_admin", "super_admin"}
    if not is_instructor:
        enrollment = enrollment_service.get_user_enrollment(db, current_user.id, course_id, organization.id)
        if not enrollment:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not enrolled in this course.",
            )

    # Get quizzes for this course
    query = db.query(Quiz).filter(
        Quiz.course_id == course_id,
        Quiz.organization_id == organization.id,
        Quiz.is_deleted == False,
    )
    
    # Only show published quizzes to students; show all to instructors
    if not is_instructor:
        query = query.filter(Quiz.published == True)
    
    quizzes = (
        query
        .order_by(Quiz.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return quizzes


@router.get("/{course_id}/live-sessions", response_model=List[schemas.LiveSessionRead])
def list_live_sessions(
    course_id: int,
    limit: int = 25,
    offset: int = 0,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    course = course_service.get_course_by_id(db, course_id, organization.id)
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found.")

    return course_service.get_course_live_classes(db, course.id, organization.id, limit=limit, offset=offset)


@router.post("/{course_id}/live-sessions", response_model=schemas.LiveSessionRead, status_code=status.HTTP_201_CREATED)
def create_live_session(
    course_id: int,
    payload: schemas.LiveSessionCreate,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("instructor", "organization_admin", "super_admin", "admin")),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")
    if payload.course_id != course_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Course ID mismatch.")

    try:
        return course_service.create_live_class(db, organization, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/{course_id}/live-sessions/{live_session_id}", response_model=schemas.LiveSessionRead)
def get_live_session(
    course_id: int,
    live_session_id: int,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    live_class = course_service.get_live_class_by_id(db, live_session_id, organization.id)
    if not live_class or live_class.course_id != course_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Live session not found.")

    return live_class


@router.put("/{course_id}/live-sessions/{live_session_id}", response_model=schemas.LiveSessionRead)
def update_live_session(
    course_id: int,
    live_session_id: int,
    payload: schemas.LiveSessionUpdate,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("instructor", "organization_admin", "super_admin", "admin")),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    live_class = course_service.get_live_class_by_id(db, live_session_id, organization.id)
    if not live_class or live_class.course_id != course_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Live session not found.")

    try:
        return course_service.update_live_class(db, live_class, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.delete("/{course_id}/live-sessions/{live_session_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_live_session(
    course_id: int,
    live_session_id: int,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("instructor", "organization_admin", "super_admin", "admin")),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    live_class = course_service.get_live_class_by_id(db, live_session_id, organization.id)
    if not live_class or live_class.course_id != course_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Live session not found.")

    course_service.soft_delete_live_class(db, live_class)
    return None


@router.post("/{course_id}/live-sessions/{live_session_id}/attendance", response_model=schemas.LiveSessionAttendanceRead, status_code=status.HTTP_201_CREATED)
def record_live_session_attendance(
    course_id: int,
    live_session_id: int,
    payload: schemas.LiveSessionAttendanceCreate,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    live_class = course_service.get_live_class_by_id(db, live_session_id, organization.id)
    if not live_class or live_class.course_id != course_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Live session not found.")

    return course_service.create_live_class_attendance(db, live_class, current_user, payload.status)


@router.get("/{course_id}/live-sessions/{live_session_id}/attendance", response_model=List[schemas.LiveSessionAttendanceRead])
def list_live_session_attendance(
    course_id: int,
    live_session_id: int,
    limit: int = 50,
    offset: int = 0,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    live_class = course_service.get_live_class_by_id(db, live_session_id, organization.id)
    if not live_class or live_class.course_id != course_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Live session not found.")

    return course_service.get_live_class_attendance(db, live_class.id, organization.id, limit=limit, offset=offset)


@router.post("/{course_id}/live-sessions/{live_session_id}/recordings", response_model=schemas.LiveSessionRecordingRead, status_code=status.HTTP_201_CREATED)
async def upload_live_session_recording(
    course_id: int,
    live_session_id: int,
    title: str = Form(...),
    file: UploadFile = File(...),
    duration_minutes: int | None = Form(None),
    notes: str | None = Form(None),
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("instructor", "organization_admin", "super_admin", "admin")),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    live_class = course_service.get_live_class_by_id(db, live_session_id, organization.id)
    if not live_class or live_class.course_id != course_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Live session not found.")

    storage_service = FileStorageService()
    file_bytes = await file.read()
    content_type = file.content_type or "application/octet-stream"
    try:
        storage_service.validate_file_type(content_type, file.filename)
        storage_service.validate_file_size(len(file_bytes))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    upload_key = f"live-recordings/{organization.slug}/{live_class.id}/{file.filename}"
    upload_result = storage_service.upload_file(upload_key, file_bytes, content_type)
    return course_service.create_live_class_recording(
        db=db,
        live_class=live_class,
        uploaded_by=current_user,
        title=title,
        file_url=upload_result["url"],
        file_key=upload_key,
        duration_minutes=duration_minutes,
        notes=notes,
    )


@router.get("/{course_id}/live-sessions/{live_session_id}/recordings", response_model=List[schemas.LiveSessionRecordingRead])
def list_live_session_recordings(
    course_id: int,
    live_session_id: int,
    limit: int = 25,
    offset: int = 0,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    live_class = course_service.get_live_class_by_id(db, live_session_id, organization.id)
    if not live_class or live_class.course_id != course_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Live session not found.")

    return course_service.list_live_class_recordings(db, live_class.id, organization.id, limit=limit, offset=offset)


@router.post("/modules", response_model=schemas.ModuleRead, status_code=status.HTTP_201_CREATED)
def create_module(
    payload: schemas.ModuleCreate,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("instructor", "organization_admin", "super_admin", "admin")),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    try:
        return course_service.create_module(db, organization, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.put("/modules/{module_id}", response_model=schemas.ModuleRead)
def update_module(
    module_id: int,
    payload: schemas.ModuleUpdate,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("instructor", "organization_admin", "super_admin", "admin")),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    module = course_service.get_module_by_id(db, module_id, organization.id)
    if not module:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Module not found.")

    try:
        return course_service.update_module(db, module, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.delete("/modules/{module_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_module(
    module_id: int,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("instructor", "organization_admin", "super_admin", "admin")),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    module = course_service.get_module_by_id(db, module_id, organization.id)
    if not module:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Module not found.")

    course_service.soft_delete_module(db, module)
    return None


@router.get("/modules/{module_id}", response_model=schemas.ModuleRead)
def get_module(
    module_id: int,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    module = course_service.get_module_by_id(db, module_id, organization.id)
    if not module:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Module not found.")
    return module


@router.put("/courses/{course_id}/modules/order", response_model=List[schemas.ModuleRead])
def reorder_modules(
    course_id: int,
    payload: schemas.ModuleOrderUpdate,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("instructor", "organization_admin", "super_admin", "admin")),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    course = course_service.get_course_by_id(db, course_id, organization.id)
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found.")

    try:
        return course_service.reorder_course_modules(db, organization.id, course.id, payload.module_ids)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/lessons", response_model=schemas.LessonRead, status_code=status.HTTP_201_CREATED)
def create_lesson(
    payload: schemas.LessonCreate,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    print("Create lesson request received", {
        "tenant_id": tenant_id,
        "user_id": getattr(current_user, 'id', None),
        "user_role": getattr(current_user, 'role_name', None),
        "payload": payload,
    })

    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    try:
        return course_service.create_lesson(db, organization, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.put("/lessons/{lesson_id}", response_model=schemas.LessonRead)
def update_lesson(
    lesson_id: int,
    payload: schemas.LessonUpdate,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("instructor", "organization_admin", "super_admin", "admin")),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    lesson = course_service.get_lesson_by_id(db, lesson_id, organization.id)
    if not lesson:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lesson not found.")

    try:
        return course_service.update_lesson(db, lesson, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.delete("/lessons/{lesson_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_lesson(
    lesson_id: int,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("instructor", "organization_admin", "super_admin", "admin")),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    lesson = course_service.get_lesson_by_id(db, lesson_id, organization.id)
    if not lesson:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lesson not found.")

    course_service.soft_delete_lesson(db, lesson)
    return None


@router.get("/lessons/{lesson_id}", response_model=schemas.LessonRead)
def get_lesson(
    lesson_id: int,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    lesson = course_service.get_lesson_by_id(db, lesson_id, organization.id)
    if not lesson:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lesson not found.")
    return lesson


@router.put("/modules/{module_id}/lessons/order", response_model=List[schemas.LessonRead])
def reorder_lessons(
    module_id: int,
    payload: schemas.LessonOrderUpdate,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("instructor", "organization_admin", "super_admin", "admin")),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    module = course_service.get_module_by_id(db, module_id, organization.id)
    if not module:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Module not found.")

    try:
        return course_service.reorder_module_lessons(db, organization.id, module.id, payload.lesson_ids)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/lessons/{lesson_id}/complete", response_model=schemas.LessonCompletionRead, status_code=status.HTTP_201_CREATED)
def complete_lesson(
    lesson_id: int,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    try:
        return course_service.complete_lesson(db, current_user, lesson_id, organization.id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/course/{course_id}/structure", response_model=schemas.CourseStructureRead)
def get_course_structure(
    course_id: int,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")

    course = course_service.get_course_by_id(db, course_id, organization.id)
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found.")

    modules = course_service.get_course_structure(db, organization.id, course.id)
    return schemas.CourseStructureRead(
        id=course.id,
        title=course.title,
        slug=course.slug,
        description=course.description,
        modules=modules,
    )


@router.get("/categories", response_model=List[schemas.CourseCategoryRead])
def list_course_categories(
    limit: int = 50,
    offset: int = 0,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    return course_service.get_organization_categories(db, organization.id, limit=limit, offset=offset)


@router.post("/categories", response_model=schemas.CourseCategoryRead, status_code=status.HTTP_201_CREATED)
def create_course_category(
    payload: schemas.CourseCategoryCreate,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    try:
        return course_service.create_course_category(db, organization, payload.name, payload.description)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/categories/{category_id}", response_model=schemas.CourseCategoryRead)
def get_course_category(
    category_id: int,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")

    category = course_service.get_organization_category(db, category_id, organization.id)
    if not category:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found.")
    return category


@router.put("/categories/{category_id}", response_model=schemas.CourseCategoryRead)
def update_course_category(
    category_id: int,
    payload: schemas.CourseCategoryUpdate,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    category = course_service.get_organization_category(db, category_id, organization.id)
    if not category:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found.")

    try:
        return course_service.update_course_category(db, category, payload.name, payload.description)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.delete("/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_course_category(
    category_id: int,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    category = course_service.get_organization_category(db, category_id, organization.id)
    if not category:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found.")

    course_service.soft_delete_course_category(db, category)
    return None


@router.get("/tags", response_model=List[schemas.CourseTagRead])
def list_course_tags(
    limit: int = 50,
    offset: int = 0,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    return course_service.get_organization_tags(db, organization.id, limit=limit, offset=offset)


@router.post("/tags", response_model=schemas.CourseTagRead, status_code=status.HTTP_201_CREATED)
def create_course_tag(
    payload: schemas.CourseTagCreate,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    try:
        return course_service.create_course_tag(db, organization, payload.name)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/tags/{tag_id}", response_model=schemas.CourseTagRead)
def get_course_tag(
    tag_id: int,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")

    tag = course_service.get_organization_tag(db, tag_id, organization.id)
    if not tag:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tag not found.")
    return tag


@router.put("/tags/{tag_id}", response_model=schemas.CourseTagRead)
def update_course_tag(
    tag_id: int,
    payload: schemas.CourseTagUpdate,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    tag = course_service.get_organization_tag(db, tag_id, organization.id)
    if not tag:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tag not found.")

    try:
        return course_service.update_course_tag(db, tag, payload.name)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.delete("/tags/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_course_tag(
    tag_id: int,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    tag = course_service.get_organization_tag(db, tag_id, organization.id)
    if not tag:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tag not found.")

    course_service.soft_delete_course_tag(db, tag)
    return None


@router.get("/{course_id}/reviews", response_model=List[schemas.ReviewRead])
def list_course_reviews(
    course_id: int,
    limit: int = 50,
    offset: int = 0,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")

    course = course_service.get_course_by_id(db, course_id, organization.id)
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found.")
    return course_service.get_course_reviews(db, course_id, organization.id, limit=limit, offset=offset, approved_only=True)


@router.get("/{course_id}/reviews/moderation", response_model=List[schemas.ReviewRead])
def list_course_reviews_moderation(
    course_id: int,
    limit: int = 50,
    offset: int = 0,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    course = course_service.get_course_by_id(db, course_id, organization.id)
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found.")
    return course_service.get_course_reviews(db, course_id, organization.id, limit=limit, offset=offset, approved_only=False)


@router.post("/{course_id}/reviews", response_model=schemas.ReviewRead, status_code=status.HTTP_201_CREATED)
def create_course_review(
    course_id: int,
    payload: schemas.ReviewCreate,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    course = course_service.get_course_by_id(db, course_id, organization.id)
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found.")

    try:
        return course_service.create_review(db, course, current_user, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.patch("/{course_id}/reviews/{review_id}", response_model=schemas.ReviewRead)
def moderate_course_review(
    course_id: int,
    review_id: int,
    payload: schemas.ReviewModerationUpdate,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    course = course_service.get_course_by_id(db, course_id, organization.id)
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found.")

    review = course_service.get_review_by_id(db, review_id, organization.id)
    if not review or review.course_id != course.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review not found.")

    return course_service.update_review_moderation(db, review, payload.is_featured, payload.approved_at)


@router.post("/", response_model=schemas.CourseRead, status_code=status.HTTP_201_CREATED)
def create_course(
    payload: schemas.CourseCreate,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("instructor", "organization_admin", "super_admin")),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    try:
        return course_service.create_course(db, organization, current_user, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except IntegrityError as exc:
        if "slug" in str(exc).lower() or "unique" in str(exc).lower():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Course slug must be unique within the organization.") from exc
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Course creation failed due to a data constraint.") from exc


@router.put("/{course_id}", response_model=schemas.CourseRead)
def update_course(
    course_id: int,
    payload: schemas.CourseUpdate,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("instructor", "organization_admin", "super_admin")),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    course = course_service.get_course_by_id(db, course_id, organization.id)
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found.")

    try:
        return course_service.update_course(db, course, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except IntegrityError as exc:
        if "slug" in str(exc).lower() or "unique" in str(exc).lower():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Course slug must be unique within the organization.") from exc
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Course update failed due to a data constraint.") from exc


@router.delete("/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_course(
    course_id: int,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("instructor", "organization_admin", "super_admin", "admin")),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    course = course_service.get_course_by_id(db, course_id, organization.id)
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found.")

    course_service.soft_delete_course(db, course)
    return None


@router.post("/{course_id}/enroll", response_model=schemas.EnrollmentRead, status_code=status.HTTP_201_CREATED)
def enroll_in_course(
    course_id: int,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    try:
        enrollment = enrollment_service.enroll_user_in_course(
            db, current_user.id, organization.id, schemas.EnrollmentCreate(course_id=course_id)
        )
        return enrollment
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.delete("/{course_id}/enroll", status_code=status.HTTP_204_NO_CONTENT)
def unenroll_from_course(
    course_id: int,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    success = enrollment_service.unenroll_user_from_course(db, current_user.id, course_id, organization.id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Enrollment not found.")
    return None


@router.get("/{course_id}/enrollment", response_model=schemas.EnrollmentRead)
def get_course_enrollment(
    course_id: int,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    enrollment = enrollment_service.get_user_enrollment(db, current_user.id, course_id, organization.id)
    if not enrollment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not enrolled in this course.")
    return enrollment
