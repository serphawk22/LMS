from __future__ import annotations

import random
from datetime import datetime, timedelta, timezone
from typing import Any, List

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import Course, Question, QuestionBank, QuestionType, Quiz, QuizAttempt, User
from app.services import courses as course_service
from app.services import gamification as gamification_service
from app.schemas.quiz import (
    QuestionBankCreate,
    QuizAttemptGrade,
    QuizCreate,
    QuizQuestionCreate,
    QuizQuestionUpdate,
    QuizUpdate,
)


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _can_manage_quizzes(user: User) -> bool:
    return (user.role_name or "").lower() in {"instructor", "organization_admin", "super_admin"}


def _is_attempt_submitted(attempt: QuizAttempt) -> bool:
    return attempt.status in {"submitted", "graded", "pending_review", "expired"}


def serialize_quiz_attempt(attempt: QuizAttempt, quiz: Quiz | None = None, user: User | None = None) -> dict[str, Any]:
    quiz_obj = quiz or getattr(attempt, "quiz", None)
    course = getattr(quiz_obj, "course", None) if quiz_obj is not None else None
    return {
        "id": attempt.id,
        "quiz_id": attempt.quiz_id,
        "score": attempt.score,
        "passed": attempt.passed,
        "status": attempt.status,
        "attempt_number": attempt.attempt_number,
        "started_at": attempt.started_at,
        "completed_at": attempt.completed_at,
        "submitted_at": attempt.completed_at,
        "auto_graded": attempt.auto_graded,
        "answers": attempt.answers or [],
        "quiz_title": quiz_obj.title if quiz_obj else None,
        "course_title": course.title if course else None,
        "student_name": (user.full_name or user.email) if user else None,
        "total_points": quiz_obj.total_points if quiz_obj else None,
        "max_attempts": quiz_obj.max_attempts if quiz_obj else None,
    }


