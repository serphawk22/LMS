import re
from datetime import datetime
from typing import Any, List

from fastapi import UploadFile
from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from app.models import (
    AdminComment,
    AdminCommentType,
    Assignment,
    AssignmentSubmission,
    AuthSession,
    Certificate,
    Course,
    DailyLearningVideo,
    Enrollment,
    EnrollmentStatus,
    LearningPath,
    LessonCompletion,
    Lesson,
    Notification,
    NotificationStatus,
    Organization,
    Payment,
    PaymentStatus,
    Quiz,
    QuizAttempt,
    Review,
    Role,
    User,
)

DASHBOARD_DEFAULT_LIMIT = 10


def _normalize_status(status: Any) -> str:
    if hasattr(status, "value"):
        return status.value
    return str(status)


def _serialize_course_item(
    course: Course,
    progress: float = 0.0,
    status: str = "pending",
    enrolled_at: datetime | None = None,
    completed_at: datetime | None = None,
    total_items: int = 0,
    completed_items: int = 0,
    completed_lessons: int = 0,
    completed_quizzes: int = 0,
    completed_assignments: int = 0,
) -> dict[str, Any]:
    return {
        "course_id": course.id,
        "title": course.title,
        "slug": course.slug,
        "thumbnail_url": course.thumbnail_url,
        "progress": float(progress or 0.0),
        "status": status,
        "enrolled_at": enrolled_at,
        "completed_at": completed_at,
        "is_featured": bool(course.is_featured),
        "total_items": total_items,
        "completed_items": completed_items,
        "completed_lessons": completed_lessons,
        "completed_quizzes": completed_quizzes,
        "completed_assignments": completed_assignments,
    }


def _calculate_course_progress(db: Session, course: Course, user) -> dict[str, Any]:
    total_lessons = (
        db.query(func.count(Lesson.id))
        .filter(
            Lesson.course_id == course.id,
            Lesson.organization_id == user.organization_id,
            Lesson.is_deleted == False,
        )
        .scalar()
        or 0
    )

    total_quizzes = (
        db.query(func.count(Quiz.id))
        .filter(
            Quiz.course_id == course.id,
            Quiz.organization_id == user.organization_id,
            Quiz.is_deleted == False,
            Quiz.published == True,
        )
        .scalar()
        or 0
    )

    total_assignments = (
        db.query(func.count(Assignment.id))
        .filter(
            Assignment.course_id == course.id,
            Assignment.organization_id == user.organization_id,
            Assignment.is_deleted == False,
            Assignment.published == True,
        )
        .scalar()
        or 0
    )

    completed_lessons = (
        db.query(func.count(LessonCompletion.id))
        .filter(
            LessonCompletion.course_id == course.id,
            LessonCompletion.user_id == user.id,
            LessonCompletion.organization_id == user.organization_id,
            LessonCompletion.is_deleted == False,
            LessonCompletion.is_completed == True,
        )
        .scalar()
        or 0
    )

    completed_quizzes = (
        db.query(func.count(func.distinct(QuizAttempt.quiz_id)))
        .join(Quiz, Quiz.id == QuizAttempt.quiz_id)
        .filter(
            Quiz.course_id == course.id,
            QuizAttempt.user_id == user.id,
            QuizAttempt.organization_id == user.organization_id,
            QuizAttempt.is_deleted == False,
            QuizAttempt.completed_at.isnot(None),
        )
        .scalar()
        or 0
    )

    completed_assignments = (
        db.query(func.count(func.distinct(AssignmentSubmission.assignment_id)))
        .join(Assignment, Assignment.id == AssignmentSubmission.assignment_id)
        .filter(
            Assignment.course_id == course.id,
            AssignmentSubmission.user_id == user.id,
            AssignmentSubmission.organization_id == user.organization_id,
            AssignmentSubmission.is_deleted == False,
        )
        .scalar()
        or 0
    )

    total_items = total_lessons + total_quizzes + total_assignments
    completed_items = completed_lessons + completed_quizzes + completed_assignments
    progress = float((completed_items / total_items) * 100.0) if total_items else 0.0

    return {
        "progress": progress,
        "total_items": total_items,
        "completed_items": completed_items,
        "completed_lessons": completed_lessons,
        "completed_quizzes": completed_quizzes,
        "completed_assignments": completed_assignments,
    }


def get_dashboard_enrolled_courses(db: Session, user, limit: int = DASHBOARD_DEFAULT_LIMIT) -> List[dict[str, Any]]:
    enrollments = (
        db.query(Enrollment)
        .join(Course)
        .filter(
            Enrollment.user_id == user.id,
            Enrollment.organization_id == user.organization_id,
            Enrollment.is_deleted == False,
            Course.is_deleted == False,
        )
        .order_by(Enrollment.enrolled_at.desc())
        .limit(limit)
        .all()
    )

    items: List[dict[str, Any]] = []
    for enrollment in enrollments:
        progress_data = _calculate_course_progress(db, enrollment.course, user)
        items.append(
            _serialize_course_item(
                enrollment.course,
                progress=progress_data["progress"],
                status=_normalize_status(enrollment.status),
                enrolled_at=enrollment.enrolled_at,
                completed_at=enrollment.completed_at,
                total_items=progress_data["total_items"],
                completed_items=progress_data["completed_items"],
                completed_lessons=progress_data["completed_lessons"],
                completed_quizzes=progress_data["completed_quizzes"],
                completed_assignments=progress_data["completed_assignments"],
            )
        )
    return items


def get_dashboard_continue_learning(db: Session, user, limit: int = DASHBOARD_DEFAULT_LIMIT) -> List[dict[str, Any]]:
    enrollments = (
        db.query(Enrollment)
        .join(Course)
        .filter(
            Enrollment.user_id == user.id,
            Enrollment.organization_id == user.organization_id,
            Enrollment.is_deleted == False,
            Course.is_deleted == False,
            Course.is_published == True,
        )
        .order_by(Enrollment.enrolled_at.desc())
        .all()
    )

    items: List[dict[str, Any]] = []
    for enrollment in enrollments:
        progress_data = _calculate_course_progress(db, enrollment.course, user)
        if progress_data["progress"] <= 0.0 or progress_data["progress"] >= 100.0:
            continue
        items.append(
            _serialize_course_item(
                enrollment.course,
                progress=progress_data["progress"],
                status=_normalize_status(enrollment.status),
                enrolled_at=enrollment.enrolled_at,
                completed_at=enrollment.completed_at,
                total_items=progress_data["total_items"],
                completed_items=progress_data["completed_items"],
                completed_lessons=progress_data["completed_lessons"],
                completed_quizzes=progress_data["completed_quizzes"],
                completed_assignments=progress_data["completed_assignments"],
            )
        )
    return items[:limit]


