"""add_email_logs

Revision ID: zz5ee6ff7gg8
Revises: zz4dd5ee6ff7
Create Date: 2026-05-11 00:00:00.000000

"""
from __future__ import annotations
from alembic import op
import sqlalchemy as sa

revision = 'zz5ee6ff7gg8'
down_revision = 'zz4dd5ee6ff7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "email_logs",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("sent_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("account_id", sa.Integer(), sa.ForeignKey("accounts.id"), nullable=True),
        sa.Column("to_address", sa.String(255), nullable=False),
        sa.Column("scenario", sa.String(50), nullable=True),
        sa.Column("subject", sa.String(500), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("error_message", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("email_logs")
