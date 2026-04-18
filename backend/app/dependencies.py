from datetime import datetime, timedelta, timezone
from typing import Generator

from fastapi import Depends, Header, HTTPException, Request, status
from sqlalchemy.orm import Session

from app import schemas
from app.config import settings
from app.core.security import decode_token
from app.database import SessionLocal
from app.models import AuthSession, User
from app.services.auth import get_organization_by_tenant, get_user_by_token_payload


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_tenant(request: Request, tenant_id: str | None = Header(None, alias=settings.tenant_header)) -> str:
    if tenant_id:
        return tenant_id

    # Fallback to token payload tenant if header is absent
    auth_header = request.headers.get('Authorization')
    if auth_header and auth_header.startswith('Bearer '):
        token = auth_header.split(' ', 1)[1]
        try:
            payload = decode_token(token)
            payload_tenant = payload.get('tenant_id')
            if payload_tenant:
                return str(payload_tenant)
        except ValueError:
            pass

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Missing tenant header",
    )


def get_tenant_optional(tenant_id: str | None = Header(None, alias=settings.tenant_header)) -> str | None:
    return tenant_id


def get_current_user(
    token: str = Depends(schemas.oauth2_scheme),
    db: Session = Depends(get_db),
    tenant_id: str | None = Depends(get_tenant_optional),
) -> User:
    try:
        payload = decode_token(token)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    if payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not tenant_id:
        tenant_id = payload.get("tenant_id")

    if not tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing tenant header or token tenant data",
        )

    organization = get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unknown tenant",
        )

    user = get_user_by_token_payload(db, payload)
    if not user or user.organization_id != organization.id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )

    session_id = payload.get("session_id")
    if not isinstance(session_id, str):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid session payload",
            headers={"WWW-Authenticate": "Bearer"},
        )

    auth_session = db.query(AuthSession).filter(
        AuthSession.session_id == session_id,
        AuthSession.organization_id == organization.id,
        AuthSession.is_deleted == False,
    ).one_or_none()

    if not auth_session or auth_session.is_revoked:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired or revoked",
            headers={"WWW-Authenticate": "Bearer"},
        )

    now = datetime.now(timezone.utc)
    expires_at = auth_session.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < now:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired or revoked",
            headers={"WWW-Authenticate": "Bearer"},
        )

    last_used_at = auth_session.last_used_at or auth_session.created_at
    if last_used_at and last_used_at.tzinfo is None:
        last_used_at = last_used_at.replace(tzinfo=timezone.utc)
    if now - last_used_at > timedelta(minutes=settings.session_timeout_minutes):
        auth_session.is_revoked = True
        db.add(auth_session)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session timed out",
            headers={"WWW-Authenticate": "Bearer"},
        )

    auth_session.last_used_at = datetime.now(timezone.utc)
    db.add(auth_session)
    db.commit()

    return user


def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user",
        )
    if not current_user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email not verified",
        )
    return current_user


def get_current_admin_user(current_user: User = Depends(get_current_active_user)) -> User:
    role_name = (current_user.role_name or "").strip().lower().replace(" ", "_")
    if role_name in {"organization_admin", "super_admin", "admin"}:
        return current_user

    # Safety fallback if relation data is missing (role relationship may not be loaded with these patterns)
    if getattr(current_user, 'role', None) and getattr(current_user.role, 'name', None):
        fallback_role = str(current_user.role.name).strip().lower().replace(" ", "_")
        if fallback_role in {"organization_admin", "super_admin", "admin"}:
            return current_user

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Insufficient privileges",
    )


def require_roles(*allowed_roles: str):
    def role_dependency(current_user: User = Depends(get_current_active_user)) -> User:
        normalized_roles = {role.lower().replace(" ", "_") for role in allowed_roles}
        user_role = (current_user.role_name or "").lower().replace(" ", "_")
        if user_role == "super_admin":
            return current_user
        if user_role not in normalized_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient privileges",
            )
        return current_user

    return role_dependency