def get_dashboard_completed_courses(db: Session, user, limit: int = DASHBOARD_DEFAULT_LIMIT) -> List[dict[str, Any]]:
    enrollments = (
        db.query(Enrollment)
        .join(Course)
        .filter(
            Enrollment.user_id == user.id,
            Enrollment.organization_id == user.organization_id,
            Enrollment.is_deleted == False,
            Course.is_deleted == False,
            Course.is_published == True,
        )
        .order_by(Enrollment.completed_at.desc())
        .all()
    )

    items: List[dict[str, Any]] = []
    for enrollment in enrollments:
        progress_data = _calculate_course_progress(db, enrollment.course, user)
        if progress_data["progress"] < 100.0 and not (
            enrollment.status == EnrollmentStatus.completed
            if hasattr(enrollment.status, "__eq__")
            else _normalize_status(enrollment.status) == "completed"
        ):
            continue
        items.append(
            _serialize_course_item(
                enrollment.course,
                progress=progress_data["progress"],
                status=_normalize_status(enrollment.status),
                enrolled_at=enrollment.enrolled_at,
                completed_at=enrollment.completed_at,
                total_items=progress_data["total_items"],
                completed_items=progress_data["completed_items"],
                completed_lessons=progress_data["completed_lessons"],
                completed_quizzes=progress_data["completed_quizzes"],
                completed_assignments=progress_data["completed_assignments"],
            )
        )
    return items[:limit]


def get_dashboard_certificates(db: Session, user, limit: int = DASHBOARD_DEFAULT_LIMIT) -> List[dict[str, Any]]:
    certificates = (
        db.query(Certificate)
        .filter(
            Certificate.user_id == user.id,
            Certificate.organization_id == user.organization_id,
            Certificate.is_deleted == False,
        )
        .order_by(Certificate.issued_at.desc())
        .limit(limit)
        .all()
    )

    return [
        {
            "id": certificate.id,
            "course_id": certificate.course_id,
            "course_title": certificate.course.title if certificate.course else "",
            "issued_at": certificate.issued_at,
            "expires_at": certificate.expires_at,
            "grade": certificate.grade,
            "data": certificate.data,
        }
        for certificate in certificates
    ]


def get_dashboard_notifications(db: Session, user, limit: int = DASHBOARD_DEFAULT_LIMIT) -> List[dict[str, Any]]:
    notifications = (
        db.query(Notification)
        .filter(
            Notification.user_id == user.id,
            Notification.organization_id == user.organization_id,
            Notification.is_deleted == False,
        )
        .order_by(Notification.created_at.desc())
        .limit(limit)
        .all()
    )

    return [
        {
            "id": notification.id,
            "title": notification.title,
            "message": notification.message,
            "status": notification.status.value if hasattr(notification.status, "value") else str(notification.status),
            "channel": notification.channel,
            "created_at": notification.created_at,
        }
        for notification in notifications
    ]


def list_user_notifications(db: Session, user, limit: int = DASHBOARD_DEFAULT_LIMIT) -> List[dict[str, Any]]:
    return get_dashboard_notifications(db, user, limit)


def mark_notification_as_read(db: Session, user, notification_id: int) -> dict[str, Any]:
    notification = (
        db.query(Notification)
        .filter(
            Notification.id == notification_id,
            Notification.user_id == user.id,
            Notification.organization_id == user.organization_id,
            Notification.is_deleted == False,
        )
        .one_or_none()
    )
    if not notification:
        raise ValueError("Notification not found.")

    if notification.status != NotificationStatus.read:
        notification.status = NotificationStatus.read
        db.add(notification)
        db.commit()
        db.refresh(notification)

    return {
        "id": notification.id,
        "title": notification.title,
        "message": notification.message,
        "status": notification.status.value if hasattr(notification.status, "value") else str(notification.status),
        "channel": notification.channel,
        "created_at": notification.created_at,
    }


def create_notification(db: Session, user, title: str, message: str | None = None, channel: str = "in_app") -> Notification:
    notification = Notification(
        organization_id=user.organization_id,
        user_id=user.id,
        title=title,
        message=message,
        channel=channel,
    )
    db.add(notification)
    db.commit()
    db.refresh(notification)
    return notification


def create_notifications_for_users(
    db: Session,
    user_ids: list[int],
    organization_id: int,
    title: str,
    message: str | None = None,
    channel: str = "in_app",
) -> None:
    notifications = [
        Notification(
            organization_id=organization_id,
            user_id=user_id,
            title=title,
            message=message,
            channel=channel,
        )
        for user_id in set(user_ids)
    ]
    if notifications:
        db.add_all(notifications)
        db.commit()


def create_notifications_for_announcement(
    db: Session,
    announcement,
    organization_id: int,
    title: str,
    message: str | None = None,
    channel: str = "in_app",
) -> None:
    if announcement.course_id:
        user_ids = [
            enrollment.user_id
            for enrollment in db.query(Enrollment)
            .filter(
                Enrollment.course_id == announcement.course_id,
                Enrollment.organization_id == organization_id,
                Enrollment.is_deleted == False,
            )
            .all()
        ]
    else:
        user_ids = [
            user.id
            for user in db.query(User)
            .filter(
                User.organization_id == organization_id,
                User.is_deleted == False,
            )
            .all()
        ]

    if user_ids:
        create_notifications_for_users(db, user_ids, organization_id, title, message, channel)


def get_dashboard_recommended_courses(db: Session, user, limit: int = DASHBOARD_DEFAULT_LIMIT) -> List[dict[str, Any]]:
    enrolled_course_ids = (
        db.query(Enrollment.course_id)
        .filter(
            Enrollment.user_id == user.id,
            Enrollment.organization_id == user.organization_id,
            Enrollment.is_deleted == False,
        )
        .distinct()
        .all()
    )
    enrolled_ids = [course_id for (course_id,) in enrolled_course_ids]

    recommended_query = db.query(Course).filter(
        Course.organization_id == user.organization_id,
        Course.is_deleted == False,
        Course.is_published == True,
    )
    if enrolled_ids:
        recommended_query = recommended_query.filter(~Course.id.in_(enrolled_ids))

    recommended = (
        recommended_query
        .order_by(Course.is_featured.desc(), Course.created_at.desc())
        .limit(limit)
        .all()
    )

    return [
        _serialize_course_item(course, progress=0.0, status="recommended")
        for course in recommended
    ]


