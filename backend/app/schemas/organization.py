from datetime import datetime
from pydantic import BaseModel, ConfigDict, EmailStr, Field


class OrganizationBase(BaseModel):
    name: str = Field(..., min_length=3)
    domain: str | None = None
    description: str | None = None


class OrganizationSignup(OrganizationBase):
    admin_email: EmailStr
    admin_password: str = Field(..., min_length=8)
    admin_full_name: str | None = None
    plan: str | None = "starter"


class OrganizationRead(OrganizationBase):
    id: int
    slug: str
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


class OrganizationSettingsBase(BaseModel):
    brand_name: str | None = None
    brand_color: str | None = None
    logo_url: str | None = None
    favicon_url: str | None = None
    custom_domain: str | None = None
    storage_limit_mb: int | None = None
    user_limit: int | None = None
    billing_email: EmailStr | None = None
    support_email: EmailStr | None = None
    theme: dict[str, str] | None = None
    extra_metadata: dict[str, str] | None = None


class OrganizationSettingsRead(OrganizationSettingsBase):
    organization_id: int

    model_config = ConfigDict(from_attributes=True)


class OrganizationSubscriptionRead(BaseModel):
    organization_id: int
    plan: str
    status: str
    seats_allocated: int
    seats_used: int
    storage_allocated_mb: int
    storage_used_mb: int
    current_period_end: datetime | None = None
    next_payment_date: datetime | None = None
    provider: str | None = None
    provider_reference: str | None = None

    model_config = ConfigDict(from_attributes=True)


class OrganizationSubscriptionUpdate(BaseModel):
    plan: str | None = None
    status: str | None = None
    seats_allocated: int | None = None
    storage_allocated_mb: int | None = None
    provider: str | None = None
    provider_reference: str | None = None
    next_payment_date: datetime | None = None
    current_period_end: datetime | None = None


class OrganizationUpdate(BaseModel):
    name: str | None = None
    domain: str | None = None
    description: str | None = None
    is_active: bool | None = None


class PaymentRead(BaseModel):
    id: int
    user_id: int | None = None
    amount: float
    currency: str
    provider: str
    provider_reference: str | None = None
    status: str
    payment_metadata: dict[str, str] | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PaymentUpdate(BaseModel):
    status: str | None = None
    provider_reference: str | None = None
    payment_metadata: dict[str, str] | None = None


class PaymentIntentCreate(BaseModel):
    amount: int = Field(..., gt=0)
    currency: str = Field(default="usd", min_length=3, max_length=10)
    description: str | None = None
    metadata: dict[str, str] | None = None


class PaymentIntentRead(BaseModel):
    id: str
    amount: int
    currency: str
    status: str
    client_secret: str | None = None
    metadata: dict[str, str] | None = None


class OrganizationReportRead(BaseModel):
    user_count: int
    student_count: int
    instructor_count: int
    active_users: int
    course_count: int
    revenue: float
    payment_count: int
    subscription_status: str | None = None

    model_config = ConfigDict(from_attributes=True)


class PlatformOverviewRead(BaseModel):
    organization_count: int
    active_organizations: int
    total_users: int
    total_revenue: float
    active_subscriptions: int


class DepartmentCreate(BaseModel):
    name: str = Field(..., min_length=2)
    description: str | None = None


class DepartmentRead(DepartmentCreate):
    id: int
    organization_id: int

    model_config = ConfigDict(from_attributes=True)


class UserGroupCreate(BaseModel):
    name: str = Field(..., min_length=2)
    description: str | None = None


class UserGroupRead(UserGroupCreate):
    id: int
    organization_id: int

    model_config = ConfigDict(from_attributes=True)


class InvitationCreate(BaseModel):
    email: EmailStr
    role_name: str | None = "student"
    department_id: int | None = None
    group_id: int | None = None
    message: str | None = None
    expires_in_hours: int | None = 72


class InvitationRead(BaseModel):
    id: int
    email: EmailStr
    organization_id: int
    token: str
    role_name: str | None = None
    department_id: int | None = None
    group_id: int | None = None
    expires_at: datetime
    accepted_at: datetime | None = None
    is_revoked: bool

    model_config = ConfigDict(from_attributes=True)


class InvitationAcceptRequest(BaseModel):
    token: str
    full_name: str | None = None
    password: str = Field(..., min_length=8)


class UserDepartmentAssignment(BaseModel):
    user_id: int
    department_id: int


class UserGroupAssignment(BaseModel):
    user_id: int
    group_id: int
