from __future__ import annotations

import enum
from datetime import datetime, timezone
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, model_validator

from .user import UserRead


class LiveSessionProvider(str, enum.Enum):
    manual = "manual"
    zoom = "zoom"
    google_meet = "google_meet"
    microsoft_teams = "microsoft_teams"


class LiveClassBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    course_name: str = Field(..., min_length=1, max_length=255)
    scheduled_at: datetime
    duration_minutes: int | None = Field(None, ge=5, le=480)


class LiveClassCreate(LiveClassBase):
    provider: LiveSessionProvider = Field(default=LiveSessionProvider.manual)
    provider_join_url: str | None = Field(None, max_length=512)


def parse_datetime_string(value: str) -> datetime:
    text = value.strip()

    # Support strict ISO format first, including timezone-aware values.
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"

    try:
        dt = datetime.fromisoformat(text)
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt
    except ValueError:
        pass

    # Support instructor-friendly format: DD-MM-YYYY HH:MM or DD-MM-YYYY HH:MM:SS
    for fmt in ("%d-%m-%Y %H:%M", "%d-%m-%Y %H:%M:%S"):
        try:
            dt = datetime.strptime(text, fmt)
            return dt.replace(tzinfo=timezone.utc)
        except ValueError:
            continue

    raise ValueError(
        "Invalid start_time format. Use ISO format YYYY-MM-DDTHH:MM:SS or DD-MM-YYYY HH:MM."
    )


class LiveClassCreateRequest(BaseModel):
    """Accepts incoming request with user-friendly field names."""
    title: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    course_name: str = Field(..., min_length=1, max_length=255)
    start_time: str | datetime = Field(..., description="Start time in ISO or DD-MM-YYYY HH:MM format")
    duration: int = Field(..., ge=5, le=480, description="Duration in minutes")
    # Removed platform and meeting_link fields for internal-only system

    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    @model_validator(mode="before")
    def parse_start_time(cls, values):
        if isinstance(values, dict):
            start_time = values.get("start_time")
            if isinstance(start_time, str):
                values["start_time"] = parse_datetime_string(start_time)
            elif isinstance(start_time, datetime) and start_time.tzinfo is None:
                values["start_time"] = start_time.replace(tzinfo=timezone.utc)

        return values

    @model_validator(mode="after")
    def validate_all_fields(self):
        if self.start_time is None:
            raise ValueError("start_time is required")
        if not self.title or not self.title.strip():
            raise ValueError("title is required")
        return self


class LiveClassUpdateRequest(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None
    start_time: str | datetime | None = Field(None, description="Start time in ISO or DD-MM-YYYY HH:MM format")
    duration: int | None = Field(None, ge=5, le=480, description="Duration in minutes")
    provider_join_url: str | None = Field(None, max_length=512, description="Metered or other video join URL")

    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    @model_validator(mode="before")
    def parse_start_time(cls, values):
        if isinstance(values, dict):
            start_time = values.get("start_time")
            if isinstance(start_time, str):
                values["start_time"] = parse_datetime_string(start_time)
            elif isinstance(start_time, datetime) and start_time.tzinfo is None:
                values["start_time"] = start_time.replace(tzinfo=timezone.utc)

        return values

    @model_validator(mode="after")
    def validate_optional_fields(self):
        if self.title is not None and not self.title.strip():
            raise ValueError("title must not be empty")
        return self


class LiveClassUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None
    scheduled_at: datetime | None = None
    duration_minutes: int | None = Field(None, ge=5, le=480)
    provider: LiveSessionProvider | None = None
    provider_join_url: str | None = Field(None, max_length=512)


class LiveClassRead(BaseModel):
    id: int
    course_id: int
    course_name: str | None = None
    title: str
    description: str | None = None
    scheduled_at: datetime
    duration_minutes: int | None = None
    instructor_id: int | None = None
    provider: LiveSessionProvider
    provider_join_url: str | None = None
    provider_meeting_id: str | None = None
    is_recurring: bool
    created_at: datetime
    updated_at: datetime
    instructor: UserRead | None = None

    model_config = ConfigDict(from_attributes=True)


class LiveClassDetailRead(LiveClassRead):
    attendances: List[LiveClassAttendanceRead] = []
    recordings: List[LiveClassRecordingRead] = []


class LiveClassAttendanceRead(BaseModel):
    id: int
    user_id: int
    attended_at: datetime
    status: str
    user: UserRead | None = None

    model_config = ConfigDict(from_attributes=True)


class LiveClassRecordingRead(BaseModel):
    id: int
    live_class_id: int
    title: str
    file_url: str
    duration_minutes: float | None = None
    notes: str | None = None
    uploaded_at: datetime

    model_config = ConfigDict(from_attributes=True)


class LiveClassRecordingCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    file_url: str = Field(..., max_length=512)
    file_key: str = Field(..., max_length=512)
    duration_minutes: float | None = None
    notes: str | None = None


class LiveClassForStudentRead(BaseModel):
    id: int
    title: str
    description: str | None = None
    scheduled_at: datetime
    duration_minutes: int | None = None
    provider: LiveSessionProvider
    provider_join_url: str | None = None
    instructor: UserRead | None = None
    is_ongoing: bool = False
    is_past: bool = False

    model_config = ConfigDict(from_attributes=True)