def get_organization_quizzes(db: Session, organization_id: int, include_unpublished: bool = False, user: User | None = None, limit: int = 50, offset: int = 0) -> List[Quiz]:
    from app.models import Enrollment
    
    query = db.query(Quiz).filter(Quiz.organization_id == organization_id, Quiz.is_deleted == False)
    if not include_unpublished:
        query = query.filter(Quiz.published == True)
    
    # For students, only show quizzes for enrolled courses
    if user and not _can_manage_quizzes(user):
        enrolled_course_ids = (
            db.query(Enrollment.course_id)
            .filter(
                Enrollment.user_id == user.id,
                Enrollment.organization_id == organization_id,
                Enrollment.is_deleted == False,
            )
            .subquery()
        )
        query = query.filter(Quiz.course_id.in_(enrolled_course_ids))
    
    return (
        query.order_by(Quiz.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )


def get_quiz_by_id(db: Session, quiz_id: int, organization_id: int) -> Quiz | None:
    return (
        db.query(Quiz)
        .filter(Quiz.id == quiz_id, Quiz.organization_id == organization_id, Quiz.is_deleted == False)
        .one_or_none()
    )


def get_quiz_by_course_name(db: Session, course_name: str, organization_id: int) -> Quiz | None:
    """Get quiz by course title/name and organization"""
    return (
        db.query(Quiz)
        .join(Course, Quiz.course_id == Course.id)
        .filter(
            Course.title == course_name,
            Quiz.organization_id == organization_id,
            Quiz.is_deleted == False,
            Course.is_deleted == False,
        )
        .first()
    )


def get_quiz_by_course_id(db: Session, course_id: int, organization_id: int) -> Quiz | None:
    """Get quiz by course ID and organization"""
    return (
        db.query(Quiz)
        .filter(
            Quiz.course_id == course_id,
            Quiz.organization_id == organization_id,
            Quiz.is_deleted == False,
        )
        .first()
    )


def create_quiz(db: Session, organization, creator: User, payload: QuizCreate) -> Quiz:
    course = (
        db.query(Course)
        .filter(Course.id == payload.course_id, Course.organization_id == organization.id, Course.is_deleted == False)
        .one_or_none()
    )
    if not course:
        raise ValueError("Course not found for the organization.")

    quiz = Quiz(
        course_id=course.id,
        organization_id=organization.id,
        title=payload.title,
        description=payload.description,
        total_points=payload.total_points or 0,
        passing_score=payload.passing_score,
        pass_percentage=payload.pass_percentage,
        time_limit_minutes=payload.time_limit_minutes,
        randomize_questions=payload.randomize_questions,
        question_count=payload.question_count,
        max_attempts=payload.max_attempts,
        auto_grade_enabled=payload.auto_grade_enabled,
        published=payload.published,
        due_date=payload.due_date,
    )
    db.add(quiz)
    db.commit()
    db.refresh(quiz)

    total_points = 0

    if payload.questions:
        for question_payload in payload.questions:
            _validate_question_payload(question_payload)
            question = _build_question_from_payload(quiz.id, question_payload)
            question.organization_id = organization.id
            total_points += question.points
            db.add(question)

    if payload.bank_question_ids:
        bank_questions = (
            db.query(Question)
            .filter(
                Question.id.in_(payload.bank_question_ids),
                Question.organization_id == organization.id,
                Question.bank_id.isnot(None),
                Question.is_deleted == False,
            )
            .all()
        )
        if len(bank_questions) != len(set(payload.bank_question_ids)):
            raise ValueError("One or more bank questions were not found.")

        for bank_question in bank_questions:
            copied_question = Question(
                quiz_id=quiz.id,
                text=bank_question.text,
                question_type=bank_question.question_type,
                choices=bank_question.choices,
                correct_answer=bank_question.correct_answer,
                points=bank_question.points,
                organization_id=organization.id,
            )
            total_points += copied_question.points
            db.add(copied_question)

    if total_points:
        quiz.total_points = total_points
        db.add(quiz)
        db.commit()
        db.refresh(quiz)

    try:
        from app.models import Enrollment
        from app.services.dashboard import create_notifications_for_users

        if quiz.published:
            enrolled_user_ids = [
                enrollment.user_id
                for enrollment in db.query(Enrollment)
                .filter(
                    Enrollment.course_id == course.id,
                    Enrollment.organization_id == organization.id,
                    Enrollment.is_deleted == False,
                )
                .all()
            ]
            if enrolled_user_ids:
                create_notifications_for_users(
                    db,
                    enrolled_user_ids,
                    organization.id,
                    f"New quiz available: {quiz.title}",
                    f"A new quiz has been published for {course.title}.",
                )
    except Exception:
        pass

    return quiz


def update_quiz(db: Session, quiz: Quiz, payload: QuizUpdate) -> Quiz:
    was_published = quiz.published

    for field in payload.__fields_set__:
        value = getattr(payload, field)
        if value is not None:
            setattr(quiz, field, value)

    if quiz.question_count < 0:
        raise ValueError("Question count cannot be negative.")
    if quiz.max_attempts < 0:
        raise ValueError("Max attempts cannot be negative.")

    db.add(quiz)
    db.commit()
    db.refresh(quiz)

    if not was_published and quiz.published:
        try:
            from app.models import Enrollment
            from app.services.dashboard import create_notifications_for_users

            enrolled_user_ids = [
                enrollment.user_id
                for enrollment in db.query(Enrollment)
                .filter(
                    Enrollment.course_id == quiz.course_id,
                    Enrollment.organization_id == quiz.organization_id,
                    Enrollment.is_deleted == False,
                )
                .all()
            ]
            if enrolled_user_ids:
                create_notifications_for_users(
                    db,
                    enrolled_user_ids,
                    quiz.organization_id,
                    f"New quiz available: {quiz.title}",
                    f"A new quiz has been published for {quiz.course.title}.",
                )
        except Exception:
            pass

    return quiz


def soft_delete_quiz(db: Session, quiz: Quiz) -> None:
    quiz.is_deleted = True
    db.add(quiz)
    db.commit()


def create_question(db: Session, quiz: Quiz, payload: QuizQuestionCreate) -> Question:
    if quiz.organization_id != quiz.course.organization_id:
        raise ValueError("Quiz organization mismatch.")

    _validate_question_payload(payload)
    question = _build_question_from_payload(quiz.id, payload)
    question.organization_id = quiz.organization_id
    db.add(question)
    db.commit()
    db.refresh(question)

    quiz.total_points += question.points
    db.add(quiz)
    db.commit()
    db.refresh(quiz)
    return question


def get_organization_question_banks(db: Session, organization_id: int, limit: int = 50, offset: int = 0) -> List[QuestionBank]:
    return (
        db.query(QuestionBank)
        .filter(QuestionBank.organization_id == organization_id, QuestionBank.is_deleted == False)
        .order_by(QuestionBank.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )


def get_question_bank_by_id(db: Session, bank_id: int, organization_id: int) -> QuestionBank | None:
    return (
        db.query(QuestionBank)
        .filter(QuestionBank.id == bank_id, QuestionBank.organization_id == organization_id, QuestionBank.is_deleted == False)
        .one_or_none()
    )


def create_question_bank(db: Session, organization, payload: QuestionBankCreate) -> QuestionBank:
    bank = QuestionBank(
        title=payload.title,
        description=payload.description,
        organization_id=organization.id,
    )
    db.add(bank)
    db.commit()
    db.refresh(bank)
    return bank


def update_question_bank(db: Session, bank: QuestionBank, payload: QuestionBankCreate) -> QuestionBank:
    bank.title = payload.title
    bank.description = payload.description
    db.add(bank)
    db.commit()
    db.refresh(bank)
    return bank


def soft_delete_question_bank(db: Session, bank: QuestionBank) -> None:
    bank.is_deleted = True
    db.add(bank)
    db.commit()


def create_bank_question(db: Session, bank: QuestionBank, payload: QuizQuestionCreate) -> Question:
    _validate_question_payload(payload)
    question = _build_question_from_payload(None, payload)
    question.bank_id = bank.id
    question.organization_id = bank.organization_id
    db.add(question)
    db.commit()
    db.refresh(question)
    return question


def get_question_bank_questions(db: Session, bank_id: int, organization_id: int) -> List[Question]:
    return (
        db.query(Question)
        .filter(Question.bank_id == bank_id, Question.organization_id == organization_id, Question.is_deleted == False)
        .order_by(Question.created_at)
        .all()
    )


def get_quiz_questions(db: Session, quiz_id: int, organization_id: int) -> List[Question]:
    return (
        db.query(Question)
        .filter(Question.quiz_id == quiz_id, Question.organization_id == organization_id, Question.is_deleted == False)
        .order_by(Question.created_at)
        .all()
    )


def get_question_by_id(db: Session, question_id: int, organization_id: int) -> Question | None:
    return (
        db.query(Question)
        .filter(Question.id == question_id, Question.organization_id == organization_id, Question.is_deleted == False)
        .one_or_none()
    )


def update_question(db: Session, question: Question, payload: QuizQuestionUpdate) -> Question:
    original_points = question.points

    _validate_question_payload(payload)
    for field in payload.__fields_set__:
        value = getattr(payload, field)
        if value is not None:
            setattr(question, field, value)

    if question.quiz is not None:
        question.quiz.total_points += question.points - original_points

    db.add(question)
    db.commit()
    db.refresh(question)
    return question


def delete_question(db: Session, question: Question) -> None:
    question.is_deleted = True
    if question.quiz is not None:
        question.quiz.total_points = max(0, question.quiz.total_points - question.points)

    db.add(question)
    db.commit()


def get_user_quiz_attempts(db: Session, quiz_id: int, user_id: int, organization_id: int) -> List[QuizAttempt]:
    return (
        db.query(QuizAttempt)
        .filter(
            QuizAttempt.quiz_id == quiz_id,
            QuizAttempt.user_id == user_id,
            QuizAttempt.organization_id == organization_id,
            QuizAttempt.is_deleted == False,
        )
        .order_by(QuizAttempt.started_at.desc())
        .all()
    )


def get_user_all_quiz_attempts(db: Session, user_id: int, organization_id: int, limit: int = 50, offset: int = 0) -> list[dict[str, Any]]:
    attempts = (
        db.query(QuizAttempt, Quiz)
        .join(Quiz, QuizAttempt.quiz_id == Quiz.id)
        .filter(
            QuizAttempt.user_id == user_id,
            QuizAttempt.organization_id == organization_id,
            QuizAttempt.is_deleted == False,
            Quiz.is_deleted == False,
        )
        .order_by(QuizAttempt.completed_at.desc().nullsfirst(), QuizAttempt.started_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    return [
        serialize_quiz_attempt(attempt, quiz=quiz)
        for attempt, quiz in attempts
    ]


def get_quiz_results(db: Session, organization_id: int, limit: int = 50, offset: int = 0) -> list[dict[str, Any]]:
    attempts = (
        db.query(QuizAttempt, Quiz, User, Course)
        .join(Quiz, QuizAttempt.quiz_id == Quiz.id)
        .join(Course, Quiz.course_id == Course.id)
        .join(User, QuizAttempt.user_id == User.id)
        .filter(
            QuizAttempt.organization_id == organization_id,
            QuizAttempt.is_deleted == False,
            Quiz.is_deleted == False,
            Course.is_deleted == False,
            User.is_deleted == False,
        )
        .order_by(QuizAttempt.completed_at.desc().nullsfirst(), QuizAttempt.started_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    return [
        serialize_quiz_attempt(attempt, quiz=quiz, user=user)
        for attempt, quiz, user, course in attempts
    ]


def get_quiz_attempt_by_id(db: Session, attempt_id: int, user_id: int, organization_id: int) -> QuizAttempt | None:
    return (
        db.query(QuizAttempt)
        .filter(
            QuizAttempt.id == attempt_id,
            QuizAttempt.user_id == user_id,
            QuizAttempt.organization_id == organization_id,
            QuizAttempt.is_deleted == False,
        )
        .one_or_none()
    )


def get_attempt_for_review(db: Session, attempt_id: int, organization_id: int) -> QuizAttempt | None:
    return (
        db.query(QuizAttempt)
        .filter(
            QuizAttempt.id == attempt_id,
            QuizAttempt.organization_id == organization_id,
            QuizAttempt.is_deleted == False,
        )
        .one_or_none()
    )


def get_quiz_attempt_count(db: Session, quiz_id: int, user_id: int, organization_id: int) -> int:
    return (
        db.query(func.count(QuizAttempt.id))
        .filter(
            QuizAttempt.quiz_id == quiz_id,
            QuizAttempt.user_id == user_id,
            QuizAttempt.organization_id == organization_id,
            QuizAttempt.is_deleted == False,
        )
        .scalar()
    ) or 0


def start_quiz_attempt(db: Session, quiz: Quiz, user: User) -> QuizAttempt:
    if quiz.max_attempts > 0:
        submitted_attempts = (
            db.query(func.count(QuizAttempt.id))
            .filter(
                QuizAttempt.quiz_id == quiz.id,
                QuizAttempt.user_id == user.id,
                QuizAttempt.organization_id == quiz.organization_id,
                QuizAttempt.is_deleted == False,
                QuizAttempt.status.in_(["submitted", "graded", "pending_review", "expired"]),
            )
            .scalar()
        ) or 0
        if submitted_attempts >= quiz.max_attempts:
            raise ValueError("Maximum number of quiz attempts reached.")

    questions = [question for question in quiz.questions if not question.is_deleted]
    if not questions:
        raise ValueError("Quiz has no questions.")

    if quiz.randomize_questions and quiz.question_count > 0 and quiz.question_count < len(questions):
        selected_questions = random.sample(questions, quiz.question_count)
    elif quiz.question_count > 0 and quiz.question_count < len(questions):
        selected_questions = questions[: quiz.question_count]
    else:
        selected_questions = questions

    selected_ids = [question.id for question in selected_questions]
    attempt_number = get_quiz_attempt_count(db, quiz.id, user.id, quiz.organization_id) + 1

    attempt = QuizAttempt(
        quiz_id=quiz.id,
        user_id=user.id,
        organization_id=quiz.organization_id,
        score=0.0,
        answers=[],
        question_ids=selected_ids,
        attempt_number=attempt_number,
        status="in_progress",
        passed=False,
        auto_graded=False,
    )
    db.add(attempt)
    db.commit()
    db.refresh(attempt)
    return attempt


def _is_missing_answer(question: Question, answer: Any) -> bool:
    if answer is None:
        return True
    if isinstance(answer, str) and answer.strip() == "":
        return True
    if question.question_type == QuestionType.multiple_select:
        return not isinstance(answer, list) or len(answer) == 0
    if question.question_type == QuestionType.file_upload:
        return not isinstance(answer, dict) or answer.get("filename") in (None, "")
    return False


def submit_quiz_attempt(db: Session, quiz: Quiz, attempt: QuizAttempt, answers: list[dict[str, Any]]) -> QuizAttempt:
    if attempt.status not in {"in_progress", "pending_review"}:
        raise ValueError("Quiz attempt cannot be submitted.")

    timed_out = False
    if quiz.time_limit_minutes > 0:
        expiration = attempt.started_at + timedelta(minutes=quiz.time_limit_minutes)
        timed_out = _utc_now() > expiration

    selected_ids = attempt.question_ids or [question.id for question in quiz.questions if not question.is_deleted]
    questions = (
        db.query(Question)
        .filter(Question.id.in_(selected_ids), Question.organization_id == quiz.organization_id, Question.is_deleted == False)
        .all()
    )
    answers_by_question = {item["question_id"]: item.get("answer") for item in answers}

    missing_questions = [
        question.id
        for question in questions
        if question.id not in answers_by_question or _is_missing_answer(question, answers_by_question.get(question.id))
    ]
    if missing_questions:
        raise ValueError("Please answer all quiz questions before submitting.")

    score = 0.0
    manual_needed = False
    graded_answers: list[dict[str, Any]] = []

    for question in questions:
        raw_answer = answers_by_question.get(question.id)
        question_score, auto_graded, is_correct = _score_question(question, raw_answer)
        score += question_score
        if not quiz.auto_grade_enabled or not auto_graded:
            manual_needed = True
            is_correct = None
        graded_answers.append(
            {
                "question_id": question.id,
                "question_text": question.text,
                "question_type": question.question_type.value if hasattr(question.question_type, "value") else question.question_type,
                "choices": question.choices,
                "student_answer": raw_answer,
                "correct_answer": question.correct_answer,
                "is_correct": is_correct,
                "points_awarded": question_score,
                "points_possible": question.points,
            }
        )

    threshold = quiz.passing_score
    if quiz.pass_percentage > 0 and quiz.total_points > 0:
        threshold = max(threshold, round(quiz.total_points * quiz.pass_percentage / 100))

    passed = score >= threshold if not manual_needed else False
    status = "pending_review" if manual_needed else "graded"
    if timed_out and not manual_needed:
        status = "submitted"

    attempt.score = score
    attempt.answers = graded_answers
    attempt.completed_at = _utc_now()
    attempt.passed = passed
    attempt.auto_graded = not manual_needed
    attempt.status = status

    db.add(attempt)
    db.commit()
    db.refresh(attempt)

    if attempt.passed:
        user = getattr(attempt, "user", None) or db.get(User, attempt.user_id)
        if user:
            gamification_service.update_user_points(db, user, float(attempt.score))
            gamification_service.trigger_gamification_event(
                db,
                user,
                "quiz_passed",
                {
                    "quiz_id": quiz.id,
                    "score": float(attempt.score),
                    "total_points": quiz.total_points,
                },
            )

    course_service.update_course_progress(db, attempt.user_id, quiz.course_id, quiz.organization_id)
    return attempt


def grade_quiz_attempt(db: Session, attempt: QuizAttempt, payload: QuizAttemptGrade) -> QuizAttempt:
    previously_passed = attempt.passed
    attempt.score = payload.score
    if payload.passed is not None:
        attempt.passed = payload.passed
    if payload.status:
        attempt.status = payload.status
    else:
        attempt.status = "graded"

    db.add(attempt)
    db.commit()
    db.refresh(attempt)

    if attempt.passed and not previously_passed:
        user = getattr(attempt, "user", None) or db.get(User, attempt.user_id)
        if user:
            gamification_service.update_user_points(db, user, float(attempt.score))
            gamification_service.trigger_gamification_event(
                db,
                user,
                "quiz_passed",
                {
                    "quiz_id": attempt.quiz_id,
                    "score": float(attempt.score),
                    "total_points": attempt.quiz.total_points if getattr(attempt, "quiz", None) else None,
                },
            )

    return attempt


def get_quiz_analytics(db: Session, quiz: Quiz) -> dict[str, Any]:
    attempts = (
        db.query(QuizAttempt)
        .filter(QuizAttempt.quiz_id == quiz.id, QuizAttempt.organization_id == quiz.organization_id, QuizAttempt.is_deleted == False)
        .all()
    )
    total_attempts = len(attempts)
    average_score = sum(attempt.score for attempt in attempts) / total_attempts if total_attempts else 0.0
    pass_rate = sum(1 for attempt in attempts if attempt.passed) / total_attempts * 100 if total_attempts else 0.0
    average_time_minutes = 0.0
    if total_attempts:
        durations = [
            ((attempt.completed_at or _utc_now()) - attempt.started_at).total_seconds() / 60
            for attempt in attempts
        ]
        average_time_minutes = sum(durations) / total_attempts

    question_ids = [question.id for question in quiz.questions if not question.is_deleted]
    question_summary = []
    for question_id in question_ids:
        answered = 0
        correct = 0
        total_score = 0.0
        for attempt in attempts:
            if not attempt.answers:
                continue
            for answer in attempt.answers:
                if answer.get("question_id") != question_id:
                    continue
                answered += 1
                question = next((q for q in quiz.questions if q.id == question_id), None)
                if not question:
                    continue
                submitted_answer = answer.get("student_answer", answer.get("answer"))
                question_score, auto_graded, _ = _score_question(question, submitted_answer)
                total_score += question_score
                if question_score >= question.points:
                    correct += 1
        correct_percentage = (correct / answered * 100) if answered else 0.0
        average_question_score = (total_score / answered) if answered else 0.0
        question_summary.append(
            {
                "question_id": question_id,
                "times_answered": answered,
                "correct_percentage": correct_percentage,
                "average_score": average_question_score,
            }
        )

    return {
        "quiz_id": quiz.id,
        "total_attempts": total_attempts,
        "average_score": average_score,
        "pass_rate": pass_rate,
        "average_time_minutes": average_time_minutes,
        "question_summary": question_summary,
    }


def _build_question_from_payload(quiz_id: int | None, payload: QuizQuestionCreate) -> Question:
    return Question(
        quiz_id=quiz_id,
        text=payload.text,
        question_type=payload.question_type,
        choices=payload.choices,
        correct_answer=payload.correct_answer,
        points=payload.points,
    )


def _validate_question_payload(payload: QuizQuestionCreate | QuizQuestionUpdate) -> None:
    question_type = payload.question_type
    choices = payload.choices or []
    correct_answer = payload.correct_answer

    if question_type in {QuestionType.multiple_choice, QuestionType.multiple_select} and not choices:
        raise ValueError("Multiple choice and multiple select questions require choices.")
    if question_type == QuestionType.multiple_choice:
        if correct_answer in (None, ""):
            raise ValueError("Multiple choice questions require a correct answer.")
        if correct_answer not in choices:
            raise ValueError("Correct answer must match one of the choices.")
    if question_type == QuestionType.multiple_select:
        if not isinstance(correct_answer, list) or not correct_answer:
            raise ValueError("Multiple select questions require at least one correct answer.")
        invalid_answers = [item for item in correct_answer if item not in choices]
        if invalid_answers:
            raise ValueError("All correct answers must match the provided choices.")
    if question_type == QuestionType.true_false and correct_answer is None:
        raise ValueError("True/False questions require a correct answer.")


def _score_question(question: Question, answer: Any) -> tuple[float, bool, bool | None]:
    if question.question_type == QuestionType.multiple_choice:
        correct = question.correct_answer
        is_correct = answer == correct
        return (question.points if is_correct else 0.0, True, is_correct)
    if question.question_type == QuestionType.multiple_select:
        correct = set(question.correct_answer or [])
        submitted = set(answer or []) if answer is not None else set()
        is_correct = submitted == correct
        return (question.points if is_correct else 0.0, True, is_correct)
    if question.question_type == QuestionType.true_false:
        is_correct = answer == question.correct_answer
        return (question.points if is_correct else 0.0, True, is_correct)
    if question.question_type == QuestionType.short_answer:
        if answer is None or question.correct_answer is None:
            return 0.0, False, None
        is_correct = str(answer).strip().lower() == str(question.correct_answer).strip().lower()
        return (
            question.points if is_correct else 0.0,
            True,
            is_correct,
        )
    if question.question_type == QuestionType.coding_question:
        if answer is None or question.correct_answer is None:
            return 0.0, False, None
        is_correct = str(answer).strip() == str(question.correct_answer).strip()
        return (
            question.points if is_correct else 0.0,
            True,
            is_correct,
        )
    return 0.0, False, None
