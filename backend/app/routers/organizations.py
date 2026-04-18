from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app import schemas
from app.dependencies import get_current_active_user, get_current_admin_user, get_db, get_tenant
from app.models import Department, Quiz, User, UserGroup
from app.services import organizations as organization_service
from app.services import auth as auth_service

router = APIRouter()


@router.post("/signup", response_model=schemas.OrganizationRead, status_code=status.HTTP_201_CREATED)
def signup_organization(payload: schemas.OrganizationSignup, db: Session = Depends(get_db)):
    try:
        organization, _ = organization_service.create_organization_onboarding(
            db=db,
            name=payload.name,
            domain=payload.domain,
            description=payload.description,
            admin_email=payload.admin_email,
            admin_password=payload.admin_password,
            admin_full_name=payload.admin_full_name,
            plan=payload.plan,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return organization


@router.get("/me", response_model=schemas.OrganizationRead)
def read_current_organization(
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")
    return organization


@router.patch("/settings", response_model=schemas.OrganizationSettingsRead)
def update_organization_settings(
    payload: schemas.OrganizationSettingsBase,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    settings = organization_service.create_organization_settings(db, organization, payload.model_dump(exclude_none=True))
    return settings


@router.get("/subscription", response_model=schemas.OrganizationSubscriptionRead)
def read_subscription(tenant_id: str = Depends(get_tenant), db: Session = Depends(get_db)):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    subscription = organization.subscription
    if not subscription:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subscription not configured.")
    return subscription


@router.get("/admin/summary", response_model=schemas.OrganizationReportRead)
def read_organization_summary(
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    return organization_service.get_organization_report(db, organization)


@router.post("/departments", response_model=schemas.DepartmentRead)
def create_department(
    payload: schemas.DepartmentCreate,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    try:
        department = organization_service.create_department(db, organization, payload.name, payload.description)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return department


@router.post("/groups", response_model=schemas.UserGroupRead)
def create_user_group(
    payload: schemas.UserGroupCreate,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    try:
        group = organization_service.create_user_group(db, organization, payload.name, payload.description)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return group


@router.post("/invite", response_model=schemas.InvitationRead)
def invite_user(
    payload: schemas.InvitationCreate,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    invitation = organization_service.create_invitation(
        db=db,
        organization=organization,
        email=payload.email,
        role_name=payload.role_name,
        department_id=payload.department_id,
        group_id=payload.group_id,
        invited_by_id=current_user.id,
        message=payload.message,
        expires_in_hours=payload.expires_in_hours or 72,
    )
    return invitation


@router.get("/departments", response_model=List[schemas.DepartmentRead])
def list_departments(
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    departments = organization_service.list_departments(db, organization)
    return departments


@router.get("/groups", response_model=List[schemas.UserGroupRead])
def list_user_groups(
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    groups = organization_service.list_user_groups(db, organization)
    return groups


@router.get("/invitations", response_model=List[schemas.InvitationRead])
def list_invitations(
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    invitations = organization_service.list_invitations(db, organization)
    return invitations


@router.post("/invitations/{invitation_id}/revoke", response_model=schemas.InvitationRead)
def revoke_invitation(
    invitation_id: int,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    try:
        invitation = organization_service.revoke_invitation(db, invitation_id, organization)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return invitation


@router.post("/invitations/accept", response_model=schemas.UserRead)
def accept_invitation(payload: schemas.InvitationAcceptRequest, db: Session = Depends(get_db)):
    try:
        user = organization_service.accept_invitation(db, payload.token, payload.full_name, payload.password)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return user


@router.get("/users", response_model=List[schemas.UserRead])
def list_organization_users(
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    users = db.execute(
        select(User).where(User.organization_id == organization.id)
    ).scalars().all()
    return users


@router.post("/subscription", response_model=schemas.OrganizationSubscriptionRead)
def update_subscription(
    payload: schemas.OrganizationSubscriptionUpdate,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    subscription = organization_service.create_organization_subscription(
        db=db,
        organization=organization,
        plan=payload.plan or organization.subscription.plan if organization.subscription else "starter",
        seats_allocated=payload.seats_allocated or (organization.subscription.seats_allocated if organization.subscription else 50),
        storage_allocated_mb=payload.storage_allocated_mb or (organization.subscription.storage_allocated_mb if organization.subscription else 1024),
        provider=payload.provider,
        provider_reference=payload.provider_reference,
        next_payment_date=payload.next_payment_date,
        current_period_end=payload.current_period_end,
    )
    return subscription


@router.post("/users", response_model=schemas.UserRead, status_code=status.HTTP_201_CREATED)
def create_organization_user(
    payload: schemas.UserCreate,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    try:
        user = organization_service.create_organization_user(
            db=db,
            organization=organization,
            email=payload.email,
            password=payload.password,
            full_name=payload.full_name,
            role_name=payload.role,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except IntegrityError as exc:
        if "email" in str(exc).lower() or "unique" in str(exc).lower():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This email address is already registered.") from exc
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User creation failed due to a data constraint.") from exc
    return user


@router.get("/users/{user_id}", response_model=schemas.UserRead)
def read_organization_user(
    user_id: int,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    user = organization_service.get_organization_user_by_id(db, organization, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    return user


@router.patch("/users/{user_id}", response_model=schemas.UserRead)
def update_organization_user(
    user_id: int,
    payload: schemas.UserUpdate,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    try:
        user = organization_service.update_organization_user(db, organization, user_id, payload.model_dump(exclude_none=True))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return user


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_organization_user(
    user_id: int,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    try:
        organization_service.delete_organization_user(db, organization, user_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return None


@router.get("/payments", response_model=List[schemas.PaymentRead])
def list_organization_payments(
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    return organization_service.list_payments(db, organization)


@router.get("/payments/{payment_id}", response_model=schemas.PaymentRead)
def read_organization_payment(
    payment_id: int,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    payment = organization_service.get_payment_by_id_for_organization(db, organization, payment_id)
    if not payment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment not found.")
    return payment


@router.patch("/payments/{payment_id}", response_model=schemas.PaymentRead)
def update_organization_payment(
    payment_id: int,
    payload: schemas.PaymentUpdate,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    payment = organization_service.get_payment_by_id_for_organization(db, organization, payment_id)
    if not payment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment not found.")

    updated = organization_service.update_payment(db, payment, payload.model_dump(exclude_none=True))
    return updated
