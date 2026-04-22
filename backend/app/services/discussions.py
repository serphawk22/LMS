from __future__ import annotations

from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.models import Discussion, DiscussionReply, DiscussionStatus, User


PRIVILEGED_ROLES = {"organization_admin", "super_admin", "admin", "instructor"}


def _normalized_role(user: User) -> str:
    return (user.role_name or "").strip().lower().replace(" ", "_")


def _can_manage_status(user: User, discussion: Discussion) -> bool:
    return discussion.user_id == user.id or user.is_staff or _normalized_role(user) in PRIVILEGED_ROLES


def _reply_permissions(user: User, reply: DiscussionReply) -> tuple[bool, bool]:
    is_owner = reply.user_id == user.id
    is_privileged = user.is_staff or _normalized_role(user) in PRIVILEGED_ROLES
    return is_owner, is_owner or is_privileged


def _discussion_author_payload(user: User | None) -> dict:
    if not user:
        return {"id": 0, "full_name": "Unknown User", "email": "unknown@example.com"}
    return {
        "id": user.id,
        "full_name": user.full_name,
        "email": user.email,
    }


def _serialize_reply(reply: DiscussionReply, current_user: User) -> dict:
    can_edit, can_delete = _reply_permissions(current_user, reply)
    return {
        "id": reply.id,
        "discussion_id": reply.discussion_id,
        "user_id": reply.user_id,
        "organization_id": reply.organization_id,
        "message": reply.message,
        "created_at": reply.created_at,
        "updated_at": reply.updated_at,
        "author": _discussion_author_payload(reply.user),
        "can_edit": can_edit,
        "can_delete": can_delete,
    }


def _serialize_discussion(discussion: Discussion, current_user: User, reply_count: int | None = None, include_replies: bool = False) -> dict:
    replies = [
        _serialize_reply(reply, current_user)
        for reply in sorted(
            [reply for reply in discussion.replies if not reply.is_deleted],
            key=lambda item: item.created_at,
        )
    ] if include_replies else []

    status_value = discussion.status.value if hasattr(discussion.status, "value") else str(discussion.status)
    return {
        "id": discussion.id,
        "title": discussion.title,
        "description": discussion.description,
        "category": discussion.category,
        "status": status_value,
        "user_id": discussion.user_id,
        "organization_id": discussion.organization_id,
        "created_at": discussion.created_at,
        "updated_at": discussion.updated_at,
        "reply_count": reply_count if reply_count is not None else len(replies),
        "author": _discussion_author_payload(discussion.user),
        "can_manage_status": _can_manage_status(current_user, discussion),
        "can_reply": status_value == DiscussionStatus.open.value,
        "replies": replies,
    }


def list_discussions(
    db: Session,
    current_user: User,
    *,
    search: str | None = None,
    category: str | None = None,
) -> list[dict]:
    query = (
        db.query(Discussion)
        .options(
            joinedload(Discussion.user),
            joinedload(Discussion.replies),
        )
        .filter(
            Discussion.organization_id == current_user.organization_id,
            Discussion.is_deleted == False,
        )
    )

    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Discussion.title.ilike(term),
                Discussion.description.ilike(term),
                Discussion.category.ilike(term),
            )
        )

    if category and category.strip() and category.strip().lower() != "all":
        query = query.filter(Discussion.category == category.strip())

    discussions = query.order_by(Discussion.created_at.desc()).all()

    return [
        _serialize_discussion(
            discussion,
            current_user,
            reply_count=sum(1 for reply in discussion.replies if not reply.is_deleted),
        )
        for discussion in discussions
    ]


def get_discussion_or_404(db: Session, discussion_id: int, organization_id: int) -> Discussion | None:
    return (
        db.query(Discussion)
        .options(
            joinedload(Discussion.user),
            joinedload(Discussion.replies).joinedload(DiscussionReply.user),
        )
        .filter(
            Discussion.id == discussion_id,
            Discussion.organization_id == organization_id,
            Discussion.is_deleted == False,
        )
        .one_or_none()
    )