def get_dashboard_recent_activity(db: Session, user, limit: int = DASHBOARD_DEFAULT_LIMIT) -> List[dict[str, Any]]:
    completions = (
        db.query(LessonCompletion)
        .filter(
            LessonCompletion.user_id == user.id,
            LessonCompletion.organization_id == user.organization_id,
            LessonCompletion.is_deleted == False,
        )
        .order_by(desc(LessonCompletion.completed_at))
        .limit(limit)
        .all()
    )

    certificates = (
        db.query(Certificate)
        .filter(
            Certificate.user_id == user.id,
            Certificate.organization_id == user.organization_id,
            Certificate.is_deleted == False,
        )
        .order_by(desc(Certificate.issued_at))
        .limit(limit)
        .all()
    )

    enrollments = (
        db.query(Enrollment)
        .filter(
            Enrollment.user_id == user.id,
            Enrollment.organization_id == user.organization_id,
            Enrollment.is_deleted == False,
        )
        .order_by(desc(Enrollment.enrolled_at))
        .limit(limit)
        .all()
    )

    activities: List[dict[str, Any]] = []

    for completion in completions:
        activities.append(
            {
                "id": completion.id,
                "activity_type": "lesson_completed",
                "course_id": completion.course_id,
                "course_title": completion.course.title if completion.course else "",
                "description": f"Completed lesson {completion.lesson.title}" if completion.lesson else "Completed a lesson",
                "created_at": completion.completed_at or completion.created_at,
            }
        )

    for certificate in certificates:
        activities.append(
            {
                "id": certificate.id,
                "activity_type": "certificate_issued",
                "course_id": certificate.course_id,
                "course_title": certificate.course.title if certificate.course else "",
                "description": f"Issued certificate for {certificate.course.title}" if certificate.course else "Received a certificate",
                "created_at": certificate.issued_at,
            }
        )

    for enrollment in enrollments:
        activities.append(
            {
                "id": enrollment.id,
                "activity_type": "course_enrolled",
                "course_id": enrollment.course_id,
                "course_title": enrollment.course.title if enrollment.course else "",
                "description": f"Enrolled in {enrollment.course.title}" if enrollment.course else "Enrolled in a course",
                "created_at": enrollment.enrolled_at,
            }
        )

    activities.sort(key=lambda item: item["created_at"] or datetime.min, reverse=True)
    return activities[:limit]


def get_dashboard_learning_path_progress(db: Session, user, limit: int = DASHBOARD_DEFAULT_LIMIT) -> List[dict[str, Any]]:
    learning_paths = (
        db.query(LearningPath)
        .filter(
            LearningPath.organization_id == user.organization_id,
            LearningPath.is_deleted == False,
        )
        .order_by(LearningPath.created_at.desc())
        .all()
    )

    enrollments = (
        db.query(Enrollment)
        .filter(
            Enrollment.user_id == user.id,
            Enrollment.organization_id == user.organization_id,
            Enrollment.is_deleted == False,
        )
        .all()
    )
    enrollment_by_course = {enrollment.course_id: enrollment for enrollment in enrollments}

    progress_items: List[dict[str, Any]] = []
    for path in learning_paths:
        courses = [course for course in path.courses if not course.is_deleted]
        total_courses = len(courses)
        if total_courses == 0:
            continue

        completed_courses = 0
        enrolled_courses = 0
        for course in courses:
            enrollment = enrollment_by_course.get(course.id)
            if enrollment:
                enrolled_courses += 1
                course_progress = _calculate_course_progress(db, course, user)["progress"]
                if course_progress >= 100.0 or enrollment.completed_at or _normalize_status(enrollment.status) == EnrollmentStatus.completed.value:
                    completed_courses += 1

        progress_items.append(
            {
                "learning_path_id": path.id,
                "title": path.title,
                "slug": path.slug,
                "description": path.description,
                "completed_courses": completed_courses,
                "total_courses": total_courses,
                "enrolled_courses": enrolled_courses,
                "progress": float((completed_courses / total_courses) * 100.0),
            }
        )

    return progress_items[:limit]


def _get_instructor_course(db: Session, course_id: int, user) -> Course:
    course = (
        db.query(Course)
        .filter(
            Course.id == course_id,
            Course.organization_id == user.organization_id,
            Course.is_deleted == False,
            ((Course.owner_id == user.id) | Course.instructors.any(User.id == user.id)),
        )
        .one_or_none()
    )
    if not course:
        raise ValueError("Course not found or access denied.")
    return course


def _get_organization_course(db: Session, course_id: int, user) -> Course:
    course = (
        db.query(Course)
        .filter(
            Course.id == course_id,
            Course.organization_id == user.organization_id,
            Course.is_deleted == False,
        )
        .one_or_none()
    )
    if not course:
        raise ValueError("Course not found or access denied.")
    return course


def get_admin_course_analytics(db: Session, course_id: int, user) -> dict[str, Any]:
    course = _get_organization_course(db, course_id, user)

    total_students = db.query(func.count(Enrollment.id)).filter(
        Enrollment.course_id == course.id,
        Enrollment.organization_id == user.organization_id,
        Enrollment.is_deleted == False,
    ).scalar() or 0

    completed_students = db.query(func.count(Enrollment.id)).filter(
        Enrollment.course_id == course.id,
        Enrollment.organization_id == user.organization_id,
        Enrollment.is_deleted == False,
        Enrollment.status == EnrollmentStatus.completed,
    ).scalar() or 0

    active_students = db.query(func.count(Enrollment.id)).filter(
        Enrollment.course_id == course.id,
        Enrollment.organization_id == user.organization_id,
        Enrollment.is_deleted == False,
        Enrollment.status == EnrollmentStatus.active,
    ).scalar() or 0

    average_progress = db.query(func.avg(Enrollment.progress)).filter(
        Enrollment.course_id == course.id,
        Enrollment.organization_id == user.organization_id,
        Enrollment.is_deleted == False,
    ).scalar() or 0.0

    total_lessons = db.query(func.count(Lesson.id)).filter(
        Lesson.course_id == course.id,
        Lesson.organization_id == user.organization_id,
        Lesson.is_deleted == False,
    ).scalar() or 0

    completed_lessons = db.query(func.count(LessonCompletion.id)).filter(
        LessonCompletion.course_id == course.id,
        LessonCompletion.organization_id == user.organization_id,
        LessonCompletion.is_deleted == False,
        LessonCompletion.is_completed == True,
    ).scalar() or 0

    rating_breakdown = dict(
        db.query(Review.rating, func.count(Review.id))
        .filter(
            Review.course_id == course.id,
            Review.organization_id == user.organization_id,
            Review.is_deleted == False,
        )
        .group_by(Review.rating)
        .all()
    )

    lesson_completion_rate = float((completed_lessons / total_lessons) * 100.0) if total_lessons else 0.0

    return {
        "course_id": course.id,
        "total_students": total_students,
        "active_students": active_students,
        "completed_students": completed_students,
        "average_progress": float(average_progress),
        "total_lessons": total_lessons,
        "completed_lessons": completed_lessons,
        "lesson_completion_rate": lesson_completion_rate,
        "average_rating": float(course.average_rating or 0.0),
        "review_count": int(course.review_count or 0),
        "rating_breakdown": {str(int(rating)): count for rating, count in rating_breakdown.items()},
        "quiz_performance": get_course_quiz_performance(db, course, user),
    }


def get_instructor_courses(db: Session, user) -> List[dict[str, Any]]:
    courses = (
        db.query(Course)
        .filter(
            Course.organization_id == user.organization_id,
            Course.is_deleted == False,
            ((Course.owner_id == user.id) | Course.instructors.any(User.id == user.id)),
        )
        .order_by(Course.created_at.desc())
        .all()
    )

    return [
        {
            "course_id": course.id,
            "title": course.title,
            "slug": course.slug,
            "thumbnail_url": course.thumbnail_url,
            "is_published": course.is_published,
            "is_featured": bool(course.is_featured),
            "owner_id": course.owner_id,
            "instructor_count": len(course.instructors or []),
        }
        for course in courses
    ]


