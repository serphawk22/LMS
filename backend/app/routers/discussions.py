from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app import schemas
from app.dependencies import get_current_active_user, get_db, get_tenant
from app.models import User
from app.services import auth as auth_service
from app.services import discussions as discussion_service

router = APIRouter()


def _get_organization_for_tenant(db: Session, tenant_id: str, current_user: User):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")
    return organization


@router.get("/discussions", response_model=list[schemas.DiscussionRead])
def list_discussions(
    search: str | None = Query(default=None),
    category: str | None = Query(default=None),
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    _get_organization_for_tenant(db, tenant_id, current_user)
    return discussion_service.list_discussions(db, current_user, search=search, category=category)


@router.get("/discussions/{discussion_id}", response_model=schemas.DiscussionDetailRead)
def get_discussion(
    discussion_id: int,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    _get_organization_for_tenant(db, tenant_id, current_user)
    discussion = discussion_service.get_discussion_detail(db, discussion_id, current_user)
    if not discussion:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Discussion not found.")
    return discussion


@router.post("/discussions", response_model=schemas.DiscussionDetailRead, status_code=status.HTTP_201_CREATED)
def create_discussion(
    payload: schemas.DiscussionCreate,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    _get_organization_for_tenant(db, tenant_id, current_user)
    return discussion_service.create_discussion(
        db,
        current_user,
        title=payload.title,
        description=payload.description,
        category=payload.category,
    )


@router.post("/discussions/{discussion_id}/replies", response_model=schemas.DiscussionDetailRead, status_code=status.HTTP_201_CREATED)
def add_reply(
    discussion_id: int,
    payload: schemas.DiscussionReplyCreate,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    _get_organization_for_tenant(db, tenant_id, current_user)
    discussion = discussion_service.get_discussion_or_404(db, discussion_id, current_user.organization_id)
    if not discussion:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Discussion not found.")
    try:
        return discussion_service.add_reply(db, current_user, discussion, message=payload.message)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.put("/replies/{reply_id}", response_model=schemas.DiscussionDetailRead)
def update_reply(
    reply_id: int,
    payload: schemas.DiscussionReplyUpdate,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    _get_organization_for_tenant(db, tenant_id, current_user)
    reply = discussion_service.get_reply_or_404(db, reply_id, current_user.organization_id)
    if not reply:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reply not found.")
    try:
        return discussion_service.update_reply(db, current_user, reply, message=payload.message)
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.delete("/replies/{reply_id}", response_model=schemas.DiscussionDetailRead)
def delete_reply(
    reply_id: int,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    _get_organization_for_tenant(db, tenant_id, current_user)
    reply = discussion_service.get_reply_or_404(db, reply_id, current_user.organization_id)
    if not reply:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reply not found.")
    try:
        return discussion_service.delete_reply(db, current_user, reply)
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc


@router.patch("/discussions/{discussion_id}/status", response_model=schemas.DiscussionDetailRead)
def update_discussion_status(
    discussion_id: int,
    payload: schemas.DiscussionStatusUpdate,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    _get_organization_for_tenant(db, tenant_id, current_user)
    discussion = discussion_service.get_discussion_or_404(db, discussion_id, current_user.organization_id)
    if not discussion:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Discussion not found.")
    try:
        return discussion_service.update_discussion_status(db, current_user, discussion, status=payload.status)
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
