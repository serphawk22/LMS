from __future__ import annotations

from datetime import datetime
from typing import List

from pydantic import BaseModel, ConfigDict, Field

from .user import UserRead


class AnnouncementBase(BaseModel):
    title: str
    content: str
    course_id: int | None = None
    priority: str = "normal"
    target_audience: str = "all"
    published: bool = False
    published_at: datetime | None = None
    expires_at: datetime | None = None


class AnnouncementCreate(AnnouncementBase):
    pass


class AnnouncementUpdate(BaseModel):
    title: str | None = None
    content: str | None = None
    priority: str | None = None
    target_audience: str | None = None
    published: bool | None = None
    published_at: datetime | None = None
    expires_at: datetime | None = None


class AnnouncementRead(AnnouncementBase):
    id: int
    organization_id: int
    course_id: int | None = None
    created_by_id: int | None = None
    created_at: datetime
    updated_at: datetime
    created_by: UserRead | None = None

    model_config = ConfigDict(from_attributes=True)


class WeeklyStatsRead(BaseModel):
    courses_enrolled: int
    courses_completed: int
    quizzes_attempted: int
    assignments_submitted: int
    lessons_completed: int
    total_study_time_minutes: int
    average_score: float | None = None
    streak_days: int

    model_config = ConfigDict(from_attributes=True)