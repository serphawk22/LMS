from __future__ import annotations

import hashlib
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.config import settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    create_token,
    decode_token,
    get_password_hash,
    verify_password,
)
from app.models import AuthSession, Organization, Role, User


ROLE_SUPER_ADMIN = "super_admin"
ROLE_ORGANIZATION_ADMIN = "organization_admin"
ROLE_INSTRUCTOR = "instructor"
ROLE_STUDENT = "student"
ROLE_MANAGER = "manager"

OPEN_REGISTRATION_ROLES = {ROLE_STUDENT, ROLE_INSTRUCTOR, ROLE_MANAGER}
ROLE_ALIASES = {
    "super admin": ROLE_SUPER_ADMIN,
    "super_admin": ROLE_SUPER_ADMIN,
    "organization admin": ROLE_ORGANIZATION_ADMIN,
    "organization_admin": ROLE_ORGANIZATION_ADMIN,
    "org admin": ROLE_ORGANIZATION_ADMIN,
    "org_admin": ROLE_ORGANIZATION_ADMIN,
    "admin": ROLE_ORGANIZATION_ADMIN,
    "teacher": ROLE_INSTRUCTOR,
    "student": ROLE_STUDENT,
    "manager": ROLE_MANAGER,
}


def _normalize_tenant_id(tenant_id: str) -> str:
    return tenant_id.strip().lower().replace(" ", "-")


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _parse_uuid(value: str | UUID | None) -> UUID | None:
    if value is None:
        return None
    if isinstance(value, UUID):
        return value
    try:
        return UUID(str(value))
    except ValueError:
        return None


def _get_auth_session(db: Session, session_id: str, organization_id: UUID) -> AuthSession | None:
    return db.query(AuthSession).filter(
        AuthSession.session_id == session_id,
        AuthSession.organization_id == organization_id,
        AuthSession.is_deleted == False,
    ).one_or_none()


def generate_session_id() -> str:
    return str(uuid4())


def _create_auth_session(db: Session, user: User, session_id: str, refresh_token: str) -> AuthSession:
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_refresh_token_expires_minutes)
    auth_session = AuthSession(
        user_id=user.id,
        organization_id=user.organization_id,
        session_id=session_id,
        refresh_token_hash=_hash_token(refresh_token),
        expires_at=expires_at,
        last_used_at=datetime.now(timezone.utc),
    )
    db.add(auth_session)
    db.commit()
    db.refresh(auth_session)
    return auth_session


def create_auth_session(db: Session, user: User, session_id: str, refresh_token: str) -> AuthSession:
    return _create_auth_session(db, user, session_id, refresh_token)


def get_organization_by_tenant(db: Session, tenant_id: str) -> Organization | None:
    normalized = _normalize_tenant_id(tenant_id)
    org_id = _parse_uuid(tenant_id)
    if org_id is not None:
        result = db.execute(select(Organization).where(Organization.id == org_id)).scalar_one_or_none()
        if result:
            return result

    if normalized.isdigit():
        result = db.execute(select(Organization).where(Organization.id == int(normalized))).scalar_one_or_none()
        if result:
            return result

    result = db.execute(
        select(Organization)
        .where(Organization.slug == normalized)
        .limit(1)
    ).scalar_one_or_none()
    if result:
        return result

    return db.execute(
        select(Organization)
        .where(Organization.domain == tenant_id)
        .limit(1)
    ).scalar_one_or_none()


def ensure_organization_for_tenant(db: Session, tenant_id: str) -> Organization:
    organization = get_organization_by_tenant(db, tenant_id)
    if organization:
        return organization

    normalized = _normalize_tenant_id(tenant_id)
    organization = Organization(
        name=tenant_id.strip(),
        slug=normalized,
        domain=None,
    )
    db.add(organization)
    db.commit()
    db.refresh(organization)
    return organization


def normalize_role_name(name: str | None) -> str:
    if not name:
        return ROLE_STUDENT
    normalized = name.strip().lower().replace(" ", "_")
    return ROLE_ALIASES.get(normalized, normalized)


