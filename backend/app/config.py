from pathlib import Path

from pydantic import AliasChoices, SecretStr, Field, ConfigDict, field_validator
from pydantic_settings import BaseSettings

BASE_DIR = Path(__file__).resolve().parent


class Settings(BaseSettings):
    model_config = ConfigDict(
        env_file=BASE_DIR.parent / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
        env_file_first=True,
    )

    app_name: str = "LMS Platform"
    environment: str = "development"
    debug: bool = True
    database_url: str = (
        "postgresql+psycopg://neondb_owner:npg_dY0BpO7Tqjai@"
        "ep-mute-violet-a4x1yk1b-pooler.us-east-1.aws.neon.tech/"
        "neondb?sslmode=require"
    )
    jwt_secret: SecretStr = SecretStr("super-secret-change-me")
    jwt_algorithm: str = "HS256"
    jwt_access_token_expires_minutes: int = 60
    jwt_refresh_token_expires_minutes: int = 60 * 24 * 7
    jwt_email_verification_token_expires_minutes: int = 60 * 24
    jwt_password_reset_token_expires_minutes: int = 60 * 30
    session_timeout_minutes: int = 60
    video_stream_presigned_url_expires_seconds: int = 600
    allowed_origins: list[str] = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3002",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "http://localhost:8000",
        "http://localhost:8001",
        "http://127.0.0.1:8000",
        "http://127.0.0.1:8001",
    ]
    tenant_header: str = "x-tenant-id"
    stripe_api_key: str | None = Field(default=None)
    stripe_webhook_secret: str | None = Field(default=None)
    s3_bucket: str | None = Field(
        default=None,
        alias="AWS_S3_BUCKET",
        validation_alias=AliasChoices("S3_BUCKET", "AWS_S3_BUCKET"),
    )
    s3_region: str | None = Field(
        default=None,
        alias="AWS_REGION",
        validation_alias=AliasChoices("S3_REGION", "AWS_REGION", "AWS_DEFAULT_REGION"),
    )
    aws_access_key_id: str | None = Field(
        default=None,
        alias="AWS_ACCESS_KEY_ID",
        validation_alias=AliasChoices("AWS_ACCESS_KEY_ID"),
    )
    aws_secret_access_key: str | None = Field(
        default=None,
        alias="AWS_SECRET_ACCESS_KEY",
        validation_alias=AliasChoices("AWS_SECRET_ACCESS_KEY"),
    )
    file_upload_max_bytes: int = Field(default=10 * 1024 * 1024)
    file_upload_allowed_types: list[str] = Field(
        default=[
            "image/jpeg",
            "image/png",
            "image/gif",
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "text/plain",
            "video/mp4",
            "audio/mpeg",
        ]
    )
    file_upload_allowed_extensions: list[str] | None = Field(default=None)
    openai_api_key: str | None = Field(
        default=None,
        alias="OPENAI_API_KEY",
        validation_alias=AliasChoices("OPENAI_API_KEY"),
    )

    @field_validator("debug", mode="before")
    @classmethod
    def parse_debug(cls, value):
        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized in {"false", "0", "no", "n", "off", "release"}:
                return False
            if normalized in {"true", "1", "yes", "y", "on", "debug"}:
                return True
        return value


settings = Settings()
