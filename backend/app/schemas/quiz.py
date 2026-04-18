from __future__ import annotations

import enum
from datetime import datetime
from typing import Any, List

from pydantic import BaseModel, ConfigDict, Field


class FileUploadAnswer(BaseModel):
    file_url: str
    filename: str
    content_type: str | None = None
    size_bytes: int | None = None


AnswerPayload = FileUploadAnswer | str | List[str] | bool | None


class QuizQuestionType(str, enum.Enum):
    multiple_choice = "multiple_choice"
    multiple_select = "multiple_select"
    true_false = "true_false"
    short_answer = "short_answer"
    long_answer = "long_answer"
    file_upload = "file_upload"
    coding_question = "coding_question"


class QuizQuestionBase(BaseModel):
    text: str
    question_type: QuizQuestionType = QuizQuestionType.multiple_choice
    choices: List[str] | None = None
    correct_answer: Any | None = None
    points: int = Field(default=1, ge=0)


class QuizQuestionCreate(QuizQuestionBase):
    pass


class QuizQuestionUpdate(QuizQuestionBase):
    pass


class QuizQuestionRead(BaseModel):
    id: int
    quiz_id: int
    text: str
    question_type: QuizQuestionType
    choices: List[str] | None = None
    correct_answer: Any | None = None
    points: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class QuizQuestionAttemptRead(BaseModel):
    id: int
    text: str
    question_type: QuizQuestionType
    choices: List[str] | None = None
    points: int

    model_config = ConfigDict(from_attributes=True)


class QuizBase(BaseModel):
    course_id: int
    title: str
    description: str | None = None
    total_points: int | None = None
    passing_score: int = 0
    pass_percentage: int = 0
    time_limit_minutes: int = 0
    randomize_questions: bool = False
    question_count: int = 0
    max_attempts: int = 0
    auto_grade_enabled: bool = True
    published: bool = True
    start_time: datetime | None = None
    due_date: datetime | None = None


class QuizCreate(QuizBase):
    questions: List[QuizQuestionCreate] | None = None
    bank_question_ids: List[int] | None = None


class QuizUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    total_points: int | None = None
    passing_score: int | None = None
    pass_percentage: int | None = None
    time_limit_minutes: int | None = None
    randomize_questions: bool | None = None
    question_count: int | None = None
    max_attempts: int | None = None
    auto_grade_enabled: bool | None = None
    published: bool | None = None
    start_time: datetime | None = None
    due_date: datetime | None = None


class QuizRead(BaseModel):
    id: int
    course_id: int
    title: str
    description: str | None = None
    total_points: int
    passing_score: int
    pass_percentage: int
    time_limit_minutes: int
    randomize_questions: bool
    question_count: int
    max_attempts: int
    auto_grade_enabled: bool
    published: bool
    start_time: datetime | None = None
    due_date: datetime | None = None
    questions: List[QuizQuestionRead] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class QuizAttemptStartRead(BaseModel):
    attempt_id: int
    quiz_id: int
    title: str
    time_limit_minutes: int
    expires_at: datetime | None = None
    questions: List[QuizQuestionAttemptRead] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class QuizAnswer(BaseModel):
    question_id: int
    answer: AnswerPayload = None


class QuizAttemptSubmit(BaseModel):
    attempt_id: int
    answers: List[QuizAnswer] = Field(default_factory=list)


class QuizAttemptAnswerRead(BaseModel):
    question_id: int
    question_text: str
    question_type: QuizQuestionType
    choices: List[str] | None = None
    student_answer: AnswerPayload = None
    correct_answer: Any | None = None
    is_correct: bool | None = None
    points_awarded: float = 0
    points_possible: float = 0


class QuizAttemptRead(BaseModel):
    id: int
    quiz_id: int
    score: float
    passed: bool
    status: str
    attempt_number: int
    started_at: datetime
    completed_at: datetime | None = None
    submitted_at: datetime | None = None
    auto_graded: bool
    answers: List[QuizAttemptAnswerRead] | None = None
    quiz_title: str | None = None
    course_title: str | None = None
    student_name: str | None = None
    total_points: float | None = None
    max_attempts: int | None = None

    model_config = ConfigDict(from_attributes=True)


class QuizAttemptGrade(BaseModel):
    score: float
    passed: bool | None = None
    status: str | None = None


class QuizAnalyticsQuestionSummary(BaseModel):
    question_id: int
    times_answered: int
    correct_percentage: float
    average_score: float

    model_config = ConfigDict(from_attributes=True)


class QuestionBankBase(BaseModel):
    title: str
    description: str | None = None


class QuestionBankCreate(QuestionBankBase):
    pass


class QuestionBankRead(QuestionBankBase):
    id: int
    questions: List[QuizQuestionRead] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class QuizAnalyticsRead(BaseModel):
    quiz_id: int
    total_attempts: int
    average_score: float
    pass_rate: float
    average_time_minutes: float
    question_summary: List[QuizAnalyticsQuestionSummary] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)
