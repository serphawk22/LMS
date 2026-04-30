from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class CertificateTemplateBase(BaseModel):
    name: str
    description: str | None = None
    template_html: str = Field(
        default="<h1>Certificate of Completion</h1><p>${user.full_name} has completed ${course.title}.</p><p>Issued on ${certificate.issued_at.strftime('%Y-%m-%d')}</p>",
        description="Mako-compatible certificate template HTML.",
    )


class CertificateTemplateCreate(CertificateTemplateBase):
    pass


class CertificateTemplateUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    template_html: str | None = None


class CertificateTemplateRead(CertificateTemplateBase):
    id: int
    organization_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CertificateRead(BaseModel):
    id: int
    user_id: int
    course_id: int
    template_id: int | None = None
    issued_at: datetime
    expires_at: datetime | None = None
    grade: str | None = None
    data: dict[str, Any] | None = None
    verification_token: str
    share_token: str | None = None

    model_config = ConfigDict(from_attributes=True)


class CertificateShareResponse(BaseModel):
    share_token: str
    share_url: str


class CertificateVerificationRead(BaseModel):
    valid: bool
    certificate: CertificateRead | None = None
