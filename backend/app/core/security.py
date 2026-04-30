from datetime import datetime, timedelta
from typing import Any
from uuid import uuid4

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.config import settings

# Use argon2 to avoid compatibility issues on Python 3.14+
pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")


def _generate_session_id() -> str:
    return str(uuid4())


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_token(data: dict[str, Any], expires_minutes: int | None = None) -> str:
    payload = data.copy()
    payload.setdefault("session_id", _generate_session_id())
    payload.setdefault("jti", str(uuid4()))
    expire = datetime.utcnow() + timedelta(minutes=expires_minutes or settings.jwt_access_token_expires_minutes)
    payload.update({"exp": expire, "sub": str(data.get("sub"))})
    return jwt.encode(payload, settings.jwt_secret.get_secret_value(), algorithm=settings.jwt_algorithm)


def create_access_token(data: dict[str, Any]) -> str:
    return create_token(data, expires_minutes=settings.jwt_access_token_expires_minutes)


def create_refresh_token(data: dict[str, Any]) -> str:
    return create_token(data, expires_minutes=settings.jwt_refresh_token_expires_minutes)


def decode_token(token: str) -> dict[str, Any]:
    try:
        return jwt.decode(token, settings.jwt_secret.get_secret_value(), algorithms=[settings.jwt_algorithm])
    except JWTError as exc:
        raise ValueError("Invalid token") from exc
