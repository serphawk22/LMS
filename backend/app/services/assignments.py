from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, List

from sqlalchemy.orm import Session

from app.models import Assignment, AssignmentSubmission, Course, User
from app.services import courses as course_service
from app.schemas.assignment import (
    AssignmentCreate,
    AssignmentGradePayload,
    AssignmentSubmissionCreate,
    AssignmentUpdate,
)


def get_organization_assignments(
    db: Session,
    organization_id: int,
    course_id: int | None = None,
    include_unpublished: bool = False,
    creator_id: int | None = None,
) -> List[Assignment]:
    query = db.query(Assignment).filter(Assignment.organization_id == organization_id, Assignment.is_deleted == False)
    if course_id is not None:
        query = query.filter(Assignment.course_id == course_id)
    if not include_unpublished:
        query = query.filter(Assignment.published == True)
    if creator_id is not None:
        query = query.filter(Assignment.creator_id == creator_id)
    return query.order_by(Assignment.created_at.desc()).all()


def get_student_assignments(db: Session, user_id: int, organization_id: int) -> List[Assignment]:
    # Get assignments for courses the student is enrolled in
    from app.models import Enrollment
    query = (
        db.query(Assignment)
        .join(Course, Assignment.course_id == Course.id)
        .join(Enrollment, Course.id == Enrollment.course_id)
        .filter(
            Assignment.organization_id == organization_id,
            Assignment.is_deleted == False,
            Assignment.published == True,
            Enrollment.user_id == user_id,
            Enrollment.organization_id == organization_id,
            Enrollment.is_deleted == False,
        )
    )
    return query.order_by(Assignment.due_date.asc(), Assignment.created_at.desc()).all()


def get_assignment_by_id(db: Session, assignment_id: int, organization_id: int) -> Assignment | None:
    return (
        db.query(Assignment)
        .filter(Assignment.id == assignment_id, Assignment.organization_id == organization_id, Assignment.is_deleted == False)
        .one_or_none()
    )


def create_assignment(db: Session, organization, creator: User, payload: AssignmentCreate) -> Assignment:
    course = (
        db.query(Course)
        .filter(Course.id == payload.course_id, Course.organization_id == organization.id, Course.is_deleted == False)
        .one_or_none()
    )
    if not course:
        raise ValueError("Course not found for the organization.")

    assignment = Assignment(
        course_id=course.id,
        organization_id=organization.id,
        creator_id=creator.id,
        title=payload.title,
        instructions=payload.instructions,
        due_date=payload.due_date,
        max_score=payload.max_score,
        published=payload.published,
        allow_late_submission=payload.allow_late_submission,
        attachments=payload.attachments,
    )
    db.add(assignment)
    db.commit()
    db.refresh(assignment)

    try:
        from app.models import Enrollment
        from app.services.dashboard import create_notifications_for_users

        if assignment.published:
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
                due_date_text = (
                    f" Due {assignment.due_date.date().isoformat()}."
                    if assignment.due_date
                    else ""
                )
                create_notifications_for_users(
                    db,
                    enrolled_user_ids,
                    organization.id,
                    f"New assignment: {assignment.title}",
                    f"A new assignment is available for '{course.title}'.{due_date_text}",
                )
    except Exception:
        pass

    return assignment


def update_assignment(db: Session, assignment: Assignment, payload: AssignmentUpdate) -> Assignment:
    was_published = assignment.published
    for field in payload.__fields_set__:
        value = getattr(payload, field)
        if value is not None:
            setattr(assignment, field, value)

    db.add(assignment)
    db.commit()
    db.refresh(assignment)

    if not was_published and assignment.published:
        try:
            from app.models import Enrollment
            from app.services.dashboard import create_notifications_for_users

            enrolled_user_ids = [
                enrollment.user_id
                for enrollment in db.query(Enrollment)
                .filter(
                    Enrollment.course_id == assignment.course_id,
                    Enrollment.organization_id == assignment.organization_id,
                    Enrollment.is_deleted == False,
                )
                .all()
            ]
            if enrolled_user_ids:
                due_date_text = (
                    f" Due {assignment.due_date.date().isoformat()}."
                    if assignment.due_date
                    else ""
                )
                create_notifications_for_users(
                    db,
                    enrolled_user_ids,
                    assignment.organization_id,
                    f"New assignment: {assignment.title}",
                    f"A new assignment is available for '{assignment.course.title}'.{due_date_text}",
                )
        except Exception:
            pass

    return assignment


