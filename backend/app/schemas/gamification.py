from __future__ import annotations

import enum
from datetime import datetime
from typing import Any, Dict, List

from pydantic import BaseModel, ConfigDict, Field


class LeaderboardMetric(str, enum.Enum):
    score = "score"
    completion_rate = "completion_rate"
    engagement = "engagement"
    quiz_accuracy = "quiz_accuracy"


class BadgeBase(BaseModel):
    name: str
    description: str | None = None
    icon: str | None = None
    criteria: Dict[str, Any] | None = None


class BadgeCreate(BadgeBase):
    pass


class BadgeUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    icon: str | None = None
    criteria: Dict[str, Any] | None = None


class BadgeRead(BadgeBase):
    id: int
    organization_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AchievementBase(BaseModel):
    name: str
    description: str | None = None
    icon: str | None = None
    criteria: Dict[str, Any] | None = None
    points_reward: float = 0.0


class AchievementCreate(AchievementBase):
    pass


class AchievementUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    icon: str | None = None
    criteria: Dict[str, Any] | None = None
    points_reward: float | None = None


class AchievementRead(AchievementBase):
    id: int
    organization_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UserAchievementRead(BaseModel):
    id: int
    achievement: AchievementRead
    awarded_at: datetime

    model_config = ConfigDict(from_attributes=True)


class LevelDefinitionBase(BaseModel):
    name: str
    description: str | None = None
    threshold_points: float = Field(..., ge=0.0)


class LevelDefinitionCreate(LevelDefinitionBase):
    pass


class LevelDefinitionUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    threshold_points: float | None = Field(default=None, ge=0.0)


class LevelDefinitionRead(LevelDefinitionBase):
    id: int
    organization_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UserProgressRead(BaseModel):
    user_id: int
    total_points: float
    current_level: LevelDefinitionRead | None = None
    next_level_threshold: float | None = None
    badges: List[BadgeRead] = Field(default_factory=list)
    achievements: List[UserAchievementRead] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class UserPointsUpdate(BaseModel):
    points_delta: float


class LeaderboardCreate(BaseModel):
    name: str
    description: str | None = None
    metric: LeaderboardMetric = LeaderboardMetric.score
    is_public: bool = True


class LeaderboardUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    metric: LeaderboardMetric | None = None
    is_public: bool | None = None


class LeaderboardEntryRead(BaseModel):
    id: int
    leaderboard_id: int
    user_id: int
    score: float
    rank: float
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class LeaderboardEntryWithUserRead(BaseModel):
    id: int
    leaderboard_id: int
    user_id: int
    user_name: str
    score: float
    rank: float
    user_level: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class LeaderboardRead(BaseModel):
    id: int
    name: str
    description: str | None = None
    metric: LeaderboardMetric
    is_public: bool
    entries: List[LeaderboardEntryRead] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class UserBadgeRead(BaseModel):
    id: int
    badge: BadgeRead
    awarded_at: datetime

    model_config = ConfigDict(from_attributes=True)


class GamificationSummaryRead(BaseModel):
    total_points: float
    current_level: LevelDefinitionRead | None = None
    next_level_threshold: float | None = None
    badges: List[BadgeRead] = Field(default_factory=list)
    achievements: List[UserAchievementRead] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)
