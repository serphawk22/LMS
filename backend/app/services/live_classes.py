from datetime import datetime, timedelta, timezone
from enum import Enum as PyEnum
from typing import List, Optional

from sqlalchemy import and_, desc, or_
from sqlalchemy.orm import Session

from app.models import LiveClass, LiveClassAttendance, Notification, User, Course, Enrollment
from app.schemas.live_class import LiveClassCreate, LiveClassUpdate, LiveSessionProvider


def get_live_class_by_id(db: Session, live_class_id: int, organization_id: int) -> Optional[LiveClass]:
    """Get a live class by ID, ensuring it belongs to the organization."""
    return db.query(LiveClass).filter(
        and_(
            LiveClass.id == live_class_id,
            LiveClass.organization_id == organization_id,
            LiveClass.is_deleted == False,
        )
    ).first()


def _is_live_class_ongoing(live_class: LiveClass, now: datetime) -> bool:
    if live_class.duration_minutes is None:
        return False

    end_time = live_class.scheduled_at + timedelta(minutes=live_class.duration_minutes)
    return live_class.scheduled_at <= now < end_time


def _filter_upcoming_or_ongoing(
    live_classes: list[LiveClass],
    now: datetime,
    limit: int,
    offset: int,
) -> List[LiveClass]:
    filtered = []
    for live_class in live_classes:
        if live_class.scheduled_at >= now or _is_live_class_ongoing(live_class, now):
            filtered.append(live_class)
    return filtered[offset:offset + limit]


def get_course_live_classes(
    db: Session,
    course_name: str,
    organization_id: int,
    limit: int = 50,
    offset: int = 0,
    upcoming_only: bool = False,
) -> List[LiveClass]:
    """Get live classes for a course."""
    query = db.query(LiveClass).filter(
        and_(
            LiveClass.course_name == course_name,
            LiveClass.organization_id == organization_id,
            LiveClass.is_deleted == False,
        )
    )
    
    query = query.order_by(desc(LiveClass.scheduled_at))
    if upcoming_only:
        now = datetime.now(timezone.utc)
        return _filter_upcoming_or_ongoing(query.all(), now, limit, offset)
    
    return query.limit(limit).offset(offset).all()


def get_instructor_live_classes(
    db: Session,
    instructor_id: int,
    organization_id: int,
    limit: int = 50,
    offset: int = 0,
) -> List[LiveClass]:
    """Get live classes scheduled by an instructor."""
    return db.query(LiveClass).filter(
        and_(
            LiveClass.instructor_id == instructor_id,
            LiveClass.organization_id == organization_id,
            LiveClass.is_deleted == False,
        )
    ).order_by(desc(LiveClass.scheduled_at)).limit(limit).offset(offset).all()


def get_student_live_classes(
    db: Session,
    student_id: int,
    organization_id: int,
    upcoming_only: bool = False,
    limit: int = 50,
    offset: int = 0,
) -> List[LiveClass]:
    """Get live classes for courses the student is enrolled in."""
    now = datetime.now(timezone.utc)
    
    query = db.query(LiveClass).join(
        Course,
        LiveClass.course_name == Course.title
    ).join(
        Enrollment,
        and_(
            Enrollment.course_id == Course.id,
            Enrollment.user_id == student_id,
        )
    ).filter(
        and_(
            LiveClass.organization_id == organization_id,
            LiveClass.is_deleted == False,
            Enrollment.is_deleted == False,
        )
    )
    
    query = query.order_by(desc(LiveClass.scheduled_at))
    if upcoming_only:
        return _filter_upcoming_or_ongoing(query.all(), now, limit, offset)

    return query.limit(limit).offset(offset).all()


def create_live_class(
    db: Session,
    course_name: str,
    instructor_id: int,
    organization_id: int,
    data: LiveClassCreate,
) -> LiveClass:
    """Create a new live class."""
    course = db.query(Course).filter(
        and_(
            Course.title == course_name,
            Course.organization_id == organization_id,
            Course.is_deleted == False,
        )
    ).first()
    if not course:
        raise ValueError(f"Course '{course_name}' not found")

    provider = getattr(data, 'provider', LiveSessionProvider.manual)
    provider_value = provider.value if isinstance(provider, PyEnum) else provider
    live_class = LiveClass(
        course_id=course.id,
        course_name=course_name,
        instructor_id=instructor_id,
        organization_id=organization_id,
        title=data.title,
        description=data.description,
        scheduled_at=data.scheduled_at,
        duration_minutes=data.duration_minutes,
        provider=provider_value,
        provider_join_url=data.provider_join_url,
    )
    
    db.add(live_class)
    db.commit()
    db.refresh(live_class)
    
    return live_class


def update_live_class(
    db: Session,
    live_class_id: int,
    organization_id: int,
    data: LiveClassUpdate,
) -> LiveClass:
    """Update a live class."""
    live_class = get_live_class_by_id(db, live_class_id, organization_id)
    if not live_class:
        raise ValueError(f"Live class {live_class_id} not found")
    
    # Update fields if provided
    if data.title is not None:
        live_class.title = data.title
    if data.description is not None:
        live_class.description = data.description
    if data.scheduled_at is not None:
        live_class.scheduled_at = data.scheduled_at
    if data.duration_minutes is not None:
        live_class.duration_minutes = data.duration_minutes
    if data.provider is not None:
        live_class.provider = data.provider
    if data.provider_join_url is not None:
        live_class.provider_join_url = data.provider_join_url
    
    db.commit()
    db.refresh(live_class)
    return live_class


def delete_live_class(
    db: Session,
    live_class_id: int,
    organization_id: int,
) -> None:
    """Soft delete a live class."""
    live_class = get_live_class_by_id(db, live_class_id, organization_id)
    if not live_class:
        raise ValueError(f"Live class {live_class_id} not found")
    
    live_class.is_deleted = True
    live_class.deleted_at = datetime.now(timezone.utc)
    db.commit()


def mark_attendance(
    db: Session,
    live_class_id: int,
    user_id: int,
    organization_id: int,
    status: str = "present",
) -> LiveClassAttendance:
    """Mark a user's attendance for a live class."""
    
    # Check if attendance already exists
    attendance = db.query(LiveClassAttendance).filter(
        and_(
            LiveClassAttendance.live_class_id == live_class_id,
            LiveClassAttendance.user_id == user_id,
            LiveClassAttendance.organization_id == organization_id,
            LiveClassAttendance.is_deleted == False,
        )
    ).first()
    
    if attendance:
        attendance.status = status
    else:
        attendance = LiveClassAttendance(
            live_class_id=live_class_id,
            user_id=user_id,
            organization_id=organization_id,
            status=status,
        )
        db.add(attendance)
    
    db.commit()
    db.refresh(attendance)
    return attendance


def get_live_class_attendees(
    db: Session,
    live_class_id: int,
    organization_id: int,
) -> List[LiveClassAttendance]:
    """Get all attendees for a live class."""
    return db.query(LiveClassAttendance).filter(
        and_(
            LiveClassAttendance.live_class_id == live_class_id,
            LiveClassAttendance.organization_id == organization_id,
            LiveClassAttendance.is_deleted == False,
        )
    ).all()
