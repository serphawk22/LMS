import logging

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from app import schemas
from app.config import settings
from app.database import init_db, test_db_connection
from app.dependencies import get_current_active_user, get_db, get_tenant
from app.middleware.role import RoleMiddleware
from app.middleware.tenant import TenantMiddleware
from app.routers import admin, auth, billing, certificates, courses, dashboard, files, organizations, quizzes, tenants, assignments, gamification, chatbot, transcription, student, announcements, live_classes, lessons, support, calendar, discussions, metered
from app.services import auth as auth_service, dashboard as dashboard_service, organizations as organization_service

logger = logging.getLogger(__name__)

# Global state to track database availability
_db_available = False

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
    """
    Application startup event handler.
    Initializes database connection and schema.
    """
    global _db_available
    
    logger.info("=" * 80)
    logger.info("APPLICATION STARTUP INITIATED")
    logger.info(f"Environment: {settings.environment}")
    logger.info(f"Debug Mode: {settings.debug}")
    logger.info("=" * 80)
    
    if settings.skip_db_init_on_startup:
        logger.warning("=" * 80)
        logger.warning("⚠️  DATABASE INITIALIZATION SKIPPED")
        logger.warning("   Setting: SKIP_DB_INIT_ON_STARTUP=true")
        logger.warning("   - Database schema will NOT be created/updated")
        logger.warning("   - Database operations may fail until manually initialized")
        logger.warning("   - To enable initialization: Set SKIP_DB_INIT_ON_STARTUP=false")
        logger.warning("=" * 80)
        _db_available = False
        return
    
    try:
        logger.info("Testing database connectivity...")
        success, msg = test_db_connection()
        if not success:
            logger.error(f"Database connection test failed: {msg}")
            _db_available = False
            logger.error(
                "STARTUP FAILED: Cannot connect to database. "
                "Please verify: 1) Database server is running, "
                "2) DATABASE_URL environment variable is correct, "
                "3) Network connectivity to database host is available"
            )
            return
        
        logger.info(f"Database connection test passed: {msg}")
        
        logger.info("Initializing database schema...")
        init_db()
        _db_available = True
        
        logger.info("=" * 80)
        logger.info("✅ APPLICATION STARTUP COMPLETED SUCCESSFULLY")
        logger.info("   - Database connected")
        logger.info("   - Schema initialized")
        logger.info("   - All systems operational")
        logger.info("=" * 80)
        
    except Exception as exc:
        _db_available = False
        logger.error(
            "=" * 80,
        )
        logger.error("STARTUP FAILED: Database initialization error")
        logger.error(f"Error: {exc}")
        logger.error("=" * 80)
        logger.error(
            "The application is starting WITHOUT database connectivity. "
            "Database operations will fail until this issue is resolved."
        )
        logger.error(
            "Please check: 1) Database server status, "
            "2) Connection string validity, "
            "3) Network/firewall settings, "
            "4) Database user permissions"
        )
        logger.error("=" * 80)


def is_database_available() -> bool:
    """Check if database is available for operations."""
    return _db_available


@app.get("/health", tags=["health"])
def health_check():
    """Health check endpoint to monitor application and database status."""
    db_status = "connected" if is_database_available() else "disconnected"
    status_code = 200 if is_database_available() else 503
    
    return {
        "status": "healthy" if is_database_available() else "degraded",
        "database": db_status,
        "message": f"Application is running with database {db_status}",
        "environment": settings.environment,
    }


@app.get("/api/v1/health/detailed", tags=["health"])
def detailed_health_check():
    """Detailed health check with database connectivity information."""
    db_available = is_database_available()
    
    if db_available:
        success, msg = test_db_connection()
        db_status = "connected" if success else "connection-test-failed"
        db_message = msg
    else:
        db_status = "disconnected"
        db_message = "Database not initialized during startup"
    
    return {
        "status": "healthy" if db_available else "degraded",
        "database_status": db_status,
        "database_message": db_message,
        "environment": settings.environment,
        "skip_db_init": settings.skip_db_init_on_startup,
    }


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
app.include_router(discussions.router, prefix="/api/v1", tags=["discussions"])
app.include_router(transcription.router, tags=["transcription"])
app.include_router(student.router, prefix="/api/v1/student", tags=["student"])
app.include_router(announcements.router, prefix="/api/v1/announcements", tags=["announcements"])
app.include_router(live_classes.router, prefix="/api/v1/live-classes", tags=["live-classes"])
app.include_router(calendar.router, prefix="/api/v1/calendar", tags=["calendar"])
app.include_router(metered.router, prefix="/api/v1/metered", tags=["metered"])

# Mount uploads directory for serving static files
uploads_dir = Path(__file__).resolve().parent.parent / "uploads"
uploads_dir.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")


@app.get("/api/v1/notifications", response_model=list[schemas.DashboardNotificationItem], tags=["dashboard"])
def list_notifications_alias(
    db=Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    # Log incoming request details for debugging
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"[Notifications] User authenticated: {current_user.id}, email: {current_user.email}, org_id: {current_user.organization_id}")
    
    organization = organization_service.get_organization_by_id(db, current_user.organization_id)
    if not organization:
        logger.warning(f"[Notifications] Organization not found for user {current_user.id}")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    
    logger.info(f"[Notifications] Fetching notifications for user {current_user.id}")
    notifications = dashboard_service.list_user_notifications(db, current_user)
    logger.info(f"[Notifications] Found {len(notifications)} notifications for user {current_user.id}")
    return notifications


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

