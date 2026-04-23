from __future__ import annotations

from datetime import datetime
from typing import List

from pydantic import BaseModel, ConfigDict, Field


class DiscussionAuthorRead(BaseModel):
    id: int
    full_name: str | None = None
    email: str
    role: str = "student"

    model_config = ConfigDict(from_attributes=True)


class DiscussionReplyBase(BaseModel):
    message: str = Field(..., min_length=1, max_length=5000)


class DiscussionReplyCreate(DiscussionReplyBase):
    pass


class DiscussionReplyUpdate(BaseModel):
    message: str = Field(..., min_length=1, max_length=5000)


class DiscussionReplyRead(DiscussionReplyBase):
    id: int
    discussion_id: int
    user_id: int
    organization_id: int
    created_at: datetime
    updated_at: datetime
    author: DiscussionAuthorRead
    can_edit: bool = False
    can_delete: bool = False
    is_best_answer: bool = False
    can_mark_best_answer: bool = False


class DiscussionBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: str = Field(..., min_length=1, max_length=10000)
    category: str = Field(..., min_length=1, max_length=100)


class DiscussionCreate(DiscussionBase):
    pass


class DiscussionStatusUpdate(BaseModel):
    status: str = Field(..., pattern="^(open|closed)$")


class MarkBestAnswerUpdate(BaseModel):
    is_best_answer: bool = Field(..., description="Whether to mark as best answer or unmark")


class DiscussionRead(BaseModel):
    id: int
    title: str
    description: str
    category: str
    status: str
    user_id: int
    organization_id: int
    created_at: datetime
    updated_at: datetime
    reply_count: int = 0
    author: DiscussionAuthorRead
    can_manage_status: bool = False
    can_reply: bool = True


class DiscussionDetailRead(DiscussionRead):
    replies: List[DiscussionReplyRead] = Field(default_factory=list)
