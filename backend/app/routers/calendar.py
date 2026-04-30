"""Calendar router for fetching events (announcements and live classes)."""

import logging
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import schemas
from app.dependencies import get_current_active_user, get_db, get_tenant
from app.models import User, Announcement, LiveClass, Enrollment
from app.services import auth as auth_service

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/events", response_model=List[schemas.CalendarEventRead])
def get_calendar_events(
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Get calendar events (announcements and live classes) for the current user.
    
    Returns both published announcements and live classes that the user is enrolled in.
    """
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    events = []

    # Fetch announcements
    try:
        announcements = db.query(Announcement).filter(
            Announcement.organization_id == organization.id,
            Announcement.published == True,
            Announcement.is_deleted == False
        ).all()

        for announcement in announcements:
            # Get the date from published_at
            event_date = announcement.published_at.strftime("%Y-%m-%d") if announcement.published_at else None
            
            if event_date:
                events.append(
                    schemas.CalendarEventRead(
                        id=announcement.id,
                        title=announcement.title,
                        date=event_date,
                        type="announcement",
                        description=announcement.content if announcement.content else None,
                    )
                )
    except Exception as e:
        logger.error(f"Error fetching announcements: {e}")

    # Fetch live classes for enrolled courses
    try:
        # Get all courses the user is enrolled in
        enrollments = db.query(Enrollment).filter(
            Enrollment.user_id == current_user.id,
            Enrollment.organization_id == organization.id
        ).all()

        enrolled_course_ids = [e.course_id for e in enrollments]

        if enrolled_course_ids:
            # Fetch live classes for these courses
            live_classes = db.query(LiveClass).filter(
                LiveClass.organization_id == organization.id,
                LiveClass.course_id.in_(enrolled_course_ids),
                LiveClass.is_deleted == False
            ).all()

            for live_class in live_classes:
                # Extract date and time from scheduled_at
                if live_class.scheduled_at:
                    event_date = live_class.scheduled_at.strftime("%Y-%m-%d")
                    start_time = live_class.scheduled_at.strftime("%H:%M")
                    
                    # Calculate end_time from duration
                    end_time = None
                    if live_class.duration_minutes:
                        end_datetime = live_class.scheduled_at.replace(
                            hour=live_class.scheduled_at.hour,
                            minute=live_class.scheduled_at.minute
                        )
                        # Add duration
                        from datetime import timedelta
                        end_datetime = live_class.scheduled_at + timedelta(minutes=live_class.duration_minutes)
                        end_time = end_datetime.strftime("%H:%M")
                    
                    events.append(
                        schemas.CalendarEventRead(
                            id=live_class.id,
                            title=live_class.title,
                            date=event_date,
                            type="live_class",
                            start_time=start_time,
                            end_time=end_time,
                            course_name=live_class.course_name,
                            description=live_class.description,
                        )
                    )
    except Exception as e:
        logger.error(f"Error fetching live classes: {e}")

    return events
