from datetime import datetime, timedelta, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import schemas
from app.dependencies import get_current_active_user, get_current_admin_user, get_db, get_tenant, require_roles
from app.models import Question, Quiz, QuizAttempt, User
from app.services import auth as auth_service
from app.services import quizzes as quiz_service

router = APIRouter()


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _can_manage_quizzes(user: User) -> bool:
    return (user.role_name or "").lower() in {"instructor", "organization_admin", "super_admin"}


def _is_past_due(due_date: datetime | None) -> bool:
    if due_date is None:
        return False
    if due_date.tzinfo is None:
        due_date = due_date.replace(tzinfo=timezone.utc)
    return _utc_now() > due_date


def _is_quiz_available(start_time: datetime | None) -> bool:
    """Check if quiz has started (start_time is in the past or not set)"""
    if start_time is None:
        return True
    if start_time.tzinfo is None:
        start_time = start_time.replace(tzinfo=timezone.utc)
    return _utc_now() >= start_time


def _serialize_quiz_for_user(quiz: Quiz, can_manage: bool):
    """Serialize quiz, hiding correct_answer from non-instructors"""
    if can_manage:
        return quiz

    # For students, hide correct answers from the quiz data
    quiz_payload = schemas.QuizRead.model_validate(quiz).model_dump()
    for question in quiz_payload.get("questions", []):
        question["correct_answer"] = None
    return quiz_payload


def _serialize_questions_for_attempt(questions):
    """Convert questions to attempt format, excluding correct answers"""
    return [
        schemas.QuizQuestionAttemptRead(
            id=question.id,
            text=question.text,
            question_type=question.question_type,
            choices=question.choices,
            points=question.points,
        )
        for question in questions
    ]


