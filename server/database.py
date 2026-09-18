from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import declarative_base, sessionmaker
from .config import settings
import logging

logger = logging.getLogger(__name__)

# Normalize postgres:// to postgresql:// for SQLAlchemy compatibility
db_url = settings.DATABASE_URL
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

# Connect args & pooling based on database dialect
if db_url.startswith("sqlite"):
    engine = create_engine(
        db_url,
        connect_args={"check_same_thread": False},
    )
else:
    engine = create_engine(
        db_url,
        pool_pre_ping=True,
        pool_size=10,
        max_overflow=20,
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def migrate_db():
    """Safely apply incremental schema migrations (e.g. add user_id column)."""
    try:
        inspector = inspect(engine)
        tables = inspector.get_table_names()

        # Check chapters.user_id
        if "chapters" in tables:
            chap_cols = [c["name"] for c in inspector.get_columns("chapters")]
            if "user_id" not in chap_cols:
                with engine.connect() as conn:
                    conn.execute(text("ALTER TABLE chapters ADD COLUMN user_id INTEGER"))
                    conn.commit()
                logger.info("Migrated chapters table: added user_id column")

        # Check user_progress.user_id
        if "user_progress" in tables:
            prog_cols = [c["name"] for c in inspector.get_columns("user_progress")]
            if "user_id" not in prog_cols:
                with engine.connect() as conn:
                    conn.execute(text("ALTER TABLE user_progress ADD COLUMN user_id INTEGER"))
                    conn.commit()
                logger.info("Migrated user_progress table: added user_id column")

        # Check questions.question_type
        if "questions" in tables:
            q_cols = [c["name"] for c in inspector.get_columns("questions")]
            if "question_type" not in q_cols:
                with engine.connect() as conn:
                    conn.execute(text("ALTER TABLE questions ADD COLUMN question_type VARCHAR(50) DEFAULT 'multiple_choice'"))
                    conn.commit()
                logger.info("Migrated questions table: added question_type column")
    except Exception as e:
        logger.warning(f"Database migration check encountered an issue: {e}")
