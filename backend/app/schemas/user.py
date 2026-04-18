from datetime import date

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserBase(BaseModel):
    email: EmailStr
    full_name: str | None = None
    role: str = "student"


class UserCreate(UserBase):
    password: str = Field(..., min_length=8)


class UserUpdate(BaseModel):
    email: EmailStr | None = None
    full_name: str | None = None
    is_active: bool | None = None
    is_verified: bool | None = None
    role: str | None = None
    department_id: int | None = None
    group_id: int | None = None


class UserProfileUpdate(BaseModel):
    full_name: str | None = None
    age: int | None = None
    joined_at: date | None = None
    github_url: str | None = None
    linkedin_url: str | None = None
    avatar_url: str | None = None


class UserRead(UserBase):
    id: int
    tenant_id: int = Field(..., alias="organization_id")
    is_active: bool
    is_verified: bool = False
    role: str | None = Field(None, alias="role_name")
    age: int | None = None
    joined_at: date | None = None
    github_url: str | None = None
    linkedin_url: str | None = None
    avatar_url: str | None = None
    average_rating: float = 0.0
    review_count: int = 0

    model_config = ConfigDict(from_attributes=True)
