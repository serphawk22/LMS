import io
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app import schemas
from app.dependencies import get_current_active_user, get_current_admin_user, get_db, get_tenant
from app.models import Certificate, User
from app.services import auth as auth_service
from app.services import certificates as certificate_service

router = APIRouter()


@router.get("/templates", response_model=List[schemas.CertificateTemplateRead])
def list_certificate_templates(
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    templates = certificate_service.get_certificate_templates(db, organization.id)
    return [schemas.CertificateTemplateRead.from_orm(template) for template in templates]


@router.post("/templates", response_model=schemas.CertificateTemplateRead, status_code=status.HTTP_201_CREATED)
def create_certificate_template(
    payload: schemas.CertificateTemplateCreate,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    return certificate_service.create_certificate_template(db, organization.id, payload)


@router.put("/templates/{template_id}", response_model=schemas.CertificateTemplateRead)
def update_certificate_template(
    template_id: int,
    payload: schemas.CertificateTemplateUpdate,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    template = certificate_service.get_certificate_template_by_id(db, template_id, organization.id)
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found.")

    return certificate_service.update_certificate_template(db, template, payload)


@router.delete("/templates/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_certificate_template(
    template_id: int,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    template = certificate_service.get_certificate_template_by_id(db, template_id, organization.id)
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found.")

    certificate_service.soft_delete_certificate_template(db, template)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/", response_model=List[schemas.CertificateRead])
def list_user_certificates(
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    certificates = certificate_service.get_user_certificates(db, current_user.id, organization.id)
    return [certificate_service._serialize_certificate(certificate) for certificate in certificates]


@router.get("/{certificate_id}", response_model=schemas.CertificateRead)
def get_certificate(
    certificate_id: int,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    certificate = certificate_service.get_certificate_by_id(db, certificate_id, organization.id)
    if not certificate:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Certificate not found.")
    if certificate.user_id != current_user.id and not current_user.is_staff:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to view this certificate.")

    return certificate_service._serialize_certificate(certificate)


@router.get("/{certificate_id}/download")
def download_certificate_pdf(
    certificate_id: int,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    certificate = certificate_service.get_certificate_by_id(db, certificate_id, organization.id)
    if not certificate:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Certificate not found.")
    if certificate.user_id != current_user.id and not current_user.is_staff:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to download this certificate.")

    try:
        pdf_bytes = certificate_service.generate_certificate_pdf_bytes(certificate)
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc

    buffer = io.BytesIO(pdf_bytes)
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=certificate-{certificate.id}.pdf"},
    )


@router.post("/{certificate_id}/share", response_model=schemas.CertificateShareResponse)
def share_certificate(
    certificate_id: int,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    certificate = certificate_service.get_certificate_by_id(db, certificate_id, organization.id)
    if not certificate:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Certificate not found.")
    if certificate.user_id != current_user.id and not current_user.is_staff:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to share this certificate.")

    certificate = certificate_service.share_certificate(db, certificate)
    return schemas.CertificateShareResponse(
        share_token=certificate.share_token,
        share_url=f"/api/v1/certificates/shared/{certificate.share_token}",
    )


@router.get("/verify", response_model=schemas.CertificateVerificationRead)
def verify_certificate(token: str, db: Session = Depends(get_db)):
    certificate = certificate_service.verify_certificate(db, token)
    if not certificate:
        return schemas.CertificateVerificationRead(valid=False, certificate=None)
    return schemas.CertificateVerificationRead(valid=True, certificate=certificate_service._serialize_certificate(certificate))


@router.get("/shared/{share_token}", response_model=schemas.CertificateRead)
def get_shared_certificate(share_token: str, db: Session = Depends(get_db)):
    certificate = certificate_service.get_certificate_by_share_token(db, share_token)
    if not certificate:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shared certificate not found.")
    return certificate_service._serialize_certificate(certificate)
