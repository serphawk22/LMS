from datetime import datetime
import base64
from typing import List
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile, status
from fastapi.params import File as FileParam
from sqlalchemy.orm import Session

from app import schemas
from app.config import settings
from app.dependencies import get_current_active_user, get_db, get_tenant, require_roles
from app.models import Assignment, AssignmentSubmission, User
from app.services import auth as auth_service
from app.services import assignments as assignment_service
from app.services.storage import FileStorageService
from app.utils.s3 import S3StorageClient

router = APIRouter()
storage_service = FileStorageService()


def _can_manage_assignments(user: User) -> bool:
    return (user.role_name or "").lower() in {"instructor", "organization_admin", "super_admin"}


def _is_valid_submission_link(link: str | None) -> bool:
    if not link:
        return False
    try:
        parsed = urlparse(link.strip())
        return parsed.scheme in {"http", "https"} and bool(parsed.netloc)
    except Exception:
        return False


def _get_storage_client() -> S3StorageClient | None:
    if settings.s3_bucket and settings.s3_region:
        return S3StorageClient(
            settings.s3_bucket,
            settings.s3_region,
            settings.aws_access_key_id,
            settings.aws_secret_access_key,
        )
    return None


def _get_submission_type(submission: AssignmentSubmission) -> str:
    has_link = bool(
        submission.content
        and submission.content.strip().lower().startswith(('http://', 'https://'))
    )
    has_text = bool(submission.content and not has_link and submission.content.strip())
    has_files = bool(submission.attachments and len(submission.attachments) > 0)
    if has_link and has_files:
        return 'mixed'
    if has_files:
        return 'file'
    if has_link:
        return 'link'
    if has_text:
        return 'text'
    return 'none'


