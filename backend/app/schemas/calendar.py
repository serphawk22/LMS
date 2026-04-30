"""Calendar schemas for event listings."""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class CalendarEventRead(BaseModel):
    """Response model for calendar events (announcements and live classes)."""
    id: int
    title: str
    date: str = Field(..., description="Event date in YYYY-MM-DD format")
    type: str = Field(..., description="Event type: 'announcement' or 'live_class'")
    start_time: Optional[str] = Field(None, description="Start time in HH:MM format (live_class only)")
    end_time: Optional[str] = Field(None, description="End time in HH:MM format (live_class only)")
    course_name: Optional[str] = Field(None, description="Course name (live_class only)")
    description: Optional[str] = Field(None, description="Event description")

    model_config = ConfigDict(from_attributes=True)
