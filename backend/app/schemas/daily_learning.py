from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class DailyLearningVideoBase(BaseModel):
    title: str
    description: str
    video_url: str
    video_type: str


class DailyLearningVideoCreate(DailyLearningVideoBase):
    user_id: Optional[int] = None
    vimeo_url: Optional[str] = None


class DailyLearningVideoRead(DailyLearningVideoBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    user_name: str
    uploaded_at: datetime