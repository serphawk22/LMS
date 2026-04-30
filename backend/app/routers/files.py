from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from sqlalchemy.orm import Session

from app import schemas
from app.dependencies import get_current_active_user, get_db, get_tenant
from app.models import Enrollment, EnrollmentStatus
from app.services import courses as course_service
from app.services.auth import get_organization_by_tenant
from app.services.storage import FileStorageService

router = APIRouter()
storage_service = FileStorageService()


@router.post("/upload", response_model=schemas.FileMetadataRead, status_code=status.HTTP_201_CREATED)
async def upload_file(
    request: Request,
    file: UploadFile = File(...),
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user),
):
    organization = get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    file_bytes = await file.read()
    content_type = file.content_type or "application/octet-stream"

    try:
        storage_service.validate_file_size(len(file_bytes))
        storage_service.validate_file_type(content_type, file.filename)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    try:
        # Use local storage for all file uploads
        directory = f"{organization.slug}/{current_user.id}"
        upload_result = storage_service.upload_file_local(
            directory=directory,
            filename=file.filename or "file",
            body=file_bytes
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc

    file_url = upload_result["url"]
    if not file_url.startswith("http://") and not file_url.startswith("https://"):
        origin = f"{request.url.scheme}://{request.url.netloc}"
        file_url = f"{origin.rstrip('/')}/{file_url.lstrip('/')}"

    return schemas.FileMetadataRead(
        key=upload_result["filename"],
        filename=file.filename,
        content_type=content_type,
        size=len(file_bytes),
        url=file_url,
    )


@router.get("/download", response_model=schemas.FileDownloadRead)
def download_file(
    request: Request,
    key: str,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user),
):
    organization = get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    try:
        storage_service.validate_object_key_for_tenant(key=key, organization_slug=organization.slug)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc

    if storage_service.client is None:
        direct_url = f"{request.url.scheme}://{request.url.netloc}/{key}"
        filename = key.split("/")[-1]
        return schemas.FileDownloadRead(key=key, filename=filename, url=direct_url)

    try:
        presigned_url = storage_service.generate_presigned_url(key=key)
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc

    filename = key.split("/")[-1]
    return schemas.FileDownloadRead(key=key, filename=filename, url=presigned_url)


@router.get("/video-stream", response_model=schemas.FileDownloadRead)
def get_lesson_video_stream(
    request: Request,
    lesson_id: int,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user),
):
    organization = get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    lesson = course_service.get_lesson_by_id(db, lesson_id, organization.id)
    if not lesson:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lesson not found.")
    if lesson.lesson_type != "video_upload":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Lesson is not a video upload.")

    if current_user.role_name not in {"instructor", "organization_admin", "super_admin"}:
        enrollment = db.query(Enrollment).filter(
            Enrollment.user_id == current_user.id,
            Enrollment.course_id == lesson.course_id,
            Enrollment.organization_id == organization.id,
            Enrollment.is_deleted == False,
            Enrollment.status != EnrollmentStatus.cancelled,
        ).one_or_none()
        if not enrollment:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enrolled in the course.")

    content_payload = lesson.content_payload or {}
    file_url = content_payload.get("file_url")
    if not file_url:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Video file URL is missing.")

    try:
        key = storage_service.parse_object_key_from_url(file_url)
        storage_service.validate_object_key_for_tenant(key=key, organization_slug=organization.slug)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    filename = key.split("/")[-1]
    if storage_service.client is None:
        direct_url = f"{request.url.scheme}://{request.url.netloc}/{key}"
        return schemas.FileDownloadRead(key=key, filename=filename, url=direct_url)

    try:
        presigned_url = storage_service.generate_presigned_url(
            key=key,
            expires_in=1000,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc

    return schemas.FileDownloadRead(key=key, filename=filename, url=presigned_url)
