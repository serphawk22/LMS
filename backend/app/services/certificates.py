from __future__ import annotations

import io
import secrets
from datetime import datetime, timezone
from typing import Any, List

from mako.template import Template
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import (
    Certificate,
    CertificateTemplate,
    Course,
    Enrollment,
    EnrollmentStatus,
    Lesson,
    LessonCompletion,
    User,
)
from app.schemas.certificate import (
    CertificateRead,
    CertificateShareResponse,
    CertificateTemplateCreate,
    CertificateTemplateRead,
    CertificateTemplateUpdate,
    CertificateVerificationRead,
)


def _generate_token(length: int = 24) -> str:
    return secrets.token_urlsafe(length)


def _serialize_certificate(certificate: Certificate) -> CertificateRead:
    return CertificateRead(
        id=certificate.id,
        user_id=certificate.user_id,
        course_id=certificate.course_id,
        template_id=certificate.template_id,
        issued_at=certificate.issued_at,
        expires_at=certificate.expires_at,
        grade=certificate.grade,
        data=certificate.data,
        verification_token=certificate.verification_token,
        share_token=certificate.share_token,
    )


def get_certificate_templates(db: Session, organization_id: int) -> List[CertificateTemplate]:
    return (
        db.query(CertificateTemplate)
        .filter(CertificateTemplate.organization_id == organization_id, CertificateTemplate.is_deleted == False)
        .order_by(CertificateTemplate.created_at.desc())
        .all()
    )


def get_certificate_template_by_id(db: Session, template_id: int, organization_id: int) -> CertificateTemplate | None:
    return (
        db.query(CertificateTemplate)
        .filter(
            CertificateTemplate.id == template_id,
            CertificateTemplate.organization_id == organization_id,
            CertificateTemplate.is_deleted == False,
        )
        .one_or_none()
    )


def create_certificate_template(db: Session, organization_id: int, payload: CertificateTemplateCreate) -> CertificateTemplate:
    template = CertificateTemplate(
        organization_id=organization_id,
        name=payload.name,
        description=payload.description,
        template_html=payload.template_html,
    )
    db.add(template)
    db.commit()
    db.refresh(template)
    return template


def update_certificate_template(db: Session, template: CertificateTemplate, payload: CertificateTemplateUpdate) -> CertificateTemplate:
    for field in payload.__fields_set__:
        value = getattr(payload, field)
        if value is not None:
            setattr(template, field, value)
    db.add(template)
    db.commit()
    db.refresh(template)
    return template


def soft_delete_certificate_template(db: Session, template: CertificateTemplate) -> None:
    template.is_deleted = True
    db.add(template)
    db.commit()


def get_certificate_by_id(db: Session, certificate_id: int, organization_id: int) -> Certificate | None:
    return (
        db.query(Certificate)
        .filter(
            Certificate.id == certificate_id,
            Certificate.organization_id == organization_id,
            Certificate.is_deleted == False,
        )
        .one_or_none()
    )


def get_user_certificates(db: Session, user_id: int, organization_id: int) -> List[Certificate]:
    return (
        db.query(Certificate)
        .filter(
            Certificate.user_id == user_id,
            Certificate.organization_id == organization_id,
            Certificate.is_deleted == False,
        )
        .order_by(Certificate.issued_at.desc())
        .all()
    )


def get_certificate_by_share_token(db: Session, share_token: str) -> Certificate | None:
    return (
        db.query(Certificate)
        .filter(Certificate.share_token == share_token, Certificate.is_deleted == False)
        .one_or_none()
    )


def verify_certificate(db: Session, token: str) -> Certificate | None:
    return (
        db.query(Certificate)
        .filter(Certificate.verification_token == token, Certificate.is_deleted == False)
        .one_or_none()
    )


def get_default_certificate_template(db: Session, organization_id: int) -> CertificateTemplate | None:
    return (
        db.query(CertificateTemplate)
        .filter(CertificateTemplate.organization_id == organization_id, CertificateTemplate.is_deleted == False)
        .order_by(CertificateTemplate.created_at.desc())
        .first()
    )


def render_certificate_html(certificate: Certificate) -> str:
    template_html = (
        certificate.template.template_html if certificate.template else "<h1>Certificate of Completion</h1><p>${user.full_name} has completed ${course.title}.</p>"
    )

    try:
        template = Template(template_html)
        return template.render(user=certificate.user, course=certificate.course, certificate=certificate)
    except Exception:
        return f"<h1>Certificate of Completion</h1><p>{certificate.user.full_name} has completed {certificate.course.title}.</p>"


