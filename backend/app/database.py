import logging
from time import sleep
from urllib.parse import urlparse
from typing import Generator, Optional

from sqlalchemy import create_engine, inspect, text, event
from sqlalchemy.exc import OperationalError, ProgrammingError, InvalidRequestError, TimeoutError as SQLTimeoutError
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.pool import NullPool

from app.config import settings

logger = logging.getLogger(__name__)

# Create engine with improved connection handling
def _create_engine():
    """Create database engine with comprehensive error handling and logging."""
    try:
        engine = create_engine(
            settings.database_url,
            future=True,
            echo=False,
            pool_pre_ping=True,                           # Detect stale/dropped connections
            pool_recycle=settings.database_pool_recycle,  # Recycle connections periodically
            pool_size=settings.database_pool_size,
            max_overflow=settings.database_max_overflow,
            pool_timeout=settings.database_pool_timeout,
            connect_args={
                "connect_timeout": settings.database_connect_timeout,
                "keepalives": 1,
                "keepalives_idle": 30,
                "keepalives_interval": 10,
                "keepalives_count": 5,
            },
        )
        
        # Test the engine connection
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        
        logger.info("Database engine created successfully")
        return engine
    except Exception as exc:
        logger.error(f"Failed to create database engine: {exc}", exc_info=True)
        raise


try:
    engine = _create_engine()
except Exception as e:
    logger.error(f"Database engine initialization failed: {e}")
    # Create a fallback engine that will fail gracefully when used
    engine = create_engine(settings.database_url, poolclass=NullPool)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
Base = declarative_base()


def get_db() -> Generator:
    """Get database session, handling connection errors gracefully."""
    db = SessionLocal()
    try:
        yield db
    finally:
        try:
            db.close()
        except Exception as e:
            logger.warning(f"Error closing database session: {e}")


def test_db_connection() -> tuple[bool, str]:
    """
    Test database connectivity without initializing schema.
    Returns: (success: bool, message: str)
    """
    try:
        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1"))
            _ = result.fetchone()
        return True, "Database connection successful"
    except OperationalError as e:
        msg = f"Database connection failed: {e.orig}"
        logger.error(msg)
        return False, msg
    except SQLTimeoutError as e:
        msg = f"Database connection timeout: {e}"
        logger.error(msg)
        return False, msg
    except Exception as e:
        msg = f"Unexpected database error: {e}"
        logger.error(msg, exc_info=True)
        return False, msg


def init_db() -> None:
    """
    Initialize database schema and seed data.
    Performs connection validation first, then retries initialization with exponential backoff.
    """
    from app import models  # noqa: F401

    host = _database_host()
    logger.info("=" * 80)
    logger.info("STARTING DATABASE INITIALIZATION")
    logger.info(f"Database Host: {host or 'Unknown'}")
    logger.info(f"Retries: {settings.database_init_retries}, Delay: {settings.database_init_retry_delay_seconds}s")
    logger.info("=" * 80)

    # Step 1: Validate connection
    success, msg = test_db_connection()
    logger.info(f"✓ Connection test: {msg}")
    if not success:
        raise RuntimeError(
            f"Cannot initialize database: {msg}. "
            f"Please ensure: 1) Database server is running, 2) Connection URL is correct, "
            f"3) Firewall/network allows connection to {host or 'database host'}"
        )

    # Step 2: Create schema with retries
    logger.info("Creating database schema (if tables don't exist)...")
    _retry_database_action(
        Base.metadata.create_all,
        bind=engine,
        retries=settings.database_init_retries,
        delay_seconds=settings.database_init_retry_delay_seconds,
    )
    logger.info("✓ Schema creation completed")

    # Step 3: Apply missing columns
    logger.info("Checking for missing columns in existing tables...")
    _retry_database_action(
        _apply_missing_columns_to_existing_tables,
        retries=settings.database_init_retries,
        delay_seconds=settings.database_init_retry_delay_seconds,
    )
    logger.info("✓ Column migration completed")

    # Step 4: Auto-verify users
    logger.info("Auto-verifying existing users...")
    _retry_database_action(
        _auto_verify_existing_users,
        retries=settings.database_init_retries,
        delay_seconds=settings.database_init_retry_delay_seconds,
    )
    logger.info("✓ User verification completed")

    # Step 5: Seed default courses
    logger.info("Seeding default courses for organizations...")
    _retry_database_action(
        _seed_default_excel_courses,
        retries=settings.database_init_retries,
        delay_seconds=settings.database_init_retry_delay_seconds,
    )
    logger.info("✓ Default courses seeded")

    logger.info("=" * 80)
    logger.info("✅ DATABASE INITIALIZATION COMPLETED SUCCESSFULLY")
    logger.info("   - Schema created/verified")
    logger.info("   - Columns updated")
    logger.info("   - Users verified")
    logger.info("   - Default courses seeded")
    logger.info("   Database is ready for use")
    logger.info("=" * 80)




