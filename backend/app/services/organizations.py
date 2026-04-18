from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import (
    Course,
    Department,
    Invitation,
    Organization,
    OrganizationSettings,
    OrganizationSubscription,
    Payment,
    Role,
    User,
    UserGroup,
    UserGroupMembership,
)
from app.services.auth import create_user, ensure_role, get_organization_by_tenant


def _normalize_slug(name: str) -> str:
    return name.strip().lower().replace(" ", "-")


def create_organization(
    db: Session,
    name: str,
    domain: str | None = None,
    description: str | None = None,
) -> Organization:
    slug = _normalize_slug(name)
    organization = db.execute(
        select(Organization).where(Organization.slug == slug).limit(1)
    ).scalar_one_or_none()
    if organization:
        raise ValueError("An organization with that slug already exists.")

    organization = Organization(name=name, slug=slug, domain=domain, description=description)
    db.add(organization)
    db.commit()
    db.refresh(organization)
    return organization


def create_organization_settings(
    db: Session,
    organization: Organization,
    settings: dict[str, Any],
) -> OrganizationSettings:
    existing = db.execute(
        select(OrganizationSettings).where(OrganizationSettings.organization_id == organization.id)
    ).scalar_one_or_none()
    if existing:
        for field, value in settings.items():
            setattr(existing, field, value)
        db.add(existing)
        db.commit()
        db.refresh(existing)
        return existing

    org_settings = OrganizationSettings(organization_id=organization.id, **settings)
    db.add(org_settings)
    db.commit()
    db.refresh(org_settings)
    return org_settings


def create_organization_subscription(
    db: Session,
    organization: Organization,
    plan: str = "starter",
    seats_allocated: int = 50,
    storage_allocated_mb: int = 1024,
    provider: str | None = None,
    provider_reference: str | None = None,
    next_payment_date: datetime | None = None,
    current_period_end: datetime | None = None,
) -> OrganizationSubscription:
    existing = db.execute(
        select(OrganizationSubscription).where(OrganizationSubscription.organization_id == organization.id)
    ).scalar_one_or_none()
    if existing:
        existing.plan = plan
        existing.seats_allocated = seats_allocated
        existing.storage_allocated_mb = storage_allocated_mb
        existing.provider = provider
        existing.provider_reference = provider_reference
        existing.next_payment_date = next_payment_date
        existing.current_period_end = current_period_end
        existing.status = "active"
        db.add(existing)
        db.commit()
        db.refresh(existing)
        return existing

    subscription = OrganizationSubscription(
        organization_id=organization.id,
        plan=plan,
        status="active",
        seats_allocated=seats_allocated,
        storage_allocated_mb=storage_allocated_mb,
        storage_used_mb=0,
        seats_used=0,
        provider=provider,
        provider_reference=provider_reference,
        next_payment_date=next_payment_date,
        current_period_end=current_period_end,
    )
    db.add(subscription)
    db.commit()
    db.refresh(subscription)
    return subscription


def create_department(db: Session, organization: Organization, name: str, description: str | None = None) -> Department:
    existing = db.execute(
        select(Department)
        .where(Department.organization_id == organization.id)
        .where(Department.name == name)
        .limit(1)
    ).scalar_one_or_none()
    if existing:
        raise ValueError("Department already exists for this organization.")

    department = Department(organization_id=organization.id, name=name, description=description)
    db.add(department)
    db.commit()
    db.refresh(department)
    return department


def create_user_group(db: Session, organization: Organization, name: str, description: str | None = None) -> UserGroup:
    existing = db.execute(
        select(UserGroup)
        .where(UserGroup.organization_id == organization.id)
        .where(UserGroup.name == name)
        .limit(1)
    ).scalar_one_or_none()
    if existing:
        raise ValueError("User group already exists for this organization.")

    group = UserGroup(organization_id=organization.id, name=name, description=description)
    db.add(group)
    db.commit()
    db.refresh(group)
    return group


def get_department_by_id_for_organization(db: Session, organization: Organization, department_id: int | str) -> Department | None:
    return db.execute(
        select(Department)
        .where(Department.organization_id == organization.id)
        .where(Department.id == department_id)
        .limit(1)
    ).scalar_one_or_none()


def get_user_group_by_id_for_organization(db: Session, organization: Organization, group_id: int | str) -> UserGroup | None:
    return db.execute(
        select(UserGroup)
        .where(UserGroup.organization_id == organization.id)
        .where(UserGroup.id == group_id)
        .limit(1)
    ).scalar_one_or_none()


