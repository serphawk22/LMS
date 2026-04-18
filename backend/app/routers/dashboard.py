from fastapi import APIRouter, Depends, Form, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session

from app import schemas
from app.dependencies import get_current_active_user, get_current_admin_user, get_db, get_tenant, require_roles
from app.models import User, AdminCommentType
from app.services import dashboard as dashboard_service
from app.services import auth as auth_service

router = APIRouter()


@router.get("/overview", response_model=schemas.DashboardOverviewRead)
def get_dashboard_overview(
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    return dashboard_service.get_dashboard_overview(db, current_user)


@router.get("/notifications", response_model=list[schemas.DashboardNotificationItem])
def list_notifications(
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    return dashboard_service.list_user_notifications(db, current_user)


@router.patch("/notifications/{notification_id}/read", response_model=schemas.DashboardNotificationItem)
def mark_notification_read(
    notification_id: int,
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
        return dashboard_service.mark_notification_as_read(db, current_user, notification_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get("/admin/overview", response_model=schemas.AdminDashboardOverviewRead)
def get_admin_dashboard_overview(
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    return dashboard_service.get_admin_dashboard_overview(db, current_user)


@router.get("/admin/students", response_model=list[schemas.AdminStudentActivitySummaryRead])
def get_admin_student_activity_summary(
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    return dashboard_service.get_admin_student_activity_summary(db, current_user)


@router.get("/admin/students/{student_id}", response_model=schemas.AdminStudentActivityDetailRead)
def get_admin_student_activity_details(
    student_id: int,
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
        return dashboard_service.get_admin_student_activity_details(db, student_id, current_user)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get("/admin/instructors", response_model=list[schemas.AdminInstructorActivitySummaryRead])
def get_admin_instructor_activity_summary(
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    return dashboard_service.get_admin_instructor_activity_summary(db, current_user)


@router.get("/admin/instructors/{instructor_id}", response_model=schemas.AdminInstructorActivityDetailRead)
def get_admin_instructor_activity_details(
    instructor_id: int,
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
        return dashboard_service.get_admin_instructor_activity_details(db, instructor_id, current_user)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get("/admin/comments/{comment_type}/{related_id}", response_model=list[schemas.AdminCommentRead])
def get_admin_comments(
    comment_type: AdminCommentType,
    related_id: int,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    return dashboard_service.get_admin_comments(db, comment_type, related_id, current_user)


@router.post("/admin/comments/{comment_type}/{related_id}", response_model=schemas.AdminCommentRead)
def create_admin_comment(
    comment_type: AdminCommentType,
    related_id: int,
    comment_data: schemas.AdminCommentCreate,
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
        return dashboard_service.create_admin_comment(
            db, comment_type, related_id, comment_data.content, current_user
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/admin/comments", response_model=schemas.AdminCommentListRead)
def post_admin_comment(
    comment_data: schemas.AdminCommentCreateRequest,
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
        comment_type = AdminCommentType(comment_data.target_type.value)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid target_type.")

    comment = dashboard_service.create_admin_comment(
        db,
        comment_type,
        comment_data.target_id,
        comment_data.comment,
        current_user,
    )

    return {
        "id": comment["id"],
        "target_type": comment_data.target_type.value,
        "target_name": None,
        "comment": comment["content"],
        "created_at": comment["created_at"],
    }


@router.get("/admin/comments", response_model=list[schemas.AdminCommentListRead])
def get_admin_comments_list(
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    return dashboard_service.list_admin_comments(db, current_user)


@router.get("/admin/student-submissions", response_model=list[schemas.AdminStudentSubmissionRead])
def get_admin_student_submissions(
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    return dashboard_service.get_admin_student_submissions(db, current_user)


@router.get("/admin/instructor-activity", response_model=list[schemas.AdminInstructorActivityRead])
def get_admin_instructor_activity(
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    return dashboard_service.get_admin_instructor_activity(db, current_user)


@router.get("/instructor/courses", response_model=list[schemas.InstructorCourseRead])
def get_instructor_courses(
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("instructor")),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    return dashboard_service.get_instructor_courses(db, current_user)


@router.get("/instructor/courses/{course_id}/students", response_model=list[schemas.EnrolledStudentRead])
def get_course_enrolled_students(
    course_id: int,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("instructor")),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    return dashboard_service.get_course_enrolled_students(db, course_id, current_user)


@router.get("/instructor/courses/{course_id}/progress", response_model=list[schemas.CourseStudentProgressRead])
def get_course_student_progress(
    course_id: int,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("instructor")),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    return dashboard_service.get_course_student_progress(db, course_id, current_user)


@router.get("/instructor/courses/{course_id}/analytics", response_model=schemas.CourseAnalyticsRead)
def get_course_analytics(
    course_id: int,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("instructor")),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    return dashboard_service.get_course_analytics(db, course_id, current_user)


@router.get("/admin/courses/{course_id}/analytics", response_model=schemas.CourseAnalyticsRead)
def get_admin_course_analytics(
    course_id: int,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    return dashboard_service.get_admin_course_analytics(db, course_id, current_user)


@router.get("/daily-videos/today", response_model=list[schemas.DailyLearningVideoRead])
def get_daily_learning_videos_today(
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    return dashboard_service.get_daily_learning_videos_today(db, current_user)


@router.get("/daily-videos", response_model=list[schemas.DailyLearningVideoRead])
def get_daily_learning_videos(
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    return dashboard_service.get_daily_learning_videos_today(db, current_user)


@router.post("/daily-video/upload", response_model=schemas.DailyLearningVideoRead)
def upload_daily_learning_video(
    title: str = Form(...),
    description: str = Form(...),
    vimeo_url: str | None = Form(None),
    user_id: int | None = Form(None),
    video_file: UploadFile | None = File(None),
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("student")),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    if not title or not title.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Title is required.")
    if not description or not description.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Description is required.")

    if video_file is not None and vimeo_url and vimeo_url.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Please choose only one option.")
    if video_file is None and not (vimeo_url and vimeo_url.strip()):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Please upload a video or provide a Vimeo link.")

    try:
        return dashboard_service.upload_daily_learning_video(
            db,
            current_user,
            title.strip(),
            description.strip(),
            video_file,
            vimeo_url.strip() if vimeo_url else None,
        )
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Upload failed: {str(exc)}") from exc