def get_course_enrolled_students(db: Session, course_id: int, user) -> List[dict[str, Any]]:
    course = _get_instructor_course(db, course_id, user)

    enrollments = (
        db.query(Enrollment)
        .join(User)
        .filter(
            Enrollment.course_id == course.id,
            Enrollment.organization_id == user.organization_id,
            Enrollment.is_deleted == False,
            User.is_deleted == False,
        )
        .order_by(Enrollment.enrolled_at.desc())
        .all()
    )

    return [
        {
            "user_id": enrollment.user_id,
            "full_name": enrollment.user.full_name if enrollment.user else None,
            "email": enrollment.user.email if enrollment.user else None,
            "progress": float(enrollment.progress or 0.0),
            "status": _normalize_status(enrollment.status),
            "enrolled_at": enrollment.enrolled_at,
            "completed_at": enrollment.completed_at,
        }
        for enrollment in enrollments
    ]


def get_course_student_progress(db: Session, course_id: int, user) -> List[dict[str, Any]]:
    course = _get_instructor_course(db, course_id, user)

    completion_counts = dict(
        db.query(LessonCompletion.user_id, func.count(LessonCompletion.id))
        .filter(
            LessonCompletion.course_id == course.id,
            LessonCompletion.organization_id == user.organization_id,
            LessonCompletion.is_deleted == False,
            LessonCompletion.is_completed == True,
        )
        .group_by(LessonCompletion.user_id)
        .all()
    )

    enrollments = (
        db.query(Enrollment)
        .join(User)
        .filter(
            Enrollment.course_id == course.id,
            Enrollment.organization_id == user.organization_id,
            Enrollment.is_deleted == False,
            User.is_deleted == False,
        )
        .order_by(Enrollment.enrolled_at.desc())
        .all()
    )

    return [
        {
            "user_id": enrollment.user_id,
            "full_name": enrollment.user.full_name if enrollment.user else None,
            "email": enrollment.user.email if enrollment.user else None,
            "progress": float(_calculate_course_progress(db, enrollment.course, enrollment.user)["progress"] if enrollment.course and enrollment.user else float(enrollment.progress or 0.0)),
            "status": _normalize_status(enrollment.status),
            "completed_lessons": completion_counts.get(enrollment.user_id, 0),
            "enrolled_at": enrollment.enrolled_at,
            "completed_at": enrollment.completed_at,
        }
        for enrollment in enrollments
    ]


def get_course_quiz_performance(db: Session, course: Course, user) -> List[dict[str, Any]]:
    quizzes = (
        db.query(Quiz)
        .filter(
            Quiz.course_id == course.id,
            Quiz.organization_id == user.organization_id,
            Quiz.is_deleted == False,
        )
        .order_by(Quiz.created_at.desc())
        .all()
    )

    performance: List[dict[str, Any]] = []
    for quiz in quizzes:
        attempts = (
            db.query(QuizAttempt)
            .filter(
                QuizAttempt.quiz_id == quiz.id,
                QuizAttempt.organization_id == user.organization_id,
                QuizAttempt.is_deleted == False,
            )
            .all()
        )
        total_attempts = len(attempts)
        average_score = (
            sum((attempt.score or 0.0) for attempt in attempts) / total_attempts
            if total_attempts
            else 0.0
        )
        pass_rate = (
            sum(1 for attempt in attempts if attempt.passed) / total_attempts * 100.0
            if total_attempts
            else 0.0
        )
        performance.append(
            {
                "quiz_id": quiz.id,
                "title": quiz.title,
                "total_attempts": total_attempts,
                "average_score": float(average_score),
                "pass_rate": float(pass_rate),
            }
        )

    return performance


def get_course_analytics(db: Session, course_id: int, user) -> dict[str, Any]:
    course = _get_instructor_course(db, course_id, user)

    total_students = db.query(func.count(Enrollment.id)).filter(
        Enrollment.course_id == course.id,
        Enrollment.organization_id == user.organization_id,
        Enrollment.is_deleted == False,
    ).scalar() or 0

    completed_students = db.query(func.count(Enrollment.id)).filter(
        Enrollment.course_id == course.id,
        Enrollment.organization_id == user.organization_id,
        Enrollment.is_deleted == False,
        Enrollment.status == EnrollmentStatus.completed,
    ).scalar() or 0

    active_students = db.query(func.count(Enrollment.id)).filter(
        Enrollment.course_id == course.id,
        Enrollment.organization_id == user.organization_id,
        Enrollment.is_deleted == False,
        Enrollment.status == EnrollmentStatus.active,
    ).scalar() or 0

    average_progress = db.query(func.avg(Enrollment.progress)).filter(
        Enrollment.course_id == course.id,
        Enrollment.organization_id == user.organization_id,
        Enrollment.is_deleted == False,
    ).scalar() or 0.0

    total_lessons = db.query(func.count(Lesson.id)).filter(
        Lesson.course_id == course.id,
        Lesson.organization_id == user.organization_id,
        Lesson.is_deleted == False,
    ).scalar() or 0

    completed_lessons = db.query(func.count(LessonCompletion.id)).filter(
        LessonCompletion.course_id == course.id,
        LessonCompletion.organization_id == user.organization_id,
        LessonCompletion.is_deleted == False,
        LessonCompletion.is_completed == True,
    ).scalar() or 0

    rating_breakdown = dict(
        db.query(Review.rating, func.count(Review.id))
        .filter(
            Review.course_id == course.id,
            Review.organization_id == user.organization_id,
            Review.is_deleted == False,
        )
        .group_by(Review.rating)
        .all()
    )

    lesson_completion_rate = float((completed_lessons / total_lessons) * 100.0) if total_lessons else 0.0

    return {
        "course_id": course.id,
        "total_students": total_students,
        "active_students": active_students,
        "completed_students": completed_students,
        "average_progress": float(average_progress),
        "total_lessons": total_lessons,
        "completed_lessons": completed_lessons,
        "lesson_completion_rate": lesson_completion_rate,
        "average_rating": float(course.average_rating or 0.0),
        "review_count": int(course.review_count or 0),
        "rating_breakdown": {str(int(rating)): count for rating, count in rating_breakdown.items()},
        "quiz_performance": get_course_quiz_performance(db, course, user),
    }