def get_organization_user_by_id(db: Session, organization: Organization, user_id: int | str) -> User | None:
    return db.execute(
        select(User)
        .where(User.organization_id == organization.id)
        .where(User.id == user_id)
        .limit(1)
    ).scalar_one_or_none()


def create_organization_user(
    db: Session,
    organization: Organization,
    email: str,
    password: str,
    full_name: str | None = None,
    role_name: str | None = "student",
    department_id: int | str | None = None,
    group_id: int | str | None = None,
) -> User:
    user = create_user(
        db=db,
        email=email,
        password=password,
        tenant_id=organization.slug,
        full_name=full_name,
        role_name=role_name,
        allow_unrestricted_role=True,
    )
    if department_id:
        department = get_department_by_id_for_organization(db, organization, department_id)
        if not department:
            raise ValueError("Invalid department for this organization.")
        user.department_id = department.id

    if group_id:
        group = get_user_group_by_id_for_organization(db, organization, group_id)
        if not group:
            raise ValueError("Invalid group for this organization.")
        membership = UserGroupMembership(
            organization_id=organization.id,
            group_id=group.id,
            user_id=user.id,
        )
        db.add(membership)

    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def update_organization_user(db: Session, organization: Organization, user_id: int | str, payload: dict[str, Any]) -> User:
    user = get_organization_user_by_id(db, organization, user_id)
    if not user:
        raise ValueError("User not found for this organization.")

    if payload.get("email") is not None:
        user.email = payload["email"]
    if payload.get("full_name") is not None:
        user.full_name = payload["full_name"]
    if payload.get("is_active") is not None:
        user.is_active = payload["is_active"]
    if payload.get("is_verified") is not None:
        user.is_verified = payload["is_verified"]
    if payload.get("role") is not None:
        role = ensure_role(db, organization, payload["role"])
        user.role = role
    if payload.get("department_id") is not None:
        department = get_department_by_id_for_organization(db, organization, payload["department_id"])
        if not department:
            raise ValueError("Invalid department for this organization.")
        user.department_id = department.id
    if payload.get("group_id") is not None:
        group = get_user_group_by_id_for_organization(db, organization, payload["group_id"])
        if not group:
            raise ValueError("Invalid group for this organization.")
        membership = db.execute(
            select(UserGroupMembership)
            .where(UserGroupMembership.organization_id == organization.id)
            .where(UserGroupMembership.user_id == user.id)
            .where(UserGroupMembership.group_id == group.id)
            .limit(1)
        ).scalar_one_or_none()
        if not membership:
            membership = UserGroupMembership(
                organization_id=organization.id,
                group_id=group.id,
                user_id=user.id,
            )
            db.add(membership)

    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def delete_organization_user(db: Session, organization: Organization, user_id: int | str) -> User:
    user = get_organization_user_by_id(db, organization, user_id)
    if not user:
        raise ValueError("User not found for this organization.")
    user.is_deleted = True
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def get_payment_by_id_for_organization(db: Session, organization: Organization, payment_id: int | str) -> Payment | None:
    return db.execute(
        select(Payment)
        .where(Payment.organization_id == organization.id)
        .where(Payment.id == payment_id)
        .limit(1)
    ).scalar_one_or_none()


def list_payments(db: Session, organization: Organization) -> list[Payment]:
    return db.execute(
        select(Payment).where(Payment.organization_id == organization.id)
    ).scalars().all()


def update_payment(db: Session, payment: Payment, payload: dict[str, Any]) -> Payment:
    for field, value in payload.items():
        if value is not None and hasattr(payment, field):
            setattr(payment, field, value)
    db.add(payment)
    db.commit()
    db.refresh(payment)
    return payment


def get_organization_report(db: Session, organization: Organization) -> dict[str, Any]:
    user_count = db.query(User).filter(User.organization_id == organization.id, User.is_deleted == False).count()
    student_count = db.query(User).join(Role).filter(User.organization_id == organization.id, Role.name == "student", User.is_deleted == False).count()
    instructor_count = db.query(User).join(Role).filter(User.organization_id == organization.id, Role.name == "instructor", User.is_deleted == False).count()
    active_users = db.query(User).filter(User.organization_id == organization.id, User.is_active == True, User.is_deleted == False).count()
    course_count = db.query(Course).filter(Course.organization_id == organization.id, Course.is_deleted == False).count()
    payment_count = db.query(Payment).filter(Payment.organization_id == organization.id).count()
    revenue = db.query(func.coalesce(func.sum(Payment.amount), 0.0)).filter(Payment.organization_id == organization.id, Payment.status == "succeeded").scalar() or 0.0
    subscription_status = organization.subscription.status if organization.subscription else None
    return {
        "user_count": user_count,
        "student_count": student_count,
        "instructor_count": instructor_count,
        "active_users": active_users,
        "course_count": course_count,
        "revenue": float(revenue),
        "payment_count": payment_count,
        "subscription_status": subscription_status,
    }


