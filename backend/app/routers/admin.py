from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app import schemas
from app.dependencies import get_db, get_tenant, require_roles
from app.services import auth as auth_service
from app.services import organizations as organization_service

router = APIRouter()


@router.post("/register", response_model=schemas.RegistrationResponse, status_code=status.HTTP_201_CREATED)
def admin_register_user(
    payload: schemas.UserCreate,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant),
):
    """
    Register a new user with an admin role (organization_admin / super_admin).
    Unlike the public /auth/register endpoint, this one allows unrestricted 
    role assignment so admin roles are NOT downgraded to 'student'.
    """
    ALLOWED_ADMIN_ROLES = {"organization_admin", "super_admin", "admin"}
    requested = auth_service.normalize_role_name(payload.role)
    if requested not in ALLOWED_ADMIN_ROLES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"This endpoint is only for admin roles. Use /auth/register for '{requested}'.",
        )

    try:
        user = auth_service.create_user(
            db=db,
            email=payload.email,
            password=payload.password,
            tenant_id=tenant_id,
            full_name=payload.full_name,
            role_name=payload.role,
            allow_unrestricted_role=True,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except IntegrityError as exc:
        if "email" in str(exc).lower() or "unique" in str(exc).lower():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This email address is already registered.") from exc
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Registration failed due to a data constraint.") from exc

    verification_token = auth_service.create_email_verification_token(user)
    return {"user": user, "verification_token": verification_token}



@router.get("/platform/overview", response_model=schemas.PlatformOverviewRead)
def read_platform_overview(
    db: Session = Depends(get_db),
    current_user = Depends(require_roles("super_admin")),
):
    return organization_service.get_platform_overview(db)


@router.get("/organizations", response_model=List[schemas.OrganizationRead])
def list_platform_organizations(
    db: Session = Depends(get_db),
    current_user = Depends(require_roles("super_admin")),
):
    return organization_service.list_organizations(db)


@router.get("/organizations/{organization_id}", response_model=schemas.OrganizationRead)
def read_platform_organization(
    organization_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(require_roles("super_admin")),
):
    organization = organization_service.get_organization_by_id(db, organization_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    return organization


@router.get("/users", response_model=List[schemas.UserRead])
def list_platform_users(
    organization_id: int | None = None,
    db: Session = Depends(get_db),
    current_user = Depends(require_roles("super_admin")),
):
    return organization_service.list_platform_users(db, organization_id=organization_id)


@router.get("/users/{user_id}", response_model=schemas.UserRead)
def read_platform_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(require_roles("super_admin")),
):
    user = organization_service.get_platform_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    return user


@router.patch("/users/{user_id}", response_model=schemas.UserRead)
def update_platform_user(
    user_id: int,
    payload: schemas.UserUpdate,
    db: Session = Depends(get_db),
    current_user = Depends(require_roles("super_admin")),
):
    user = organization_service.get_platform_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    try:
        return organization_service.update_platform_user(db, user, payload.model_dump(exclude_none=True))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_platform_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(require_roles("super_admin")),
):
    user = organization_service.get_platform_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    user.is_deleted = True
    db.add(user)
    db.commit()
    return None