def generate_certificate_pdf_bytes(certificate: Certificate) -> bytes:
    try:
        from reportlab.lib.pagesizes import letter
        from reportlab.pdfgen import canvas
    except ImportError as exc:
        raise RuntimeError("PDF certificate generation is not available in this deployment.") from exc

    buffer = io.BytesIO()
    pdf_canvas = canvas.Canvas(buffer, pagesize=letter)
    width, height = letter

    pdf_canvas.setFont("Helvetica-Bold", 28)
    pdf_canvas.drawCentredString(width / 2, height - 100, "Certificate of Completion")

    pdf_canvas.setFont("Helvetica", 16)
    pdf_canvas.drawCentredString(width / 2, height - 160, f"Presented to {certificate.user.full_name}")

    pdf_canvas.setFont("Helvetica", 14)
    pdf_canvas.drawCentredString(width / 2, height - 200, f"For successfully completing {certificate.course.title}")
    pdf_canvas.drawCentredString(width / 2, height - 230, f"Issued: {certificate.issued_at.strftime('%Y-%m-%d')}")

    if certificate.grade:
        pdf_canvas.drawCentredString(width / 2, height - 260, f"Grade: {certificate.grade}")

    if certificate.verification_token:
        pdf_canvas.setFont("Helvetica-Oblique", 10)
        pdf_canvas.drawCentredString(
            width / 2,
            80,
            f"Verification code: {certificate.verification_token}",
        )

    pdf_canvas.line(80, 120, width - 80, 120)
    pdf_canvas.setFont("Helvetica", 12)
    pdf_canvas.drawCentredString(width / 2, 100, "Thank you for learning with us.")
    pdf_canvas.save()

    buffer.seek(0)
    return buffer.read()


def issue_certificate(
    db: Session,
    organization_id: int,
    user: User,
    course: Course,
    template_id: int | None = None,
    grade: str | None = None,
    expires_at: datetime | None = None,
) -> Certificate:
    existing = (
        db.query(Certificate)
        .filter(
            Certificate.user_id == user.id,
            Certificate.course_id == course.id,
            Certificate.organization_id == organization_id,
            Certificate.is_deleted == False,
        )
        .one_or_none()
    )
    if existing:
        return existing

    template = None
    if template_id is not None:
        template = get_certificate_template_by_id(db, template_id, organization_id)
        if not template:
            raise ValueError("Certificate template not found.")
    else:
        template = get_default_certificate_template(db, organization_id)

    certificate = Certificate(
        user_id=user.id,
        course_id=course.id,
        organization_id=organization_id,
        template_id=template.id if template else None,
        issued_at=datetime.now(timezone.utc),
        expires_at=expires_at,
        grade=str(grade) if grade is not None else None,
        data={
            "course_title": course.title,
            "user_name": user.full_name,
            "template_name": template.name if template else None,
        },
        verification_token=_generate_token(24),
        share_token=None,
    )
    db.add(certificate)
    db.commit()
    db.refresh(certificate)
    return certificate


def share_certificate(db: Session, certificate: Certificate) -> Certificate:
    if not certificate.share_token:
        certificate.share_token = _generate_token(24)
    db.add(certificate)
    db.commit()
    db.refresh(certificate)
    return certificate


def issue_certificate_if_course_completed(db: Session, user: User, course_id: int, organization_id: int) -> Certificate | None:
    course = (
        db.query(Course)
        .filter(Course.id == course_id, Course.organization_id == organization_id, Course.is_deleted == False)
        .one_or_none()
    )
    if not course:
        return None

    enrollment = (
        db.query(Enrollment)
        .filter(
            Enrollment.user_id == user.id,
            Enrollment.course_id == course.id,
            Enrollment.organization_id == organization_id,
            Enrollment.is_deleted == False,
        )
        .one_or_none()
    )

    total_lessons = (
        db.query(Lesson)
        .filter(Lesson.course_id == course.id, Lesson.organization_id == organization_id, Lesson.is_deleted == False)
        .count()
    )
    completed_lessons = (
        db.query(LessonCompletion)
        .filter(
            LessonCompletion.user_id == user.id,
            LessonCompletion.course_id == course.id,
            LessonCompletion.organization_id == organization_id,
            LessonCompletion.is_deleted == False,
            LessonCompletion.is_completed == True,
        )
        .count()
    )

    progress = 100.0 if total_lessons == 0 else min(100.0, (completed_lessons / total_lessons) * 100.0)

    if enrollment:
        enrollment.progress = progress
        if progress >= 100.0:
            enrollment.status = EnrollmentStatus.completed
            if not enrollment.completed_at:
                enrollment.completed_at = datetime.now(timezone.utc)
        db.add(enrollment)
        db.commit()

    if progress < 100.0:
        return None

    return issue_certificate(db, organization_id, user, course)