def _retry_database_action(action, *args, retries: int = 3, delay_seconds: int = 2, **kwargs) -> None:
    """
    Retry a database action with exponential backoff.
    Handles various connection and operational errors.
    """
    action_name = getattr(action, "__name__", str(action))
    
    for attempt in range(1, retries + 1):
        try:
            action(*args, **kwargs)
            logger.info(f"Database action '{action_name}' succeeded on attempt {attempt}/{retries}")
            return
        except (OperationalError, SQLTimeoutError, InvalidRequestError) as exc:
            error_msg = str(exc.orig) if hasattr(exc, 'orig') else str(exc)
            logger.warning(
                f"Database action '{action_name}' failed on attempt {attempt}/{retries}: {error_msg}",
                exc_info=False
            )
            if attempt == retries:
                logger.error(f"All {retries} attempts failed for '{action_name}'. Last error: {error_msg}")
                raise RuntimeError(
                    f"Database operation failed after {retries} attempts: {action_name}. "
                    f"Error: {error_msg}. Please check database connectivity."
                ) from exc
            logger.info(f"Retrying in {delay_seconds} second(s)...")
            sleep(delay_seconds)
        except Exception as exc:
            logger.error(f"Unexpected error in database action '{action_name}': {exc}", exc_info=True)
            raise


def _database_host() -> str | None:
    try:
        parsed = urlparse(settings.database_url.replace("postgresql+psycopg://", "postgresql://", 1))
        return parsed.hostname
    except Exception:
        return None


def _auto_verify_existing_users() -> None:
    """Auto-verify all unverified users since the app has no email verification flow."""
    db = SessionLocal()
    try:
        from app.models import User
        unverified = db.query(User).filter(User.is_verified == False).all()  # noqa: E712
        for user in unverified:
            user.is_verified = True
            db.add(user)
        if unverified:
            db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()


def _seed_default_excel_courses() -> None:
    db = SessionLocal()
    try:
        from app.models import Organization
        from app.services.courses import ensure_default_excel_course

        organizations = db.query(Organization).filter(Organization.is_deleted == False).all()
        for organization in organizations:
            try:
                ensure_default_excel_course(db, organization)
            except Exception:
                db.rollback()
                raise
    finally:
        db.close()


def _apply_missing_columns_to_existing_tables() -> None:
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())
    # Avoid SQLAlchemy's dependency sort here because some tables intentionally
    # reference each other (for example users <-> departments), and we only need
    # a stable list of existing tables to add missing columns.
    metadata_tables = sorted(
        (table for table in Base.metadata.tables.values() if table.name in existing_tables),
        key=lambda table: table.name,
    )

    if not metadata_tables:
        return

    with engine.begin() as connection:
        for table in metadata_tables:
            existing_columns = {column["name"].lower() for column in inspector.get_columns(table.name)}
            for column in table.columns:
                if column.name.lower() in existing_columns:
                    continue

                sql_type = column.type.compile(dialect=engine.dialect)
                ddl = f"ALTER TABLE {table.name} ADD COLUMN {column.name} {sql_type}"

                if column.server_default is not None and getattr(column.server_default, 'arg', None) is not None:
                    default_arg = column.server_default.arg
                    if isinstance(default_arg, str):
                        if default_arg.startswith("'") and default_arg.endswith("'"):
                            default_value = default_arg
                        else:
                            default_value = "'" + default_arg.replace("'", "''") + "'"
                    elif isinstance(default_arg, bool):
                        default_value = "TRUE" if default_arg else "FALSE"
                    else:
                        default_value = str(default_arg)
                    ddl += f" DEFAULT {default_value}"

                if not column.nullable and column.server_default is None and not column.primary_key:
                    # If the column is non-nullable without a default, adding it will fail unless the table is empty.
                    ddl += " NULL"

                try:
                    connection.execute(text(ddl))
                except ProgrammingError as exc:
                    message = str(exc).lower()
                    if "duplicate column" in message or "already exists" in message:
                        continue
                    raise
