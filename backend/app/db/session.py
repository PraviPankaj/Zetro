from collections.abc import Generator

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import get_settings

settings = get_settings()

database_url = settings.database_url
# Render and many hosts still emit postgres://; normalize and pin psycopg2
# (we install psycopg2-binary — not psycopg v3).
if database_url.startswith("postgres://"):
    database_url = "postgresql+psycopg2://" + database_url[len("postgres://") :]
elif database_url.startswith("postgresql+psycopg://"):
    database_url = "postgresql+psycopg2://" + database_url[len("postgresql+psycopg://") :]
elif database_url.startswith("postgresql://"):
    database_url = "postgresql+psycopg2://" + database_url[len("postgresql://") :]

connect_args = {"check_same_thread": False} if database_url.startswith("sqlite") else {}
engine = create_engine(database_url, connect_args=connect_args, future=True)

if database_url.startswith("sqlite"):

    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):  # noqa: ARG001
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