def create_organization_onboarding(
    db: Session,
    organization: Organization,
    email: str,
    role_name: str | None = "student",
    department_id: int | str | None = None,
    group_id: int | str | None = None,
    invited_by_id: int | str | None = None,
    message: str | None = None,
    expires_in_hours: int = 72,
) -> Invitation:
    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=expires_in_hours)

    if department_id:
        department = get_department_by_id_for_organization(db, organization, department_id)
        if not department:
            raise ValueError("Invalid department for this organization.")

    if group_id:
        group = get_user_group_by_id_for_organization(db, organization, group_id)
        if not group:
            raise ValueError("Invalid group for this organization.")

    invitation = Invitation(
        organization_id=organization.id,
        email=email,
        token=token,
        role_id=ensure_role(db, organization, role_name or "student").id,
        department_id=department_id,
        group_id=group_id,
        invited_by_id=invited_by_id,
        expires_at=expires_at,
        message=message,
    )
    db.add(invitation)
    db.commit()
    db.refresh(invitation)
    return invitation


def accept_invitation(db: Session, token: str, full_name: str | None, password: str) -> User:
    invitation = db.execute(
        select(Invitation).where(Invitation.token == token).limit(1)
    ).scalar_one_or_none()
    if not invitation or invitation.is_revoked:
        raise ValueError("Invalid invitation token.")
    if invitation.expires_at < datetime.now(timezone.utc):
        raise ValueError("Invitation token has expired.")
    if invitation.accepted_at:
        raise ValueError("Invitation has already been accepted.")

    organization = db.execute(
        select(Organization).where(Organization.id == invitation.organization_id).limit(1)
    ).scalar_one_or_none()
    if not organization:
        raise ValueError("Organization not found.")

    user = create_user(
        db=db,
        email=invitation.email,
        password=password,
        tenant_id=organization.slug,
        full_name=full_name,
        role_name=invitation.role.name if invitation.role else "student",
        allow_unrestricted_role=True,
    )

    if invitation.department_id:
        department = get_department_by_id_for_organization(db, organization, invitation.department_id)
        if not department:
            raise ValueError("Invalid department for this organization.")
        user.department_id = department.id

    if invitation.group_id:
        group = get_user_group_by_id_for_organization(db, organization, invitation.group_id)
        if not group:
            raise ValueError("Invalid group for this organization.")
        membership = UserGroupMembership(
            organization_id=organization.id,
            group_id=group.id,
            user_id=user.id,
        )
        db.add(membership)

    invitation.accepted_at = datetime.now(timezone.utc)
    invitation.accepted_user_id = user.id
    db.add(invitation)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def list_departments(db: Session, organization: Organization) -> list[Department]:
    return db.execute(
        select(Department).where(Department.organization_id == organization.id)
    ).scalars().all()


def list_user_groups(db: Session, organization: Organization) -> list[UserGroup]:
    return db.execute(
        select(UserGroup).where(UserGroup.organization_id == organization.id)
    ).scalars().all()


def list_invitations(db: Session, organization: Organization) -> list[Invitation]:
    return db.execute(
        select(Invitation).where(Invitation.organization_id == organization.id)
    ).scalars().all()


def get_organization_by_id(db: Session, organization_id: int) -> Organization | None:
    return db.execute(select(Organization).where(Organization.id == organization_id).limit(1)).scalar_one_or_none()


def list_platform_users(db: Session, organization_id: int | None = None) -> list[User]:
    query = db.query(User).filter(User.is_deleted == False)
    if organization_id is not None:
        query = query.filter(User.organization_id == organization_id)
    return query.order_by(User.created_at.desc()).all()


def get_platform_user_by_id(db: Session, user_id: int | str) -> User | None:
    return db.execute(select(User).where(User.id == user_id, User.is_deleted == False).limit(1)).scalar_one_or_none()


