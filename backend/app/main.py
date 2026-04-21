from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from app import schemas
from app.config import settings
from app.database import init_db
from app.dependencies import get_current_active_user, get_db, get_tenant
from app.middleware.role import RoleMiddleware
from app.middleware.tenant import TenantMiddleware
from app.routers import admin, auth, billing, certificates, courses, dashboard, files, organizations, quizzes, tenants, assignments, gamification, chatbot, transcription, student, announcements, live_classes, lessons, support, calendar
from app.services import auth as auth_service, dashboard as dashboard_service, organizations as organization_service

app = FastAPI(
    title="LMS Platform API",
    version="0.1.0",
    description="Backend API for a multi-tenant SaaS Learning Management System",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(TenantMiddleware)
app.add_middleware(RoleMiddleware)


@app.on_event("startup")
def on_startup() -> None:
    init_db()


app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(admin.router, prefix="/api/v1/admin", tags=["admin"])
app.include_router(files.router, prefix="/api/v1/files", tags=["files"])
app.include_router(organizations.router, prefix="/api/v1/organizations", tags=["organizations"])
app.include_router(tenants.router, prefix="/api/v1/tenants", tags=["tenants"])
app.include_router(courses.router, prefix="/api/v1/courses", tags=["courses"])
app.include_router(lessons.router, prefix="/api/v1/lessons", tags=["lessons"])
app.include_router(assignments.router, prefix="/api/v1/assignments", tags=["assignments"])
app.include_router(certificates.router, prefix="/api/v1/certificates", tags=["certificates"])
app.include_router(quizzes.router, prefix="/api/v1/quizzes", tags=["quizzes"])
app.include_router(dashboard.router, prefix="/api/v1/dashboard", tags=["dashboard"])
app.include_router(gamification.router, prefix="/api/v1/gamification", tags=["gamification"])
app.include_router(billing.router, prefix="/api/v1/billing", tags=["billing"])
app.include_router(chatbot.router, prefix="/api/v1/chatbot", tags=["chatbot"])
app.include_router(support.router, prefix="/api/v1/support", tags=["support"])
app.include_router(transcription.router, tags=["transcription"])
app.include_router(student.router, prefix="/api/v1/student", tags=["student"])
app.include_router(announcements.router, prefix="/api/v1/announcements", tags=["announcements"])
app.include_router(live_classes.router, prefix="/api/v1/live-classes", tags=["live-classes"])
app.include_router(calendar.router, prefix="/api/v1/calendar", tags=["calendar"])

# Mount uploads directory for serving static files
uploads_dir = Path(__file__).resolve().parent.parent / "uploads"
uploads_dir.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")


@app.get("/api/v1/notifications", response_model=list[schemas.DashboardNotificationItem], tags=["dashboard"])
def list_notifications_alias(
    db=Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    organization = organization_service.get_organization_by_id(db, current_user.organization_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    return dashboard_service.list_user_notifications(db, current_user)


@app.patch("/api/v1/notifications/{notification_id}/read", response_model=schemas.DashboardNotificationItem, tags=["dashboard"])
def mark_notification_read_alias(
    notification_id: int,
    db=Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    organization = organization_service.get_organization_by_id(db, current_user.organization_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    try:
        return dashboard_service.mark_notification_as_read(db, current_user, notification_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@app.get("/api/v1/health", tags=["health"])
def health_check() -> dict[str, str]:
    return {"status": "ok"}
