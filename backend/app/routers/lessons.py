from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import schemas
from app.dependencies import get_current_active_user, get_db, get_tenant
from app.services import auth as auth_service, courses as course_service

router = APIRouter()

# Temporary in-memory storage
lessons_db: list[schemas.Lesson] = []


@router.post("/", response_model=schemas.Lesson, status_code=status.HTTP_201_CREATED)
def create_lesson_simple(
    payload: schemas.Lesson,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: schemas.UserRead = Depends(get_current_active_user),
):
    # Store in temporary list
    lessons_db.append(payload)
    return payload


@router.get("/modules/{module_id}/lessons", response_model=list[schemas.Lesson])
def get_lessons_by_module(
    module_id: int,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: schemas.UserRead = Depends(get_current_active_user),
):
    # Filter lessons by module_id
    return [lesson for lesson in lessons_db if lesson.module_id == module_id]