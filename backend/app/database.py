"""Database engine and session configuration."""
import logging
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import sessionmaker, DeclarativeBase, Session
from typing import Generator

from app.config import settings

logger = logging.getLogger(__name__)

# SQLite connect args
connect_args = {"check_same_thread": False} if "sqlite" in settings.DATABASE_URL else {}

engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
    echo=False,
)

# SQLite WAL mode for better concurrency
@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_conn, connection_record):
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.close()


# SQLite auto-migration for new columns (safe: ignores if column exists)
_SQLITE_MIGRATIONS = [
    ("projects", "git_repo_url", "VARCHAR(500)"),
    ("projects", "git_default_branch", "VARCHAR(100)"),
    ("projects", "git_auto_merge", "BOOLEAN DEFAULT 0"),
]


def run_sqlite_auto_migrations():
    """Add new columns to existing SQLite tables without Alembic."""
    if "sqlite" not in settings.DATABASE_URL:
        return
    try:
        with engine.connect() as conn:
            for table, column, col_type in _SQLITE_MIGRATIONS:
                try:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}"))
                    conn.commit()
                    logger.info("Auto-migrated: added %s.%s", table, column)
                except Exception:
                    pass  # Column already exists
    except Exception as e:
        logger.debug("SQLite auto-migration skipped: %s", e)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
