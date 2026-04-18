from time import sleep
from typing import Generator

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.exc import OperationalError, ProgrammingError
from sqlalchemy.orm import declarative_base, sessionmaker

from app.config import settings

engine = create_engine(
    settings.database_url,
    future=True,
    echo=False,
    pool_pre_ping=True,       # Detect stale/dropped connections (Neon cold start)
    pool_recycle=300,          # Recycle connections every 5 min to avoid Neon timeouts
    pool_size=5,
    max_overflow=10,
    connect_args={"connect_timeout": 30},  # 30s timeout instead of hanging forever
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
Base = declarative_base()


def get_db() -> Generator:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    from app import models  # noqa: F401

    _retry_database_action(Base.metadata.create_all, bind=engine)
    _retry_database_action(_apply_missing_columns_to_existing_tables)
    _retry_database_action(_auto_verify_existing_users)
    _retry_database_action(_seed_default_excel_courses)


def _retry_database_action(action, *args, retries: int = 3, delay_seconds: int = 2, **kwargs) -> None:
    for attempt in range(1, retries + 1):
        try:
            action(*args, **kwargs)
            return
        except OperationalError:
            if attempt == retries:
                raise
            sleep(delay_seconds)
        except Exception:
            raise


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
