"""Create tables, apply lightweight migrations and seed defaults.

Run against production once after deploying a schema change:

    DATABASE_URL=postgresql://... python -m app.db.init
"""

from app.db.migrate import run_migrations
from app.db.seed import seed_database
from app.db.session import SessionLocal, engine
from app.models import Base


def init_database() -> None:
    Base.metadata.create_all(bind=engine)
    run_migrations(engine)
    db = SessionLocal()
    try:
        seed_database(db)
    finally:
        db.close()


if __name__ == "__main__":
    init_database()
    print("Database ready.")