def get_admin_dashboard_overview(db: Session, user) -> dict[str, Any]:
    total_users = db.query(func.count(User.id)).filter(
        User.organization_id == user.organization_id,
        User.is_deleted == False,
    ).scalar() or 0

    total_courses = db.query(func.count(Course.id)).filter(
        Course.organization_id == user.organization_id,
        Course.is_deleted == False,
    ).scalar() or 0

    active_users = db.query(func.count(User.id)).filter(
        User.organization_id == user.organization_id,
        User.is_active == True,
        User.is_deleted == False,
    ).scalar() or 0

    revenue = float(
        db.query(func.coalesce(func.sum(Payment.amount), 0.0))
        .filter(
            Payment.organization_id == user.organization_id,
            Payment.status == PaymentStatus.succeeded,
            Payment.is_deleted == False,
        )
        .scalar()
        or 0.0
    )

    total_organizations = 1
    if getattr(user, "role_name", None) == "super_admin":
        total_organizations = db.query(func.count(Organization.id)).filter(
            Organization.is_deleted == False,
        ).scalar() or 0

    return {
        "total_users": total_users,
        "total_courses": total_courses,
        "total_organizations": total_organizations,
        "revenue": revenue,
        "active_users": active_users,
    }


def _get_admin_student(db: Session, student_id: int, user: User) -> User | None:
    return (
        db.query(User)
        .join(Role)
        .filter(
            User.id == student_id,
            User.organization_id == user.organization_id,
            User.is_deleted == False,
            Role.name == "student",
        )
        .first()
    )


def get_admin_student_activity_summary(db: Session, user: User) -> List[dict[str, Any]]:
    students = (
        db.query(User)
        .join(Role)
        .filter(
            User.organization_id == user.organization_id,
            User.is_deleted == False,
            Role.name == "student",
        )
        .order_by(User.full_name)
        .all()
    )

    student_ids = [student.id for student in students]
    if not student_ids:
        return []

    enrollment_counts = dict(
        db.query(Enrollment.user_id, func.count(Enrollment.id))
        .filter(
            Enrollment.user_id.in_(student_ids),
            Enrollment.organization_id == user.organization_id,
            Enrollment.is_deleted == False,
        )
        .group_by(Enrollment.user_id)
        .all()
    )

    assignment_counts = dict(
        db.query(AssignmentSubmission.user_id, func.count(AssignmentSubmission.id))
        .filter(
            AssignmentSubmission.user_id.in_(student_ids),
            AssignmentSubmission.organization_id == user.organization_id,
            AssignmentSubmission.is_deleted == False,
        )
        .group_by(AssignmentSubmission.user_id)
        .all()
    )

    quiz_counts = dict(
        db.query(QuizAttempt.user_id, func.count(QuizAttempt.id))
        .filter(
            QuizAttempt.user_id.in_(student_ids),
            QuizAttempt.organization_id == user.organization_id,
            QuizAttempt.is_deleted == False,
        )
        .group_by(QuizAttempt.user_id)
        .all()
    )

    progress_averages = dict(
        db.query(Enrollment.user_id, func.avg(Enrollment.progress))
        .filter(
            Enrollment.user_id.in_(student_ids),
            Enrollment.organization_id == user.organization_id,
            Enrollment.is_deleted == False,
        )
        .group_by(Enrollment.user_id)
        .all()
    )

    last_logins = dict(
        db.query(AuthSession.user_id, func.max(AuthSession.last_used_at))
        .filter(
            AuthSession.user_id.in_(student_ids),
            AuthSession.organization_id == user.organization_id,
            AuthSession.is_deleted == False,
        )
        .group_by(AuthSession.user_id)
        .all()
    )

    return [
        {
            "user_id": student.id,
            "full_name": student.full_name,
            "email": student.email,
            "courses_enrolled": int(enrollment_counts.get(student.id, 0)),
            "assignments_submitted": int(assignment_counts.get(student.id, 0)),
            "quizzes_attempted": int(quiz_counts.get(student.id, 0)),
            "completion_progress": float(progress_averages.get(student.id, 0.0) or 0.0),
            "last_login": last_logins.get(student.id),
        }
        for student in students
    ]


def get_admin_student_activity_details(db: Session, student_id: int, user: User) -> dict[str, Any]:
    student = _get_admin_student(db, student_id, user)
    if not student:
        raise ValueError("Student not found.")

    enrollments = (
        db.query(Enrollment)
        .join(Course)
        .filter(
            Enrollment.user_id == student_id,
            Enrollment.organization_id == user.organization_id,
            Enrollment.is_deleted == False,
            Course.organization_id == user.organization_id,
            Course.is_deleted == False,
        )
        .order_by(Enrollment.enrolled_at.desc())
        .all()
    )

    quiz_attempts = (
        db.query(QuizAttempt)
        .join(Quiz)
        .join(Course, Quiz.course_id == Course.id)
        .filter(
            QuizAttempt.user_id == student_id,
            QuizAttempt.organization_id == user.organization_id,
            QuizAttempt.is_deleted == False,
            Quiz.organization_id == user.organization_id,
            Quiz.is_deleted == False,
            Course.organization_id == user.organization_id,
            Course.is_deleted == False,
        )
        .order_by(QuizAttempt.completed_at.desc())
        .all()
    )

    assignment_submissions = (
        db.query(AssignmentSubmission)
        .join(Assignment)
        .join(Course, Assignment.course_id == Course.id)
        .filter(
            AssignmentSubmission.user_id == student_id,
            AssignmentSubmission.organization_id == user.organization_id,
            AssignmentSubmission.is_deleted == False,
            Assignment.organization_id == user.organization_id,
            Assignment.is_deleted == False,
            Course.organization_id == user.organization_id,
            Course.is_deleted == False,
        )
        .order_by(AssignmentSubmission.submitted_at.desc())
        .all()
    )

    overall_progress = float(
        db.query(func.avg(Enrollment.progress))
        .filter(
            Enrollment.user_id == student_id,
            Enrollment.organization_id == user.organization_id,
            Enrollment.is_deleted == False,
        )
        .scalar()
        or 0.0
    )

    return {
        "overall_progress": overall_progress,
        "courses": [
            {
                "course_id": enrollment.course.id,
                "title": enrollment.course.title,
                "progress": float(enrollment.progress or 0.0),
                "status": _normalize_status(enrollment.status),
                "enrolled_at": enrollment.enrolled_at,
                "completed_at": enrollment.completed_at,
            }
            for enrollment in enrollments
        ],
        "quiz_attempts": [
            {
                "attempt_id": attempt.id,
                "quiz_id": attempt.quiz_id,
                "quiz_title": attempt.quiz.title if attempt.quiz else None,
                "course_title": attempt.quiz.course.title if attempt.quiz and attempt.quiz.course else None,
                "score": float(attempt.score or 0.0),
                "passed": bool(attempt.passed),
                "completed_at": attempt.completed_at,
            }
            for attempt in quiz_attempts
        ],
        "assignment_submissions": [
            {
                "submission_id": submission.id,
                "assignment_id": submission.assignment_id,
                "assignment_title": submission.assignment.title if submission.assignment else None,
                "course_title": submission.assignment.course.title if submission.assignment and submission.assignment.course else None,
                "grade": submission.grade,
                "status": _normalize_status(submission.status),
                "submitted_at": submission.submitted_at,
            }
            for submission in assignment_submissions
        ],
    }


