from typing import Any

from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel, EmailStr, Field

from .user import UserRead

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenPayload(BaseModel):
    sub: str
    exp: int
    tenant_id: str | None = None
    role: str | None = None
    type: str | None = None


class LoginData(BaseModel):
    email: EmailStr
    password: str


class LoginResponse(Token):
    refresh_token: str
    expires_in: int


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class RefreshTokenResponse(Token):
    refresh_token: str
    expires_in: int


class RegistrationResponse(BaseModel):
    user: UserRead
    verification_token: str


class VerifyEmailRequest(BaseModel):
    token: str


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetBody(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8)
