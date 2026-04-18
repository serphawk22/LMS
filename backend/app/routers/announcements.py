import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import case
from sqlalchemy.orm import Session
from typing import List

from app import schemas
from app.dependencies import get_current_active_user, get_current_admin_user, get_db, get_tenant, require_roles
from app.models import User, Announcement
from app.services import auth as auth_service

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/", response_model=List[schemas.AnnouncementRead])
def get_announcements(
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    # Get published announcements that haven't expired
    from sqlalchemy import and_, or_
    from datetime import datetime, timezone

    query = db.query(Announcement).filter(
        Announcement.organization_id == organization.id,
        Announcement.published == True,
        Announcement.deleted_at.is_(None)
    )

    # Filter out expired announcements
    query = query.filter(
        or_(
            Announcement.expires_at.is_(None),
            Announcement.expires_at > datetime.now(timezone.utc)
        )
    )

    # Order announcements by newest first
    announcements = query.order_by(
        Announcement.published_at.desc(),
        Announcement.created_at.desc()
    ).all()

    return announcements


@router.post("/", response_model=schemas.AnnouncementRead)
def create_announcement(
    announcement: schemas.AnnouncementCreate,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("instructor", "organization_admin", "super_admin")),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    from datetime import datetime, timezone

    db_announcement = Announcement(
        **announcement.model_dump(),
        organization_id=organization.id,
        created_by_id=current_user.id
    )

    if announcement.published and not announcement.published_at:
        db_announcement.published_at = datetime.now(timezone.utc)

    db.add(db_announcement)
    db.commit()
    db.refresh(db_announcement)

    if db_announcement.published:
        try:
            from app.services.dashboard import create_notifications_for_announcement

            create_notifications_for_announcement(
                db,
                db_announcement,
                organization.id,
                f"Announcement: {db_announcement.title}",
                db_announcement.content,
            )
        except Exception:
            logger.exception(
                "Failed to create announcement notifications for announcement %s",
                db_announcement.id,
            )

    return db_announcement


@router.put("/{announcement_id}", response_model=schemas.AnnouncementRead)
def update_announcement(
    announcement_id: int,
    announcement_update: schemas.AnnouncementUpdate,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("instructor", "organization_admin", "super_admin")),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    db_announcement = db.query(Announcement).filter(
        Announcement.id == announcement_id,
        Announcement.organization_id == organization.id,
        Announcement.deleted_at.is_(None)
    ).first()

    if not db_announcement:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Announcement not found.")

    was_published = db_announcement.published
    update_data = announcement_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_announcement, field, value)

    # Set published_at when publishing
    if update_data.get('published') and not db_announcement.published_at:
        from datetime import datetime, timezone
        db_announcement.published_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(db_announcement)

    if update_data.get('published') and not was_published:
        try:
            from app.services.dashboard import create_notifications_for_announcement

            create_notifications_for_announcement(
                db,
                db_announcement,
                organization.id,
                f"Announcement: {db_announcement.title}",
                db_announcement.content,
            )
        except Exception:
            logger.exception(
                "Failed to create announcement notifications for announcement %s",
                db_announcement.id,
            )

    return db_announcement


@router.delete("/{announcement_id}")
def delete_announcement(
    announcement_id: int,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("instructor", "organization_admin", "super_admin")),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    db_announcement = db.query(Announcement).filter(
        Announcement.id == announcement_id,
        Announcement.organization_id == organization.id,
        Announcement.deleted_at.is_(None)
    ).first()

    if not db_announcement:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Announcement not found.")

    db_announcement.deleted_at = db.func.now()
    db.commit()

    return {"message": "Announcement deleted successfully"}