def _get_admin_instructor(db: Session, instructor_id: int, user: User) -> User | None:
    return (
        db.query(User)
        .join(Role)
        .filter(
            User.id == instructor_id,
            User.organization_id == user.organization_id,
            User.is_deleted == False,
            Role.name == "instructor",
        )
        .first()
    )


def get_admin_instructor_activity_summary(db: Session, user: User) -> List[dict[str, Any]]:
    instructors = (
        db.query(User)
        .join(Role)
        .filter(
            User.organization_id == user.organization_id,
            User.is_deleted == False,
            Role.name == "instructor",
        )
        .order_by(User.full_name)
        .all()
    )

    instructor_ids = [instructor.id for instructor in instructors]
    if not instructor_ids:
        return []

    course_counts = dict(
        db.query(Course.owner_id, func.count(Course.id))
        .filter(
            Course.owner_id.in_(instructor_ids),
            Course.organization_id == user.organization_id,
            Course.is_deleted == False,
        )
        .group_by(Course.owner_id)
        .all()
    )

    lesson_counts = dict(
        db.query(Course.owner_id, func.count(Lesson.id))
        .join(Lesson, Course.id == Lesson.course_id)
        .filter(
            Course.owner_id.in_(instructor_ids),
            Course.organization_id == user.organization_id,
            Course.is_deleted == False,
            Lesson.organization_id == user.organization_id,
            Lesson.is_deleted == False,
        )
        .group_by(Course.owner_id)
        .all()
    )

    quiz_counts = dict(
        db.query(Course.owner_id, func.count(Quiz.id))
        .join(Quiz, Course.id == Quiz.course_id)
        .filter(
            Course.owner_id.in_(instructor_ids),
            Course.organization_id == user.organization_id,
            Course.is_deleted == False,
            Quiz.organization_id == user.organization_id,
            Quiz.is_deleted == False,
            Quiz.published == True,
        )
        .group_by(Course.owner_id)
        .all()
    )

    assignment_counts = dict(
        db.query(Assignment.creator_id, func.count(Assignment.id))
        .filter(
            Assignment.creator_id.in_(instructor_ids),
            Assignment.organization_id == user.organization_id,
            Assignment.is_deleted == False,
            Assignment.published == True,
        )
        .group_by(Assignment.creator_id)
        .all()
    )

    enrollment_counts = dict(
        db.query(Course.owner_id, func.count(Enrollment.id))
        .join(Enrollment, Course.id == Enrollment.course_id)
        .filter(
            Course.owner_id.in_(instructor_ids),
            Course.organization_id == user.organization_id,
            Course.is_deleted == False,
            Enrollment.organization_id == user.organization_id,
            Enrollment.is_deleted == False,
        )
        .group_by(Course.owner_id)
        .all()
    )

    return [
        {
            "user_id": instructor.id,
            "full_name": instructor.full_name,
            "email": instructor.email,
            "courses_created": int(course_counts.get(instructor.id, 0)),
            "lessons_uploaded": int(lesson_counts.get(instructor.id, 0)),
            "quizzes_created": int(quiz_counts.get(instructor.id, 0)),
            "assignments_created": int(assignment_counts.get(instructor.id, 0)),
            "students_enrolled": int(enrollment_counts.get(instructor.id, 0)),
        }
        for instructor in instructors
    ]


def get_admin_instructor_activity_details(db: Session, instructor_id: int, user: User) -> dict[str, Any]:
    instructor = _get_admin_instructor(db, instructor_id, user)
    if not instructor:
        raise ValueError("Instructor not found.")

    courses = (
        db.query(Course)
        .filter(
            Course.owner_id == instructor_id,
            Course.organization_id == user.organization_id,
            Course.is_deleted == False,
        )
        .order_by(Course.created_at.desc())
        .all()
    )

    course_ids = [course.id for course in courses]

    lessons = (
        db.query(Lesson)
        .filter(
            Lesson.course_id.in_(course_ids) if course_ids else False,
            Lesson.organization_id == user.organization_id,
            Lesson.is_deleted == False,
        )
        .order_by(Lesson.created_at.desc())
        .all()
    )

    quizzes = (
        db.query(Quiz)
        .filter(
            Quiz.course_id.in_(course_ids) if course_ids else False,
            Quiz.organization_id == user.organization_id,
            Quiz.is_deleted == False,
            Quiz.published == True,
        )
        .order_by(Quiz.created_at.desc())
        .all()
    )

    assignments = (
        db.query(Assignment)
        .filter(
            Assignment.creator_id == instructor_id,
            Assignment.organization_id == user.organization_id,
            Assignment.is_deleted == False,
            Assignment.published == True,
        )
        .order_by(Assignment.created_at.desc())
        .all()
    )

    return {
        "courses": [
            {
                "course_id": course.id,
                "title": course.title,
                "status": _normalize_status(course.status),
                "is_published": bool(course.is_published),
                "created_at": course.created_at,
            }
            for course in courses
        ],
        "lessons": [
            {
                "lesson_id": lesson.id,
                "title": lesson.title,
                "course_id": lesson.course_id,
                "course_title": lesson.course.title if lesson.course else None,
                "created_at": lesson.created_at,
            }
            for lesson in lessons
        ],
        "quizzes": [
            {
                "quiz_id": quiz.id,
                "title": quiz.title,
                "course_id": quiz.course_id,
                "course_title": quiz.course.title if quiz.course else None,
                "question_count": int(quiz.question_count or 0),
                "created_at": quiz.created_at,
            }
            for quiz in quizzes
        ],
        "assignments": [
            {
                "assignment_id": assignment.id,
                "title": assignment.title,
                "course_id": assignment.course_id,
                "course_title": assignment.course.title if assignment.course else None,
                "max_score": int(assignment.max_score or 0),
                "created_at": assignment.created_at,
            }
            for assignment in assignments
        ],
        "total_students_enrolled": int(
            db.query(func.count(Enrollment.id.distinct()))
            .join(Course, Enrollment.course_id == Course.id)
            .filter(
                Course.owner_id == instructor_id,
                Course.organization_id == user.organization_id,
                Enrollment.organization_id == user.organization_id,
                Course.is_deleted == False,
                Enrollment.is_deleted == False,
            )
            .scalar()
            or 0
        ),
    }


def get_admin_comments(db: Session, comment_type: AdminCommentType, related_id: int, user: User) -> List[dict[str, Any]]:
    comments = (
        db.query(AdminComment)
        .filter(
            AdminComment.comment_type == comment_type,
            AdminComment.related_id == related_id,
            AdminComment.organization_id == user.organization_id,
            AdminComment.is_deleted == False,
        )
        .order_by(AdminComment.created_at.desc())
        .all()
    )

    return [
        {
            "id": comment.id,
            "admin_name": comment.admin.full_name if comment.admin else "Anonymous",
            "content": comment.content,
            "created_at": comment.created_at,
        }
        for comment in comments
    ]