@router.get("/", response_model=List[schemas.AssignmentRead])
def list_assignments(
    course_id: int | None = None,
    instructor: bool = False,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    include_unpublished = _can_manage_assignments(current_user)
    creator_id = None
    if instructor and _can_manage_assignments(current_user):
        creator_id = current_user.id
    assignments = assignment_service.get_organization_assignments(
        db,
        organization.id,
        course_id=course_id,
        include_unpublished=include_unpublished,
        creator_id=creator_id,
    )
    # Add submissions_count to each assignment
    result = []
    for a in assignments:
        submissions_count = len(assignment_service.get_assignment_submissions(db, a.id, organization.id))
        assignment_dict = a.__dict__.copy()
        course = getattr(a, "course", None)
        assignment_dict['course_name'] = course.title if course is not None else None
        result.append(schemas.AssignmentRead(**assignment_dict))
    return result


@router.get("/student", response_model=List[schemas.AssignmentRead])
def list_student_assignments(
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    # Get assignments for courses the student is enrolled in
    assignments = assignment_service.get_student_assignments(db, current_user.id, organization.id)
    
    # Add submission info to each assignment
    result: List[schemas.AssignmentRead] = []
    for a in assignments:
        submission = assignment_service.get_user_assignment_submission(db, a.id, current_user.id, organization.id)
        assignment_dict = a.__dict__.copy()
        assignment_dict['submissions_count'] = 0  # Not needed for students
        course = getattr(a, "course", None)
        assignment_dict['course_name'] = course.title if course is not None else None
        assignment_dict['submission'] = submission
        result.append(schemas.AssignmentRead(**assignment_dict))
    return result


@router.get("/{assignment_id}", response_model=schemas.AssignmentRead)
def get_assignment(
    assignment_id: int,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    assignment = assignment_service.get_assignment_by_id(db, assignment_id, organization.id)
    if not assignment or (
        not _can_manage_assignments(current_user) and not assignment.published
    ):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found.")
    return assignment


@router.post("/", response_model=schemas.AssignmentRead, status_code=status.HTTP_201_CREATED)
def create_assignment(
    payload: schemas.AssignmentCreate,
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
        return assignment_service.create_assignment(db, organization, current_user, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/create-with-files", response_model=schemas.AssignmentRead, status_code=status.HTTP_201_CREATED)
async def create_assignment_with_files(
    course_id: int = Form(...),
    title: str = Form(...),
    instructions: str | None = Form(None),
    due_date: str | None = Form(None),
    max_score: int = Form(0),
    published: bool = Form(False),
    allow_late_submission: bool = Form(False),
    attachments: List[UploadFile] | None = FileParam(None),
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("instructor", "organization_admin", "super_admin")),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    storage_client = _get_storage_client()
    attachment_payload = []
    upload_items = []
    if attachments:
        if isinstance(attachments, list):
            upload_items = attachments
        elif getattr(attachments, "filename", None) is not None:
            upload_items = [attachments]
    for upload in upload_items:
        file_bytes = await upload.read()
        content_type = upload.content_type or "application/octet-stream"
        try:
            storage_service.validate_file_size(len(file_bytes))
            storage_service.validate_file_type(content_type, upload.filename)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

            attachment_data = {
                "filename": upload.filename,
                "mime_type": content_type,
                "size": len(file_bytes),
            }
            if storage_client:
                upload_key = f"assignments/{current_user.id}/{upload.filename}"
                upload_result = storage_client.upload_file(
                    upload_key,
                    file_bytes,
                    content_type,
                )
                attachment_data["key"] = upload_key
                attachment_data["url"] = upload_result["url"]
            else:
                attachment_data["content"] = base64.b64encode(file_bytes).decode("utf-8")
            attachment_payload.append(attachment_data)

    payload = schemas.AssignmentCreate(
        course_id=course_id,
        title=title,
        instructions=instructions,
        due_date=due_date,
        max_score=max_score,
        published=published,
        allow_late_submission=allow_late_submission,
        attachments=attachment_payload or None,
    )

    try:
        return assignment_service.create_assignment(db, organization, current_user, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.put("/{assignment_id}", response_model=schemas.AssignmentRead)
def update_assignment(
    assignment_id: int,
    payload: schemas.AssignmentUpdate,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("instructor", "organization_admin", "super_admin")),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    assignment = assignment_service.get_assignment_by_id(db, assignment_id, organization.id)
    if not assignment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found.")

    try:
        return assignment_service.update_assignment(db, assignment, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.delete("/{assignment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_assignment(
    assignment_id: int,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("instructor", "organization_admin", "super_admin")),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    assignment = assignment_service.get_assignment_by_id(db, assignment_id, organization.id)
    if not assignment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found.")

    assignment_service.soft_delete_assignment(db, assignment)
    return None


@router.post("/{assignment_id}/submit", response_model=schemas.AssignmentSubmissionRead, status_code=status.HTTP_201_CREATED)
async def submit_assignment(
    assignment_id: int,
    submission_link: str | None = Form(None),
    text_content: str | None = Form(None),
    student_id: int | None = Form(None),
    assignment_id_form: int | None = Form(None, alias='assignment_id'),
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Submit an assignment with a link to student work.
    Accepts FormData with:
    - assignment_id (optional): Assignment ID, also provided via path parameter
    - student_id (optional): ID of the submitting student (validated against the authenticated user)
    - submission_link: URL to the student's work
    - text_content: fallback field for legacy support
    """
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    if assignment_id_form is not None and assignment_id_form != assignment_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="assignment_id form field must match route assignment_id",
        )
    if student_id is not None and student_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="student_id does not match authenticated user",
        )

    assignment = assignment_service.get_assignment_by_id(db, assignment_id, organization.id)
    if not assignment or not assignment.published:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found.")

    submission_link_value = submission_link or text_content
    if not submission_link_value or not _is_valid_submission_link(submission_link_value):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Submission must include a valid URL to your work.",
        )

    submission_payload = schemas.AssignmentSubmissionCreate(
        content=submission_link_value.strip(),
    )

    try:
        submission = assignment_service.submit_assignment(db, assignment, current_user, submission_payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    late = False
    if assignment.due_date and submission.submitted_at > assignment.due_date:
        late = True

    return schemas.AssignmentSubmissionRead(
        id=submission.id,
        assignment_id=submission.assignment_id,
        user_id=submission.user_id,
        student_name=getattr(getattr(submission, 'user', None), 'full_name', None),
        submission_type=_get_submission_type(submission),
        submitted_at=submission.submitted_at,
        content=submission.content,
        attachments=submission.attachments,
        grade=submission.grade,
        feedback=submission.feedback,
        status=submission.status,
        late=late,
        graded_at=submission.graded_at,
        graded_by=submission.graded_by,
    )


@router.get("/submissions/{submission_id}/attachments/{filename}/download")
def get_assignment_submission_attachment_download(
    submission_id: int,
    filename: str,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    submission = assignment_service.get_submission_by_id(db, submission_id, organization.id)
    if not submission:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found.")

    if current_user.id != submission.user_id and not _can_manage_assignments(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to access this submission.")

    assignment = assignment_service.get_assignment_by_id(db, submission.assignment_id, organization.id)
    if not assignment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found.")

    attachment = None
    if submission.attachments:
        attachment = next((item for item in submission.attachments if item.get("filename") == filename), None)

    if not attachment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attachment not found.")

    storage_client = _get_storage_client()
    if not storage_client:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Storage is not configured.")

    if not attachment.get("key"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Attachment is not stored in external storage.")

    try:
        presigned_url = storage_client.generate_presigned_url(attachment["key"], expires_in=900)
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc

    return {"url": presigned_url}


@router.get("/{assignment_id}/submissions", response_model=List[schemas.AssignmentSubmissionRead])
def list_assignment_submissions(
    assignment_id: int,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("instructor", "organization_admin", "super_admin")),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    assignment = assignment_service.get_assignment_by_id(db, assignment_id, organization.id)
    if not assignment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found.")

    submissions = assignment_service.get_assignment_submissions(db, assignment.id, organization.id)
    result: List[schemas.AssignmentSubmissionRead] = []
    for submission in submissions:
        late = False
        if assignment.due_date and submission.submitted_at > assignment.due_date:
            late = True
        result.append(
            schemas.AssignmentSubmissionRead(
                id=submission.id,
                assignment_id=submission.assignment_id,
                user_id=submission.user_id,
                student_name=getattr(submission.user, 'full_name', None),
                submission_type=_get_submission_type(submission),
                submitted_at=submission.submitted_at,
                content=submission.content,
                attachments=submission.attachments,
                grade=submission.grade,
                feedback=submission.feedback,
                status=submission.status,
                late=late,
                graded_at=submission.graded_at,
                graded_by=submission.graded_by,
            )
        )
    return result


@router.get("/{assignment_id}/submissions/me", response_model=schemas.AssignmentSubmissionRead)
def get_my_assignment_submission(
    assignment_id: int,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    assignment = assignment_service.get_assignment_by_id(db, assignment_id, organization.id)
    if not assignment or not assignment.published:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found.")

    submission = assignment_service.get_user_assignment_submission(db, assignment.id, current_user.id, organization.id)
    if not submission:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found.")

    late = False
    if assignment.due_date and submission.submitted_at > assignment.due_date:
        late = True

    return schemas.AssignmentSubmissionRead(
        id=submission.id,
        assignment_id=submission.assignment_id,
        user_id=submission.user_id,
        student_name=getattr(submission.user, 'full_name', None),
        submission_type=_get_submission_type(submission),
        submitted_at=submission.submitted_at,
        content=submission.content,
        attachments=submission.attachments,
        grade=submission.grade,
        feedback=submission.feedback,
        status=submission.status,
        late=late,
        graded_at=submission.graded_at,
        graded_by=submission.graded_by,
    )


@router.post("/submissions/{submission_id}/grade", response_model=schemas.AssignmentSubmissionRead)
def grade_assignment_submission(
    submission_id: int,
    payload: schemas.AssignmentGradePayload,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("instructor", "organization_admin", "super_admin")),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    submission = assignment_service.get_submission_by_id(db, submission_id, organization.id)
    if not submission:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found.")

    submission = assignment_service.grade_assignment_submission(db, submission, payload, current_user.id)
    assignment = assignment_service.get_assignment_by_id(db, submission.assignment_id, organization.id)
    late = False
    if assignment and assignment.due_date and submission.submitted_at > assignment.due_date:
        late = True

    return schemas.AssignmentSubmissionRead(
        id=submission.id,
        assignment_id=submission.assignment_id,
        user_id=submission.user_id,
        student_name=getattr(submission.user, 'full_name', None),
        submission_type=_get_submission_type(submission),
        submitted_at=submission.submitted_at,
        content=submission.content,
        attachments=submission.attachments,
        grade=submission.grade,
        feedback=submission.feedback,
        status=submission.status,
        late=late,
        graded_at=submission.graded_at,
        graded_by=submission.graded_by,
    )
