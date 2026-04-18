from __future__ import annotations

from datetime import datetime
from typing import Any, List

from pydantic import BaseModel, ConfigDict, Field


class AssignmentBase(BaseModel):
    course_id: int
    title: str
    instructions: str | None = None
    due_date: datetime | None = None
    max_score: int = Field(default=0, ge=0)
    published: bool = False
    allow_late_submission: bool = False
    attachments: List[dict[str, Any]] | None = None


class AssignmentCreate(AssignmentBase):
    pass


class AssignmentUpdate(BaseModel):
    title: str | None = None
    instructions: str | None = None
    due_date: datetime | None = None
    max_score: int | None = None
    published: bool | None = None
    allow_late_submission: bool | None = None
    attachments: List[dict[str, Any]] | None = None


class AssignmentAttachment(BaseModel):
    filename: str
    mime_type: str
    size: int | None = None
    content: str | None = None
    url: str | None = None
    key: str | None = None


class AssignmentRead(BaseModel):
    id: int
    course_id: int
    course_name: str | None = None
    title: str
    instructions: str | None = None
    due_date: datetime | None = None
    max_score: int
    published: bool
    allow_late_submission: bool = False
    attachments: List[dict[str, Any]] | None = None
    created_at: datetime
    updated_at: datetime
    submissions_count: int = 0
    submission: AssignmentSubmissionRead | None = None

    model_config = ConfigDict(from_attributes=True)


class AssignmentSubmissionCreate(BaseModel):
    content: str | None = None
    submission_link: str | None = Field(default=None, alias='submissionLink')
    attachments: List[AssignmentAttachment] | None = None

    model_config = ConfigDict(populate_by_name=True)


class AssignmentSubmissionRead(BaseModel):
    id: int
    assignment_id: int
    user_id: int
    student_name: str | None = None
    submission_type: str | None = None
    submitted_at: datetime
    content: str | None = None
    attachments: List[AssignmentAttachment] | None = None
    grade: float | None = None
    feedback: str | None = None
    status: str
    late: bool
    graded_at: datetime | None = None
    graded_by: int | None = None

    model_config = ConfigDict(from_attributes=True)


class AssignmentGradePayload(BaseModel):
    grade: float
    feedback: str | None = None
    status: str | None = None