def update_platform_user(db: Session, user: User, payload: dict[str, Any]) -> User:
    if payload.get("email") is not None:
        user.email = payload["email"]
    if payload.get("full_name") is not None:
        user.full_name = payload["full_name"]
    if payload.get("is_active") is not None:
        user.is_active = payload["is_active"]
    if payload.get("is_verified") is not None:
        user.is_verified = payload["is_verified"]
    if payload.get("role") is not None:
        organization = db.execute(select(Organization).where(Organization.id == user.organization_id).limit(1)).scalar_one_or_none()
        if not organization:
            raise ValueError("User organization not found.")
        role = ensure_role(db, organization, payload["role"])
        user.role = role
    if payload.get("department_id") is not None:
        if payload["department_id"]:
            department = get_department_by_id_for_organization(db, user.organization, payload["department_id"])
            if not department:
                raise ValueError("Invalid department for this user's organization.")
            user.department_id = department.id
        else:
            user.department_id = None
    if payload.get("group_id") is not None:
        if payload["group_id"]:
            group = get_user_group_by_id_for_organization(db, user.organization, payload["group_id"])
            if not group:
                raise ValueError("Invalid group for this user's organization.")
            membership = db.execute(
                select(UserGroupMembership)
                .where(UserGroupMembership.organization_id == user.organization_id)
                .where(UserGroupMembership.user_id == user.id)
                .where(UserGroupMembership.group_id == group.id)
                .limit(1)
            ).scalar_one_or_none()
            if not membership:
                membership = UserGroupMembership(
                    organization_id=user.organization_id,
                    group_id=group.id,
                    user_id=user.id,
                )
                db.add(membership)
        else:
            db.query(UserGroupMembership).filter(
                UserGroupMembership.organization_id == user.organization_id,
                UserGroupMembership.user_id == user.id,
            ).delete(synchronize_session=False)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def list_organizations(db: Session) -> list[Organization]:
    return db.execute(select(Organization)).scalars().all()


def get_platform_overview(db: Session) -> dict[str, Any]:
    organization_count = db.query(Organization).count()
    active_organizations = db.query(Organization).filter(Organization.is_active == True).count()
    total_users = db.query(User).filter(User.is_deleted == False).count()
    total_revenue = db.query(func.coalesce(func.sum(Payment.amount), 0.0)).scalar() or 0.0
    active_subscriptions = db.query(OrganizationSubscription).filter(OrganizationSubscription.status == "active").count()
    return {
        "organization_count": organization_count,
        "active_organizations": active_organizations,
        "total_users": total_users,
        "total_revenue": float(total_revenue),
        "active_subscriptions": active_subscriptions,
    }


def revoke_invitation(db: Session, invitation_id: int | str, organization: Organization) -> Invitation:
    invitation = db.execute(
        select(Invitation)
        .where(Invitation.id == invitation_id)
        .where(Invitation.organization_id == organization.id)
        .limit(1)
    ).scalar_one_or_none()
    if not invitation:
        raise ValueError("Invitation not found for this organization.")
    invitation.is_revoked = True
    db.add(invitation)
    db.commit()
    db.refresh(invitation)
    return invitation


def get_organization_by_slug(db: Session, slug: str) -> Organization | None:
    normalized = _normalize_slug(slug)
    return db.execute(select(Organization).where(Organization.slug == normalized).limit(1)).scalar_one_or_none()


def get_or_create_default_organization_settings(db: Session, organization: Organization) -> OrganizationSettings:
    existing = db.execute(
        select(OrganizationSettings).where(OrganizationSettings.organization_id == organization.id)
    ).scalar_one_or_none()
    if existing:
        return existing

    return create_organization_settings(
        db,
        organization,
        {
            "brand_name": organization.name,
            "storage_limit_mb": 1024,
            "user_limit": 50,
        },
    )


def create_organization_onboarding(
    db: Session,
    name: str,
    domain: str | None,
    description: str | None,
    admin_email: str,
    admin_password: str,
    admin_full_name: str | None,
    plan: str | None = "starter",
) -> tuple[Organization, User]:
    organization = create_organization(db, name=name, domain=domain, description=description)
    create_organization_settings(
        db,
        organization,
        {
            "brand_name": organization.name,
            "custom_domain": domain,
            "storage_limit_mb": 1024,
            "user_limit": 50,
        },
    )
    create_organization_subscription(
        db,
        organization,
        plan=plan or "starter",
        seats_allocated=50,
        storage_allocated_mb=1024,
    )
    admin_user = create_user(
        db=db,
        email=admin_email,
        password=admin_password,
        tenant_id=organization.slug,
        full_name=admin_full_name,
        role_name="admin",
        allow_unrestricted_role=True,
    )
    return organization, admin_user
