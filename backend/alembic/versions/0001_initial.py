from alembic import op
import sqlalchemy as sa

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Tables are created via SQLAlchemy metadata.create_all on startup.
    # This revision documents the initial schema for Alembic history.
    pass


def downgrade() -> None:
    pass