def ensure_role(db: Session, organization: Organization, name: str) -> Role:
    name = normalize_role_name(name)
    role = db.execute(
        select(Role)
        .where(Role.organization_id == organization.id)
        .where(Role.name == name)
        .limit(1)
    ).scalar_one_or_none()
    if role:
        return role

    role = Role(
        name=name,
        organization_id=organization.id,
        permissions=["course:view", "course:enroll"],
    )
    db.add(role)
    db.commit()
    db.refresh(role)
    return role


def create_user(
    db: Session,
    email: str,
    password: str,
    tenant_id: str,
    full_name: str | None = None,
    role_name: str | None = None,
    allow_unrestricted_role: bool = False,
) -> User:
    organization = ensure_organization_for_tenant(db, tenant_id)
    existing = db.execute(
        select(User)
        .where(User.organization_id == organization.id)
        .where(User.email == email)
        .limit(1)
    ).scalar_one_or_none()
    if existing:
        raise ValueError("A user with that email already exists for this tenant.")

    requested_role = normalize_role_name(role_name)
    if not allow_unrestricted_role and requested_role not in OPEN_REGISTRATION_ROLES:
        requested_role = ROLE_STUDENT

    role = ensure_role(db, organization, requested_role)
    user = User(
        email=email,
        full_name=full_name,
        hashed_password=get_password_hash(password),
        organization_id=organization.id,
        role=role,
        is_verified=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def authenticate_user(db: Session, email: str, password: str, tenant_id: str | None) -> User | None:
    if tenant_id:
        organization = get_organization_by_tenant(db, tenant_id)
        if not organization:
            return None

        user = db.execute(
            select(User)
            .options(selectinload(User.role))
            .where(User.organization_id == organization.id)
            .where(User.email == email)
            .limit(1)
        ).scalar_one_or_none()
    else:
        users = db.execute(
            select(User)
            .options(selectinload(User.role))
            .where(User.email == email)
            .limit(2)
        ).scalars().all()
        if len(users) != 1:
            return None
        user = users[0]

    if not user or not verify_password(password, user.hashed_password):
        return None

    return user


def build_access_token(user: User, session_id: str | None = None) -> str:
    payload: dict[str, Any] = {
        "sub": str(user.id),
        "tenant_id": str(user.organization_id),
        "role": user.role_name or "student",
        "session_id": session_id,
        "type": "access",
    }
    return create_access_token(payload)


def build_refresh_token(user: User, session_id: str) -> str:
    payload: dict[str, Any] = {
        "sub": str(user.id),
        "tenant_id": str(user.organization_id),
        "role": user.role_name or "student",
        "session_id": session_id,
        "type": "refresh",
    }
    return create_refresh_token(payload)


def create_email_verification_token(user: User) -> str:
    payload: dict[str, Any] = {
        "sub": str(user.id),
        "tenant_id": str(user.organization_id),
        "type": "email_verification",
    }
    return create_token(payload, expires_minutes=settings.jwt_email_verification_token_expires_minutes)


def create_password_reset_token(user: User) -> str:
    payload: dict[str, Any] = {
        "sub": str(user.id),
        "tenant_id": str(user.organization_id),
        "type": "password_reset",
    }
    return create_token(payload, expires_minutes=settings.jwt_password_reset_token_expires_minutes)


def _parse_uuid_id(value: str | UUID | None) -> UUID | None:
    if value is None:
        return None
    try:
        return UUID(str(value))
    except (ValueError, TypeError):
        return None


def _parse_id(value: str | int | UUID | None) -> int | UUID | None:
    """Parse a value as an integer ID or UUID, returning whichever works."""
    if value is None:
        return None
    if isinstance(value, int):
        return value
    s = str(value).strip()
    if s.isdigit():
        return int(s)
    try:
        return UUID(s)
    except (ValueError, TypeError):
        return None


def get_user_by_id_and_tenant(db: Session, user_id: str, tenant_id: str) -> User | None:
    organization = get_organization_by_tenant(db, tenant_id)
    if not organization:
        return None

    parsed_id = _parse_id(user_id)
    if parsed_id is None:
        return None

    return db.execute(
        select(User)
        .where(User.id == parsed_id)
        .where(User.organization_id == organization.id)
        .limit(1)
    ).scalar_one_or_none()


def get_user_by_email_and_tenant(db: Session, email: str, tenant_id: str) -> User | None:
    organization = get_organization_by_tenant(db, tenant_id)
    if not organization:
        return None

    return db.execute(
        select(User)
        .where(User.organization_id == organization.id)
        .where(User.email == email)
        .limit(1)
    ).scalar_one_or_none()


def get_user_by_token_payload(db: Session, payload: dict[str, Any]) -> User | None:
    if payload.get("type") != "access":
        return None

    user_id = _parse_id(payload.get("sub"))
    tenant_id = _parse_id(payload.get("tenant_id"))
    if user_id is None or tenant_id is None:
        return None

    return db.execute(
        select(User)
        .options(selectinload(User.role))
        .where(User.id == user_id)
        .where(User.organization_id == tenant_id)
        .limit(1)
    ).scalar_one_or_none()


def validate_email_verification_token(db: Session, token: str) -> User:
    payload = decode_token(token)
    if payload.get("type") != "email_verification":
        raise ValueError("Invalid verification token")
    user = get_user_by_id_and_tenant(db, str(payload["sub"]), payload["tenant_id"])
    if not user:
        raise ValueError("Invalid verification token")
    return user


def verify_user_email(db: Session, token: str) -> User:
    user = validate_email_verification_token(db, token)
    user.is_verified = True
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def validate_password_reset_token(db: Session, token: str) -> User:
    payload = decode_token(token)
    if payload.get("type") != "password_reset":
        raise ValueError("Invalid password reset token")
    user = get_user_by_id_and_tenant(db, str(payload["sub"]), payload["tenant_id"])
    if not user:
        raise ValueError("Invalid password reset token")
    return user


def refresh_access_token(db: Session, refresh_token: str) -> tuple[str, str]:
    payload = decode_token(refresh_token)
    if payload.get("type") != "refresh":
        raise ValueError("Invalid refresh token")

    session_id = payload.get("session_id")
    if not isinstance(session_id, str):
        raise ValueError("Invalid refresh token payload")

    organization_id = _parse_uuid_id(payload.get("tenant_id"))
    if organization_id is None:
        raise ValueError("Invalid refresh token payload")

    auth_session = _get_auth_session(db, session_id, organization_id)
    if not auth_session or auth_session.is_revoked or auth_session.expires_at < datetime.now(timezone.utc):
        raise ValueError("Invalid or expired refresh token")

    if auth_session.refresh_token_hash != _hash_token(refresh_token):
        raise ValueError("Refresh token does not match active session")

    user = get_user_by_id_and_tenant(db, str(payload["sub"]), payload["tenant_id"])
    if not user or not user.is_active:
        raise ValueError("Invalid refresh token")

    auth_session.is_revoked = True
    db.add(auth_session)
    db.commit()

    new_session_id = str(uuid4())
    new_refresh_token = build_refresh_token(user, new_session_id)
    _create_auth_session(db, user, new_session_id, new_refresh_token)
    access_token = build_access_token(user, session_id=new_session_id)
    return access_token, new_refresh_token


def logout_refresh_token(db: Session, refresh_token: str) -> None:
    payload = decode_token(refresh_token)
    if payload.get("type") != "refresh":
        raise ValueError("Invalid refresh token")

    session_id = payload.get("session_id")
    if not isinstance(session_id, str):
        raise ValueError("Invalid refresh token payload")

    organization_id = _parse_uuid_id(payload.get("tenant_id"))
    if organization_id is None:
        raise ValueError("Invalid refresh token payload")

    auth_session = _get_auth_session(db, session_id, organization_id)
    if auth_session:
        auth_session.is_revoked = True
        db.add(auth_session)
        db.commit()


def reset_user_password(db: Session, token: str, new_password: str) -> User:
    user = validate_password_reset_token(db, token)
    user.hashed_password = get_password_hash(new_password)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
