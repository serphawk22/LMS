from sqlalchemy.orm import Session

from app.models import Enrollment, EnrollmentStatus, Course
from app.schemas.course import EnrollmentCreate, EnrollmentRead


def enroll_user_in_course(db: Session, user_id: int, organization_id: int, payload: EnrollmentCreate) -> Enrollment:
    # Check if already enrolled
    existing = db.query(Enrollment).filter(
        Enrollment.user_id == user_id,
        Enrollment.course_id == payload.course_id,
        Enrollment.organization_id == organization_id,
        Enrollment.is_deleted == False,
    ).first()
    if existing:
        return existing

    # Check if course exists and is published
    course = db.query(Course).filter(
        Course.id == payload.course_id,
        Course.organization_id == organization_id,
        Course.is_deleted == False,
        Course.is_published == True,
    ).first()
    if not course:
        raise ValueError("Course not found or not available for enrollment.")

    enrollment = Enrollment(
        user_id=user_id,
        course_id=payload.course_id,
        organization_id=organization_id,
        status=EnrollmentStatus.active,
        progress=0.0,
    )
    db.add(enrollment)
    db.commit()
    db.refresh(enrollment)
    return enrollment


def get_user_enrollment(db: Session, user_id: int, course_id: int, organization_id: int) -> Enrollment | None:
    return db.query(Enrollment).filter(
        Enrollment.user_id == user_id,
        Enrollment.course_id == course_id,
        Enrollment.organization_id == organization_id,
        Enrollment.is_deleted == False,
    ).first()


def unenroll_user_from_course(db: Session, user_id: int, course_id: int, organization_id: int) -> bool:
    enrollment = get_user_enrollment(db, user_id, course_id, organization_id)
    if enrollment:
        enrollment.is_deleted = True
        db.commit()
        return True
    return False