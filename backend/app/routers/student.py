from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import schemas
from app.dependencies import get_current_active_user, get_db, get_tenant
from app.models import User, QuizAttempt, AssignmentSubmission, Quiz, Assignment, Enrollment, LessonCompletion, Lesson, Announcement
from app.services import courses as course_service
from app.services import auth as auth_service
from app.services import enrollment as enrollment_service

router = APIRouter()


@router.get("/course/{course_id}/scores", response_model=schemas.StudentCourseScoresRead)
def get_student_course_scores(
    course_id: int,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    course = course_service.get_course_by_id(db, course_id, organization.id)
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found.")

    # Check if user is enrolled
    enrollment = enrollment_service.get_user_enrollment(db, current_user.id, course_id, organization.id)
    if not enrollment:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not enrolled in this course.")

    # Get quizzes for the course
    quizzes = db.query(Quiz).filter(
        Quiz.course_id == course_id,
        Quiz.organization_id == organization.id,
        Quiz.is_deleted == False,
        Quiz.published == True
    ).all()

    # Get student's quiz attempts
    quiz_attempts = {}
    for quiz in quizzes:
        attempts = db.query(QuizAttempt).filter(
            QuizAttempt.quiz_id == quiz.id,
            QuizAttempt.user_id == current_user.id,
            QuizAttempt.organization_id == organization.id,
            QuizAttempt.status.in_(["graded", "submitted", "pending_review"])
        ).order_by(QuizAttempt.completed_at.desc()).first()
        if attempts:
            quiz_attempts[quiz.id] = attempts

    # Get assignments for the course
    assignments = db.query(Assignment).filter(
        Assignment.course_id == course_id,
        Assignment.organization_id == organization.id,
        Assignment.is_deleted == False
    ).all()

    # Get student's assignment submissions
    assignment_submissions = {}
    for assignment in assignments:
        submission = db.query(AssignmentSubmission).filter(
            AssignmentSubmission.assignment_id == assignment.id,
            AssignmentSubmission.user_id == current_user.id,
            AssignmentSubmission.organization_id == organization.id
        ).first()
        if submission:
            assignment_submissions[assignment.id] = submission

    # Build response
    quizzes_response = []
    for quiz in quizzes:
        attempt = quiz_attempts.get(quiz.id)
        score = attempt.score if attempt else None
        quizzes_response.append({
            "title": quiz.title,
            "score": score,
            "total": quiz.total_points
        })

    assignments_response = []
    for assignment in assignments:
        submission = assignment_submissions.get(assignment.id)
        submission_reviewed = False
        if submission:
            submission_reviewed = bool(submission.reviewed)
            if not submission_reviewed:
                status_value = submission.status.value if hasattr(submission.status, "value") else submission.status
                submission_reviewed = status_value == "graded"

        grade = submission.grade if submission and submission_reviewed else None
        submission_status = 'graded' if submission and submission_reviewed else 'pending'
        assignments_response.append({
            "title": assignment.title,
            "score": grade,
            "total": assignment.max_score,
            "reviewed": submission_reviewed,
            "feedback": submission.feedback if submission else None,
            "status": submission_status
        })

    return {
        "quizzes": quizzes_response,
        "assignments": assignments_response
    }


@router.get("/weekly-stats", response_model=schemas.WeeklyStatsRead)
def get_student_weekly_stats(
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    from datetime import datetime, timedelta, timezone
    from sqlalchemy import func

    # Calculate date range for the past week
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)

    # Courses enrolled this week
    courses_enrolled = db.query(func.count()).select_from(Enrollment).filter(
        Enrollment.user_id == current_user.id,
        Enrollment.organization_id == organization.id,
        Enrollment.enrolled_at >= week_ago
    ).scalar()

    # Courses completed this week
    courses_completed = db.query(func.count()).select_from(Enrollment).filter(
        Enrollment.user_id == current_user.id,
        Enrollment.organization_id == organization.id,
        Enrollment.completed_at >= week_ago,
        Enrollment.completed_at.isnot(None)
    ).scalar()

    # Quizzes attempted this week
    quizzes_attempted = db.query(func.count()).select_from(QuizAttempt).filter(
        QuizAttempt.user_id == current_user.id,
        QuizAttempt.organization_id == organization.id,
        QuizAttempt.started_at >= week_ago
    ).scalar()

    # Assignments submitted this week
    assignments_submitted = db.query(func.count()).select_from(AssignmentSubmission).filter(
        AssignmentSubmission.user_id == current_user.id,
        AssignmentSubmission.organization_id == organization.id,
        AssignmentSubmission.submitted_at >= week_ago
    ).scalar()

    # Lessons completed this week (using LessonCompletion)
    lessons_completed = db.query(func.count()).select_from(LessonCompletion).filter(
        LessonCompletion.user_id == current_user.id,
        LessonCompletion.organization_id == organization.id,
        LessonCompletion.completed_at >= week_ago,
        LessonCompletion.is_completed == True
    ).scalar()

    # Calculate total study time from lessons completed this week
    # Sum the duration_minutes of all lessons marked as completed in the past week
    study_time_result = db.query(func.sum(Lesson.duration_minutes)).join(
        LessonCompletion, Lesson.id == LessonCompletion.lesson_id
    ).filter(
        LessonCompletion.user_id == current_user.id,
        LessonCompletion.organization_id == organization.id,
        LessonCompletion.completed_at >= week_ago,
        LessonCompletion.is_completed == True
    ).scalar()

    total_study_time_minutes = int(study_time_result) if study_time_result else 0

    # Average score from quiz attempts this week
    avg_score_result = db.query(func.avg(QuizAttempt.score)).filter(
        QuizAttempt.user_id == current_user.id,
        QuizAttempt.organization_id == organization.id,
        QuizAttempt.started_at >= week_ago,
        QuizAttempt.score.isnot(None)
    ).scalar()

    average_score = float(avg_score_result) if avg_score_result else None

    # Streak days (simplified - would need proper streak tracking)
    streak_days = 0  # Placeholder

    return {
        "courses_enrolled": courses_enrolled or 0,
        "courses_completed": courses_completed or 0,
        "quizzes_attempted": quizzes_attempted or 0,
        "assignments_submitted": assignments_submitted or 0,
        "lessons_completed": lessons_completed or 0,
        "total_study_time_minutes": total_study_time_minutes,
        "average_score": average_score,
        "streak_days": streak_days
    }


@router.get("/course/{course_id}", response_model=schemas.StudentCourseDashboardRead)
def get_student_course_dashboard(
    course_id: int,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    course = course_service.get_course_by_id(db, course_id, organization.id)
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found.")

    # Check if user is enrolled
    enrollment = enrollment_service.get_user_enrollment(db, current_user.id, course_id, organization.id)
    if not enrollment:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not enrolled in this course.")

    # Fetch lessons
    lessons = db.query(Lesson).filter(
        Lesson.course_id == course_id,
        Lesson.organization_id == organization.id,
        Lesson.is_deleted == False
    ).order_by(Lesson.position).all()

    # Fetch assignments
    assignments = db.query(Assignment).filter(
        Assignment.course_id == course_id,
        Assignment.organization_id == organization.id,
        Assignment.is_deleted == False
    ).all()

    # Fetch quizzes
    quizzes = db.query(Quiz).filter(
        Quiz.course_id == course_id,
        Quiz.organization_id == organization.id,
        Quiz.is_deleted == False
    ).all()

    # Fetch announcements
    announcements = db.query(Announcement).filter(
        Announcement.course_id == course_id,
        Announcement.organization_id == organization.id,
        Announcement.is_deleted == False,
        Announcement.published == True
    ).order_by(Announcement.created_at.desc()).all()

    return {
        "lessons": lessons,
        "assignments": assignments,
        "quizzes": quizzes,
        "announcements": announcements
    }


@router.get("/marks/{course_id}/{student_id}", response_model=schemas.StudentMarksRead)
def get_student_marks(
    course_id: int,
    student_id: int,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    # Only allow access to own marks or if instructor/admin
    if current_user.id != student_id and current_user.role not in ["instructor", "admin"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    course = course_service.get_course_by_id(db, course_id, organization.id)
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found.")

    # Check if student is enrolled
    enrollment = enrollment_service.get_user_enrollment(db, student_id, course_id, organization.id)
    if not enrollment:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Student is not enrolled in this course.")

    # Get quizzes for the course
    quizzes = db.query(Quiz).filter(
        Quiz.course_id == course_id,
        Quiz.organization_id == organization.id,
        Quiz.is_deleted == False,
        Quiz.published == True
    ).all()

    # Get student's quiz attempts
    quiz_marks = []
    for quiz in quizzes:
        attempts = db.query(QuizAttempt).filter(
            QuizAttempt.quiz_id == quiz.id,
            QuizAttempt.user_id == student_id,
            QuizAttempt.organization_id == organization.id,
            QuizAttempt.status == "completed"
        ).order_by(QuizAttempt.completed_at.desc()).first()
        if attempts:
            quiz_marks.append({
                "title": quiz.title,
                "score": attempts.score,
                "total": quiz.total_points
            })

    # Get assignments for the course
    assignments = db.query(Assignment).filter(
        Assignment.course_id == course_id,
        Assignment.organization_id == organization.id,
        Assignment.is_deleted == False
    ).all()

    # Get student's assignment submissions
    assignment_marks = []
    for assignment in assignments:
        submission = db.query(AssignmentSubmission).filter(
            AssignmentSubmission.assignment_id == assignment.id,
            AssignmentSubmission.user_id == student_id,
            AssignmentSubmission.organization_id == organization.id
        ).first()
        if submission and submission.grade is not None:
            assignment_marks.append({
                "title": assignment.title,
                "score": submission.grade,
                "total": assignment.max_score,
                "reviewed": bool(submission.reviewed),
                "feedback": submission.feedback,
                "status": "graded"
            })

    return {
        "quizzes": quiz_marks,
        "assignments": assignment_marks
    }