def soft_delete_assignment(db: Session, assignment: Assignment) -> None:
    assignment.is_deleted = True
    db.add(assignment)
    db.commit()


def submit_assignment(db: Session, assignment: Assignment, user: User, payload: AssignmentSubmissionCreate) -> AssignmentSubmission:
    if not assignment.published:
        raise ValueError("Assignment is not available for submission.")

    existing = (
        db.query(AssignmentSubmission)
        .filter(
            AssignmentSubmission.assignment_id == assignment.id,
            AssignmentSubmission.user_id == user.id,
            AssignmentSubmission.organization_id == assignment.organization_id,
            AssignmentSubmission.is_deleted == False,
        )
        .one_or_none()
    )

    now = datetime.now(timezone.utc)
    late = False

    attachment_data = []
    if payload.attachments:
        attachment_data = [
            attachment.model_dump(exclude_none=True)
            if hasattr(attachment, "model_dump")
            else attachment
            for attachment in payload.attachments
        ]

    if assignment.due_date is not None and now > assignment.due_date:
        late = True
        if not assignment.allow_late_submission:
            raise ValueError("Late submissions are not allowed for this assignment.")

    if existing:
        if existing.status == 'graded':
            raise ValueError('Cannot resubmit after grading.')
        existing.content = payload.content
        existing.attachments = attachment_data
        existing.submitted_at = now
        existing.status = 'submitted'
        existing.grade = None
        existing.feedback = None
        db.add(existing)
        db.commit()
        db.refresh(existing)
        course_service.update_course_progress(db, user.id, assignment.course_id, assignment.organization_id)
        return existing

    submission = AssignmentSubmission(
        user_id=user.id,
        assignment_id=assignment.id,
        organization_id=assignment.organization_id,
        submitted_at=now,
        content=payload.content,
        attachments=attachment_data,
        grade=None,
        feedback=None,
        status='submitted',
    )
    db.add(submission)
    db.commit()
    db.refresh(submission)
    course_service.update_course_progress(db, user.id, assignment.course_id, assignment.organization_id)
    return submission


def get_assignment_submissions(db: Session, assignment_id: int, organization_id: int) -> List[AssignmentSubmission]:
    return (
        db.query(AssignmentSubmission)
        .filter(
            AssignmentSubmission.assignment_id == assignment_id,
            AssignmentSubmission.organization_id == organization_id,
            AssignmentSubmission.is_deleted == False,
        )
        .order_by(AssignmentSubmission.submitted_at.desc())
        .all()
    )


def get_user_assignment_submission(db: Session, assignment_id: int, user_id: int, organization_id: int) -> AssignmentSubmission | None:
    return (
        db.query(AssignmentSubmission)
        .filter(
            AssignmentSubmission.assignment_id == assignment_id,
            AssignmentSubmission.user_id == user_id,
            AssignmentSubmission.organization_id == organization_id,
            AssignmentSubmission.is_deleted == False,
        )
        .one_or_none()
    )


def get_submission_by_id(db: Session, submission_id: int, organization_id: int) -> AssignmentSubmission | None:
    return (
        db.query(AssignmentSubmission)
        .filter(
            AssignmentSubmission.id == submission_id,
            AssignmentSubmission.organization_id == organization_id,
            AssignmentSubmission.is_deleted == False,
        )
        .one_or_none()
    )


def grade_assignment_submission(db: Session, submission: AssignmentSubmission, payload: AssignmentGradePayload, graded_by: int) -> AssignmentSubmission:
    from datetime import datetime, timezone
    submission.grade = payload.grade
    submission.feedback = payload.feedback
    submission.status = payload.status or 'graded'
    submission.reviewed = True
    submission.graded_at = datetime.now(timezone.utc)
    submission.graded_by = graded_by
    db.add(submission)
    db.commit()
    db.refresh(submission)

    try:
        from app.services.dashboard import create_notification

        if submission.user_id:
            title = "Assignment graded"
            message = f"Your submission for '{submission.assignment.title}' has been graded."
            create_notification(db, submission.user, title, message)
    except Exception:
        # Notification failures should not block grading
        pass

    return submission