def create_admin_comment(
    db: Session,
    comment_type: AdminCommentType,
    related_id: int,
    content: str,
    user: User,
) -> dict[str, Any]:
    if not content or not content.strip():
        raise ValueError("Comment content cannot be empty.")

    comment = AdminComment(
        admin_id=user.id,
        comment_type=comment_type,
        related_id=related_id,
        content=content.strip(),
        organization_id=user.organization_id,
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)

    try:
        target_user = None
        notification_title = None
        notification_message = None

        if comment_type == AdminCommentType.assignment_submission:
            from app.models import AssignmentSubmission

            submission = (
                db.query(AssignmentSubmission)
                .filter(
                    AssignmentSubmission.id == related_id,
                    AssignmentSubmission.organization_id == user.organization_id,
                    AssignmentSubmission.is_deleted == False,
                )
                .one_or_none()
            )
            if submission and submission.user:
                target_user = submission.user
                notification_title = "New instructor comment on your assignment"
                notification_message = f"A comment was added to your submission for '{submission.assignment.title}'."
        elif comment_type == AdminCommentType.quiz_attempt:
            from app.models import QuizAttempt

            attempt = (
                db.query(QuizAttempt)
                .filter(
                    QuizAttempt.id == related_id,
                    QuizAttempt.organization_id == user.organization_id,
                    QuizAttempt.is_deleted == False,
                )
                .one_or_none()
            )
            if attempt and attempt.user:
                target_user = attempt.user
                notification_title = "New instructor comment on your quiz attempt"
                notification_message = f"A comment was added to your attempt for '{attempt.quiz.title}'."
        elif comment_type in (AdminCommentType.student, AdminCommentType.instructor):
            from app.models import User as TargetUser

            target_user = (
                db.query(TargetUser)
                .filter(
                    TargetUser.id == related_id,
                    TargetUser.organization_id == user.organization_id,
                    TargetUser.is_deleted == False,
                )
                .one_or_none()
            )
            if target_user:
                notification_title = "New admin comment"
                notification_message = "You have received a new comment from an administrator."

        if target_user and notification_title and notification_message:
            create_notification(db, target_user, notification_title, notification_message)
    except Exception:
        pass

    return {
        "id": comment.id,
        "admin_name": user.full_name or "Anonymous",
        "content": comment.content,
        "created_at": comment.created_at,
    }


def list_admin_comments(db: Session, user: User) -> List[dict[str, Any]]:
    comments = (
        db.query(AdminComment)
        .filter(
            AdminComment.organization_id == user.organization_id,
            AdminComment.is_deleted == False,
            AdminComment.comment_type.in_([AdminCommentType.student, AdminCommentType.instructor]),
        )
        .order_by(AdminComment.created_at.desc())
        .all()
    )

    results: List[dict[str, Any]] = []
    for comment in comments:
        target_name = None
        if comment.comment_type in (AdminCommentType.student, AdminCommentType.instructor):
            target_user = (
                db.query(User)
                .filter(User.id == comment.related_id, User.is_deleted == False)
                .first()
            )
            if target_user:
                target_name = target_user.full_name

        results.append({
            "id": comment.id,
            "target_type": comment.target_type.value if hasattr(comment.target_type, "value") else str(comment.target_type),
            "target_name": target_name,
            "comment": comment.comment,
            "created_at": comment.created_at,
        })

    return results


def get_admin_student_submissions(db: Session, user: User) -> List[dict[str, Any]]:
    """Get student submissions and quiz attempts with associated admin comments."""
    submissions = []

    # Get assignment submissions
    try:
        assignment_submissions = (
            db.query(AssignmentSubmission)
            .filter(
                AssignmentSubmission.organization_id == user.organization_id,
                AssignmentSubmission.is_deleted == False,
            )
            .all()
        )

        for submission in assignment_submissions:
            # Get the student user
            student = (
                db.query(User)
                .filter(User.id == submission.user_id, User.is_deleted == False)
                .first()
            )
            if not student:
                continue

            # Get the assignment
            assignment = (
                db.query(Assignment)
                .filter(Assignment.id == submission.assignment_id, Assignment.is_deleted == False)
                .first()
            )
            if not assignment:
                continue

            # Get the course
            course = (
                db.query(Course)
                .filter(Course.id == assignment.course_id, Course.is_deleted == False)
                .first()
            )
            if not course:
                continue

            # Get admin comment if exists
            comment = (
                db.query(AdminComment)
                .filter(
                    AdminComment.comment_type == AdminCommentType.assignment_submission,
                    AdminComment.related_id == submission.id,
                    AdminComment.is_deleted == False,
                )
                .order_by(AdminComment.created_at.desc())
                .first()
            )

            submissions.append({
                "student_id": student.id,
                "student_name": student.full_name or "Unknown Student",
                "course_title": course.title or "Unknown Course",
                "course": course.title or "Unknown Course",
                "assignment_or_quiz": f"Assignment: {assignment.title or 'Unknown Assignment'}",
                "submission_type": "Assignment",
                "submission_date": submission.submitted_at,
                "submitted_at": submission.submitted_at,
                "admin_comment": comment.content if comment else None,
                "comment_id": comment.id if comment else None,
                "related_id": submission.id,
                "comment_type": "assignment_submission",
            })
    except Exception as e:
        raise ValueError(f"Error fetching assignment submissions: {str(e)}")

    # Get quiz attempts
    try:
        quiz_attempts = (
            db.query(QuizAttempt)
            .filter(
                QuizAttempt.organization_id == user.organization_id,
                QuizAttempt.is_deleted == False,
            )
            .all()
        )

        for attempt in quiz_attempts:
            # Get the student user
            student = (
                db.query(User)
                .filter(User.id == attempt.user_id, User.is_deleted == False)
                .first()
            )
            if not student:
                continue

            # Get the quiz
            quiz = (
                db.query(Quiz)
                .filter(Quiz.id == attempt.quiz_id, Quiz.is_deleted == False)
                .first()
            )
            if not quiz:
                continue

            # Get the course
            course = (
                db.query(Course)
                .filter(Course.id == quiz.course_id, Course.is_deleted == False)
                .first()
            )
            if not course:
                continue

            # Get admin comment if exists
            comment = (
                db.query(AdminComment)
                .filter(
                    AdminComment.comment_type == AdminCommentType.quiz_attempt,
                    AdminComment.related_id == attempt.id,
                    AdminComment.is_deleted == False,
                )
                .order_by(AdminComment.created_at.desc())
                .first()
            )

            # Use completed_at if available, otherwise started_at
            submission_date = attempt.completed_at or attempt.started_at

            submissions.append({
                "student_id": student.id,
                "student_name": student.full_name or "Unknown Student",
                "course_title": course.title or "Unknown Course",
                "course": course.title or "Unknown Course",
                "assignment_or_quiz": f"Quiz: {quiz.title or 'Unknown Quiz'}",
                "submission_type": "Quiz",
                "submission_date": submission_date,
                "submitted_at": submission_date,
                "admin_comment": comment.content if comment else None,
                "comment_id": comment.id if comment else None,
                "related_id": attempt.id,
                "comment_type": "quiz_attempt",
            })
    except Exception as e:
        raise ValueError(f"Error fetching quiz attempts: {str(e)}")

    # Sort by submission date descending
    submissions.sort(key=lambda x: x["submission_date"] or datetime(1900, 1, 1), reverse=True)

    return submissions