def get_discussion_detail(db: Session, discussion_id: int, current_user: User) -> dict | None:
    discussion = get_discussion_or_404(db, discussion_id, current_user.organization_id)
    if not discussion:
        return None

    reply_count = sum(1 for reply in discussion.replies if not reply.is_deleted)
    return _serialize_discussion(discussion, current_user, reply_count=reply_count, include_replies=True)


def create_discussion(db: Session, current_user: User, *, title: str, description: str, category: str) -> dict:
    discussion = Discussion(
        organization_id=current_user.organization_id,
        user_id=current_user.id,
        title=title.strip(),
        description=description.strip(),
        category=category.strip(),
        status=DiscussionStatus.open,
    )
    db.add(discussion)
    db.commit()
    db.refresh(discussion)
    discussion = get_discussion_or_404(db, discussion.id, current_user.organization_id)
    return _serialize_discussion(discussion, current_user, reply_count=0, include_replies=True)


def add_reply(db: Session, current_user: User, discussion: Discussion, *, message: str) -> dict:
    status_value = discussion.status.value if hasattr(discussion.status, "value") else str(discussion.status)
    if status_value != DiscussionStatus.open.value:
        raise ValueError("This discussion is closed.")

    reply = DiscussionReply(
        organization_id=current_user.organization_id,
        discussion_id=discussion.id,
        user_id=current_user.id,
        message=message.strip(),
    )
    db.add(reply)
    db.commit()
    db.refresh(reply)
    db.refresh(discussion)
    detail = get_discussion_detail(db, discussion.id, current_user)
    if detail is None:
        raise ValueError("Discussion not found.")
    return detail


def get_reply_or_404(db: Session, reply_id: int, organization_id: int) -> DiscussionReply | None:
    return (
        db.query(DiscussionReply)
        .options(
            joinedload(DiscussionReply.user),
            joinedload(DiscussionReply.discussion).joinedload(Discussion.user),
            joinedload(DiscussionReply.discussion).joinedload(Discussion.replies).joinedload(DiscussionReply.user),
        )
        .filter(
            DiscussionReply.id == reply_id,
            DiscussionReply.organization_id == organization_id,
            DiscussionReply.is_deleted == False,
        )
        .one_or_none()
    )


def update_reply(db: Session, current_user: User, reply: DiscussionReply, *, message: str) -> dict:
    can_edit, _ = _reply_permissions(current_user, reply)
    if not can_edit:
        raise PermissionError("You can only edit your own replies.")

    discussion_status = reply.discussion.status.value if hasattr(reply.discussion.status, "value") else str(reply.discussion.status)
    if discussion_status != DiscussionStatus.open.value:
        raise ValueError("Replies cannot be edited on a closed discussion.")

    reply.message = message.strip()
    db.add(reply)
    db.commit()
    detail = get_discussion_detail(db, reply.discussion_id, current_user)
    if detail is None:
        raise ValueError("Discussion not found.")
    return detail


def delete_reply(db: Session, current_user: User, reply: DiscussionReply) -> dict:
    _, can_delete = _reply_permissions(current_user, reply)
    if not can_delete:
        raise PermissionError("You do not have permission to delete this reply.")

    reply.is_deleted = True
    db.add(reply)
    db.commit()
    detail = get_discussion_detail(db, reply.discussion_id, current_user)
    if detail is None:
        raise ValueError("Discussion not found.")
    return detail


def update_discussion_status(db: Session, current_user: User, discussion: Discussion, *, status: str) -> dict:
    if not _can_manage_status(current_user, discussion):
        raise PermissionError("You do not have permission to change this discussion status.")

    normalized = status.strip().lower()
    discussion.status = DiscussionStatus(normalized)
    db.add(discussion)
    db.commit()
    detail = get_discussion_detail(db, discussion.id, current_user)
    if detail is None:
        raise ValueError("Discussion not found.")
    return detail