@router.get("/", response_model=List[schemas.QuizRead])
def list_quizzes(
    limit: int = 25,
    offset: int = 0,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    return quiz_service.get_organization_quizzes(
        db,
        organization.id,
        include_unpublished=_can_manage_quizzes(current_user),
        user=current_user,
        limit=limit,
        offset=offset,
    )


@router.put("/questions/{question_id}", response_model=schemas.QuizQuestionRead)
def update_quiz_question(
    question_id: int,
    payload: schemas.QuizQuestionUpdate,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("instructor", "organization_admin", "super_admin")),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    question = quiz_service.get_question_by_id(db, question_id, organization.id)
    if not question:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found.")

    try:
        return quiz_service.update_question(db, question, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.delete("/questions/{question_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_quiz_question(
    question_id: int,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("instructor", "organization_admin", "super_admin")),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    question = quiz_service.get_question_by_id(db, question_id, organization.id)
    if not question:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found.")

    quiz_service.delete_question(db, question)
    return None


@router.get("/banks", response_model=List[schemas.QuestionBankRead])
def list_question_banks(
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("instructor", "organization_admin", "super_admin")),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    return quiz_service.get_organization_question_banks(db, organization.id)


@router.get("/banks/{bank_id}", response_model=schemas.QuestionBankRead)
def get_question_bank(
    bank_id: int,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("instructor", "organization_admin", "super_admin")),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    bank = quiz_service.get_question_bank_by_id(db, bank_id, organization.id)
    if not bank:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question bank not found.")
    return bank


@router.post("/banks", response_model=schemas.QuestionBankRead, status_code=status.HTTP_201_CREATED)
def create_question_bank(
    payload: schemas.QuestionBankCreate,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("instructor", "organization_admin", "super_admin")),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    try:
        return quiz_service.create_question_bank(db, organization, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.put("/banks/{bank_id}", response_model=schemas.QuestionBankRead)
def update_question_bank(
    bank_id: int,
    payload: schemas.QuestionBankCreate,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("instructor", "organization_admin", "super_admin")),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    bank = quiz_service.get_question_bank_by_id(db, bank_id, organization.id)
    if not bank:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question bank not found.")

    return quiz_service.update_question_bank(db, bank, payload)


@router.delete("/banks/{bank_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_question_bank(
    bank_id: int,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("instructor", "organization_admin", "super_admin")),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    bank = quiz_service.get_question_bank_by_id(db, bank_id, organization.id)
    if not bank:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question bank not found.")

    quiz_service.soft_delete_question_bank(db, bank)
    return None


@router.get("/banks/{bank_id}/questions", response_model=List[schemas.QuizQuestionRead])
def list_question_bank_questions(
    bank_id: int,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("instructor", "organization_admin", "super_admin")),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    bank = quiz_service.get_question_bank_by_id(db, bank_id, organization.id)
    if not bank:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question bank not found.")

    return quiz_service.get_question_bank_questions(db, bank.id, organization.id)


@router.post("/banks/{bank_id}/questions", response_model=schemas.QuizQuestionRead, status_code=status.HTTP_201_CREATED)
def create_question_bank_question(
    bank_id: int,
    payload: schemas.QuizQuestionCreate,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("instructor", "organization_admin", "super_admin")),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    bank = quiz_service.get_question_bank_by_id(db, bank_id, organization.id)
    if not bank:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question bank not found.")

    try:
        return quiz_service.create_bank_question(db, bank, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/attempts", response_model=List[schemas.QuizAttemptRead])
def list_user_quiz_attempts(
    limit: int = 25,
    offset: int = 0,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    return quiz_service.get_user_all_quiz_attempts(db, current_user.id, organization.id, limit=limit, offset=offset)


@router.get("/attempts/{attempt_id}", response_model=schemas.QuizAttemptRead)
def get_quiz_attempt(
    attempt_id: int,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    attempt = quiz_service.get_quiz_attempt_by_id(db, attempt_id, current_user.id, organization.id)
    if not attempt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attempt not found.")

    return quiz_service.serialize_quiz_attempt(attempt)


@router.get("/results", response_model=List[schemas.QuizAttemptRead])
def list_quiz_results(
    limit: int = 25,
    offset: int = 0,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("instructor", "organization_admin", "super_admin")),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    return quiz_service.get_quiz_results(db, organization.id, limit=limit, offset=offset)


@router.get("/course/{course_name}", response_model=schemas.QuizRead)
def get_quiz_by_course(
    course_name: str,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Get quiz by course name"""
    from app.services import enrollment as enrollment_service
    
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    
    quiz = quiz_service.get_quiz_by_course_name(db, course_name, organization.id)
    if not quiz or (not _can_manage_quizzes(current_user) and not quiz.published):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quiz not found.")
    
    # Check if quiz due date has passed
    if _is_past_due(quiz.due_date):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Quiz submission time has ended."
        )
    
    # Check if user is enrolled in the course containing this quiz (unless instructor/admin)
    is_instructor = _can_manage_quizzes(current_user)
    if not is_instructor:
        enrollment = enrollment_service.get_user_enrollment(db, current_user.id, quiz.course_id, organization.id)
        if not enrollment:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not enrolled in the course containing this quiz.",
            )
    
    return _serialize_quiz_for_user(quiz, _can_manage_quizzes(current_user))


@router.get("/{quiz_id}", response_model=schemas.QuizRead)
def get_quiz(
    quiz_id: int,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    from app.services import enrollment as enrollment_service
    
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    quiz = quiz_service.get_quiz_by_id(db, quiz_id, organization.id)
    if not quiz or (not _can_manage_quizzes(current_user) and not quiz.published):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quiz not found.")
    
    # Check if user is enrolled in the course containing this quiz (unless instructor/admin)
    is_instructor = _can_manage_quizzes(current_user)
    if not is_instructor:
        enrollment = enrollment_service.get_user_enrollment(db, current_user.id, quiz.course_id, organization.id)
        if not enrollment:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not enrolled in the course containing this quiz.",
            )
    
    return _serialize_quiz_for_user(quiz, _can_manage_quizzes(current_user))


@router.get("/courses/{course_id}/quiz", response_model=schemas.QuizRead)
def get_quiz_by_course_id(
    course_id: int,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Get quiz by course ID"""
    from app.services import enrollment as enrollment_service
    
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    
    quiz = quiz_service.get_quiz_by_course_id(db, course_id, organization.id)
    if not quiz or (not _can_manage_quizzes(current_user) and not quiz.published):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quiz not found.")
    
    # Check if quiz due date has passed
    if _is_past_due(quiz.due_date):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Quiz submission time has ended."
        )
    
    # Check if user is enrolled in the course containing this quiz (unless instructor/admin)
    is_instructor = _can_manage_quizzes(current_user)
    if not is_instructor:
        enrollment = enrollment_service.get_user_enrollment(db, current_user.id, quiz.course_id, organization.id)
        if not enrollment:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not enrolled in the course containing this quiz.",
            )
    
    return _serialize_quiz_for_user(quiz, _can_manage_quizzes(current_user))


@router.post("/", response_model=schemas.QuizRead, status_code=status.HTTP_201_CREATED)
def create_quiz(
    payload: schemas.QuizCreate,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("instructor", "organization_admin", "super_admin")),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    try:
        return quiz_service.create_quiz(db, organization, current_user, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.put("/{quiz_id}", response_model=schemas.QuizRead)
def update_quiz(
    quiz_id: int,
    payload: schemas.QuizUpdate,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("instructor", "organization_admin", "super_admin")),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    quiz = quiz_service.get_quiz_by_id(db, quiz_id, organization.id)
    if not quiz:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quiz not found.")

    try:
        return quiz_service.update_quiz(db, quiz, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.delete("/{quiz_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_quiz(
    quiz_id: int,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("instructor", "organization_admin", "super_admin")),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    quiz = quiz_service.get_quiz_by_id(db, quiz_id, organization.id)
    if not quiz:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quiz not found.")

    quiz_service.soft_delete_quiz(db, quiz)
    return None


@router.post("/{quiz_id}/questions", response_model=schemas.QuizQuestionRead, status_code=status.HTTP_201_CREATED)
def create_quiz_question(
    quiz_id: int,
    payload: schemas.QuizQuestionCreate,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("instructor", "organization_admin", "super_admin")),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    quiz = quiz_service.get_quiz_by_id(db, quiz_id, organization.id)
    if not quiz:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quiz not found.")

    try:
        return quiz_service.create_question(db, quiz, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/{quiz_id}/questions", response_model=List[schemas.QuizQuestionRead])
def list_quiz_questions(
    quiz_id: int,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    quiz = quiz_service.get_quiz_by_id(db, quiz_id, organization.id)
    if not quiz:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quiz not found.")
    return quiz_service.get_quiz_questions(db, quiz.id, organization.id)


@router.post("/{quiz_id}/start", response_model=schemas.QuizAttemptStartRead)
def start_quiz(
    quiz_id: int,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    from app.services import enrollment as enrollment_service
    
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    quiz = quiz_service.get_quiz_by_id(db, quiz_id, organization.id)
    if not quiz or not quiz.published:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quiz not found.")

    # Check if quiz start time has arrived
    if not _is_quiz_available(quiz.start_time):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Quiz will be available starting {quiz.start_time}. Please wait until the quiz start time."
        )

    # Check if quiz due date has passed
    if _is_past_due(quiz.due_date):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Quiz submission time has ended."
        )

    # Check enrollment for students
    is_instructor = (current_user.role_name or "").lower() in {"instructor", "organization_admin", "super_admin"}
    if not is_instructor:
        enrollment = enrollment_service.get_user_enrollment(db, current_user.id, quiz.course_id, organization.id)
        if not enrollment:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not enrolled in the course containing this quiz.",
            )

    try:
        attempt = quiz_service.start_quiz_attempt(db, quiz, current_user)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    # Filter questions by the attempt's selected question IDs
    selected_ids = set(attempt.question_ids) if attempt.question_ids else set()
    questions = [
        question for question in quiz.questions
        if not question.is_deleted and question.id in selected_ids
    ]
    
    # Convert to attempt format without exposing correct answers
    attempt_questions = _serialize_questions_for_attempt(questions)

    expires_at = None
    if quiz.time_limit_minutes > 0:
        expires_at = _utc_now() + timedelta(minutes=quiz.time_limit_minutes)

    return schemas.QuizAttemptStartRead(
        attempt_id=attempt.id,
        quiz_id=quiz.id,
        title=quiz.title,
        time_limit_minutes=quiz.time_limit_minutes,
        expires_at=expires_at,
        questions=attempt_questions,
    )


@router.post("/course/{course_name}/start", response_model=schemas.QuizAttemptStartRead)
def start_quiz_by_course(
    course_name: str,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Start quiz attempt by course name"""
    from app.services import enrollment as enrollment_service
    
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    quiz = quiz_service.get_quiz_by_course_name(db, course_name, organization.id)
    if not quiz or not quiz.published:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quiz not found.")

    # Check if quiz start time has arrived
    if not _is_quiz_available(quiz.start_time):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Quiz will be available starting {quiz.start_time}. Please wait until the quiz start time."
        )

    # Check if quiz due date has passed
    if _is_past_due(quiz.due_date):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Quiz submission time has ended."
        )

    # Check enrollment for students
    is_instructor = (current_user.role_name or "").lower() in {"instructor", "organization_admin", "super_admin"}
    if not is_instructor:
        enrollment = enrollment_service.get_user_enrollment(db, current_user.id, quiz.course_id, organization.id)
        if not enrollment:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not enrolled in the course containing this quiz.",
            )

    try:
        attempt = quiz_service.start_quiz_attempt(db, quiz, current_user)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    # Filter questions by the attempt's selected question IDs
    selected_ids = set(attempt.question_ids) if attempt.question_ids else set()
    questions = [
        question for question in quiz.questions
        if not question.is_deleted and question.id in selected_ids
    ]
    
    # Convert to attempt format without exposing correct answers
    attempt_questions = _serialize_questions_for_attempt(questions)

    expires_at = None
    if quiz.time_limit_minutes > 0:
        expires_at = _utc_now() + timedelta(minutes=quiz.time_limit_minutes)

    return schemas.QuizAttemptStartRead(
        attempt_id=attempt.id,
        quiz_id=quiz.id,
        title=quiz.title,
        time_limit_minutes=quiz.time_limit_minutes,
        expires_at=expires_at,
        questions=attempt_questions,
    )


@router.post("/courses/{course_id}/quiz/start", response_model=schemas.QuizAttemptStartRead)
def start_quiz_by_course_id(
    course_id: int,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Start quiz attempt by course ID"""
    from app.services import enrollment as enrollment_service
    
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    quiz = quiz_service.get_quiz_by_course_id(db, course_id, organization.id)
    if not quiz or not quiz.published:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quiz not found.")

    # Check if quiz start time has arrived
    if not _is_quiz_available(quiz.start_time):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Quiz will be available starting {quiz.start_time}. Please wait until the quiz start time."
        )

    # Check if quiz due date has passed
    if _is_past_due(quiz.due_date):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Quiz submission time has ended."
        )

    # Check enrollment for students
    is_instructor = (current_user.role_name or "").lower() in {"instructor", "organization_admin", "super_admin"}
    if not is_instructor:
        enrollment = enrollment_service.get_user_enrollment(db, current_user.id, quiz.course_id, organization.id)
        if not enrollment:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not enrolled in the course containing this quiz.",
            )

    try:
        attempt = quiz_service.start_quiz_attempt(db, quiz, current_user)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    # Filter questions by the attempt's selected question IDs
    selected_ids = set(attempt.question_ids) if attempt.question_ids else set()
    questions = [
        question for question in quiz.questions
        if not question.is_deleted and question.id in selected_ids
    ]
    
    # Convert to attempt format without exposing correct answers
    attempt_questions = _serialize_questions_for_attempt(questions)

    expires_at = None
    if quiz.time_limit_minutes > 0:
        expires_at = _utc_now() + timedelta(minutes=quiz.time_limit_minutes)

    return schemas.QuizAttemptStartRead(
        attempt_id=attempt.id,
        quiz_id=quiz.id,
        title=quiz.title,
        time_limit_minutes=quiz.time_limit_minutes,
        expires_at=expires_at,
        questions=attempt_questions,
    )

@router.post("/{quiz_id}/submit", response_model=schemas.QuizAttemptRead)
def submit_quiz(
    quiz_id: int,
    payload: schemas.QuizAttemptSubmit,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    quiz = quiz_service.get_quiz_by_id(db, quiz_id, organization.id)
    if not quiz or not quiz.published:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quiz not found.")

    attempt = quiz_service.get_quiz_attempt_by_id(db, payload.attempt_id, current_user.id, organization.id)
    if not attempt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attempt not found.")

    try:
        attempt = quiz_service.submit_quiz_attempt(db, quiz, attempt, [answer.model_dump() for answer in payload.answers])
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return quiz_service.serialize_quiz_attempt(attempt, quiz=quiz)


@router.get("/{quiz_id}/attempts", response_model=List[schemas.QuizAttemptRead])
def list_quiz_attempts(
    quiz_id: int,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    quiz = quiz_service.get_quiz_by_id(db, quiz_id, organization.id)
    if not quiz:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quiz not found.")

    return quiz_service.get_user_quiz_attempts(db, quiz.id, current_user.id, organization.id)


@router.get("/{quiz_id}/analytics", response_model=schemas.QuizAnalyticsRead)
def quiz_analytics(
    quiz_id: int,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("instructor", "organization_admin", "super_admin")),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    quiz = quiz_service.get_quiz_by_id(db, quiz_id, organization.id)
    if not quiz:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quiz not found.")

    analytics = quiz_service.get_quiz_analytics(db, quiz)
    return schemas.QuizAnalyticsRead(**analytics)


@router.post("/attempts/{attempt_id}/grade", response_model=schemas.QuizAttemptRead)
def grade_quiz_attempt(
    attempt_id: int,
    payload: schemas.QuizAttemptGrade,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("instructor", "organization_admin", "super_admin")),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    attempt = (
        db.query(QuizAttempt)
        .filter(QuizAttempt.id == attempt_id, QuizAttempt.organization_id == organization.id, QuizAttempt.is_deleted == False)
        .one_or_none()
    )
    if not attempt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attempt not found.")

    graded_attempt = quiz_service.grade_quiz_attempt(db, attempt, payload)
    return quiz_service.serialize_quiz_attempt(graded_attempt)


