"""add body_html to email_logs

Revision ID: zz6ff7gg8hh9
Revises: zz5ee6ff7gg8
Create Date: 2026-05-11

"""
from alembic import op
import sqlalchemy as sa

revision = "zz6ff7gg8hh9"
down_revision = "zz5ee6ff7gg8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS body_html TEXT")


def downgrade() -> None:
    op.execute("ALTER TABLE email_logs DROP COLUMN IF EXISTS body_html")