def get_admin_instructor_activity(db: Session, user: User) -> List[dict[str, Any]]:
    """Get instructor activity with associated admin comments."""
    activity_list = []

    try:
        # Get all instructors in the organization
        instructors = (
            db.query(User)
            .filter(
                User.role == "instructor",
                User.organization_id == user.organization_id,
                User.is_deleted == False,
            )
            .all()
        )

        for instructor in instructors:
            # Get courses created by this instructor
            courses = (
                db.query(Course)
                .filter(
                    Course.owner_id == instructor.id,
                    Course.organization_id == user.organization_id,
                    Course.is_deleted == False,
                )
                .all()
            )

            for course in courses:
                # Count lessons in this course
                lessons_count = (
                    db.query(func.count(Lesson.id))
                    .filter(
                        Lesson.course_id == course.id,
                        Lesson.is_deleted == False,
                    )
                    .scalar() or 0
                )

                # Count quizzes in this course
                quizzes_count = (
                    db.query(func.count(Quiz.id))
                    .filter(
                        Quiz.course_id == course.id,
                        Quiz.is_deleted == False,
                        Quiz.published == True,
                    )
                    .scalar() or 0
                )

                # Get admin comment if exists
                comment = (
                    db.query(AdminComment)
                    .filter(
                        AdminComment.comment_type == AdminCommentType.instructor_course,
                        AdminComment.related_id == course.id,
                        AdminComment.is_deleted == False,
                    )
                    .order_by(AdminComment.created_at.desc())
                    .first()
                )

                activity_list.append({
                    "instructor_id": instructor.id,
                    "instructor_name": instructor.full_name or "Unknown Instructor",
                    "course_title": course.title or "Unknown Course",
                    "course": course.title or "Unknown Course",
                    "lessons_uploaded": int(lessons_count),
                    "quizzes_created": int(quizzes_count),
                    "admin_feedback": comment.content if comment else None,
                    "comment_id": comment.id if comment else None,
                    "related_id": course.id,
                    "comment_type": "instructor_course",
                })
    except Exception as e:
        raise ValueError(f"Error fetching instructor activity: {str(e)}")

    return activity_list


def get_dashboard_overview(db: Session, user, limit: int = DASHBOARD_DEFAULT_LIMIT) -> dict[str, Any]:
    return {
        "enrolled_courses": get_dashboard_enrolled_courses(db, user, limit),
        "continue_learning": get_dashboard_continue_learning(db, user, limit),
        "completed_courses": get_dashboard_completed_courses(db, user, limit),
        "certificates": get_dashboard_certificates(db, user, limit),
        "notifications": get_dashboard_notifications(db, user, limit),
        "recommended_courses": get_dashboard_recommended_courses(db, user, limit),
        "recent_activity": get_dashboard_recent_activity(db, user, limit),
        "learning_path_progress": get_dashboard_learning_path_progress(db, user, limit),
    }


def get_daily_learning_videos_today(db: Session, user) -> List[dict[str, Any]]:
    """Get today's daily learning videos for the user's organization."""
    today = datetime.now().date()

    videos = (
        db.query(DailyLearningVideo)
        .join(User, DailyLearningVideo.user_id == User.id)
        .filter(
            DailyLearningVideo.organization_id == user.organization_id,
            DailyLearningVideo.is_deleted == False,
            func.date(DailyLearningVideo.uploaded_at) == today,
        )
        .order_by(DailyLearningVideo.uploaded_at.desc())
        .all()
    )

    return [
        {
            "id": video.id,
            "user_id": video.user_id,
            "user_name": video.user.full_name if video.user else "Unknown User",
            "title": video.title,
            "description": video.description,
            "video_type": video.video_type,
            "video_url": video.video_url,
            "uploaded_at": video.uploaded_at,
        }
        for video in videos
    ]


def get_all_daily_learning_videos(db: Session, user) -> List[dict[str, Any]]:
    """Get all daily learning videos for the user's organization."""
    videos = (
        db.query(DailyLearningVideo)
        .join(User, DailyLearningVideo.user_id == User.id)
        .filter(
            DailyLearningVideo.organization_id == user.organization_id,
            DailyLearningVideo.is_deleted == False,
        )
        .order_by(DailyLearningVideo.uploaded_at.desc())
        .all()
    )

    return [
        {
            "id": video.id,
            "user_id": video.user_id,
            "user_name": video.user.full_name if video.user else "Unknown User",
            "title": video.title,
            "description": video.description,
            "video_type": video.video_type,
            "video_url": video.video_url,
            "uploaded_at": video.uploaded_at,
        }
        for video in videos
    ]


def _get_vimeo_embed_url(vimeo_url: str) -> str:
    trimmed = vimeo_url.strip()
    patterns = [
        r"https?://(?:www\.)?vimeo\.com/(\d+)",
        r"https?://(?:www\.)?player\.vimeo\.com/video/(\d+)"
    ]
    for pattern in patterns:
        match = re.match(pattern, trimmed)
        if match:
            return f"https://player.vimeo.com/video/{match.group(1)}"
    raise ValueError("Invalid Vimeo URL. Please provide a Vimeo link like https://vimeo.com/123456 or https://player.vimeo.com/video/123456.")


def upload_daily_learning_video(
    db: Session,
    user,
    title: str,
    description: str,
    video_file: UploadFile | None = None,
    vimeo_url: str | None = None,
) -> dict[str, Any]:
    """Upload a daily learning video for the user."""
    video_type = "upload"
    video_url = ""

    if video_file is not None:
        from app.services.storage import FileStorageService

        storage_service = FileStorageService()

        file_bytes = video_file.file.read() if hasattr(video_file, 'file') else video_file.read()
        content_type = video_file.content_type or "video/mp4"

        storage_service.validate_file_size(len(file_bytes))
        storage_service.validate_file_type(content_type, video_file.filename)

        directory = f"daily-learning/{user.organization_id}"
        upload_result = storage_service.upload_file_local(
            directory=directory,
            filename=video_file.filename or "video.mp4",
            body=file_bytes,
        )

        video_url = upload_result["url"]
        video_type = "upload"
    elif vimeo_url:
        video_url = _get_vimeo_embed_url(vimeo_url)
        video_type = "vimeo"
    else:
        raise ValueError("Please upload a video or provide a Vimeo link.")

    video = DailyLearningVideo(
        user_id=user.id,
        organization_id=user.organization_id,
        title=title,
        description=description,
        video_type=video_type,
        video_url=video_url,
    )

    db.add(video)
    db.commit()
    db.refresh(video)

    return {
        "id": video.id,
        "user_id": video.user_id,
        "user_name": user.full_name,
        "title": video.title,
        "description": video.description,
        "video_type": video.video_type,
        "video_url": video.video_url,
        "uploaded_at": video.uploaded_at,
    }
