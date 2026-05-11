"""add_smtp_to_global_settings

Revision ID: zz3cc4dd5ee6
Revises: zz2bb3cc4dd5
Create Date: 2026-05-11 00:00:00.000000

"""
from __future__ import annotations
from alembic import op


revision = 'zz3cc4dd5ee6'
down_revision = 'zz2bb3cc4dd5'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE global_settings ADD COLUMN IF NOT EXISTS smtp_host VARCHAR(255)")
    op.execute("ALTER TABLE global_settings ADD COLUMN IF NOT EXISTS smtp_port INTEGER DEFAULT 587")
    op.execute("ALTER TABLE global_settings ADD COLUMN IF NOT EXISTS smtp_user VARCHAR(255)")
    op.execute("ALTER TABLE global_settings ADD COLUMN IF NOT EXISTS smtp_password VARCHAR(500)")
    op.execute("ALTER TABLE global_settings ADD COLUMN IF NOT EXISTS smtp_from_name VARCHAR(255)")
    op.execute("ALTER TABLE global_settings ADD COLUMN IF NOT EXISTS smtp_from_address VARCHAR(255)")
    op.execute("ALTER TABLE global_settings ADD COLUMN IF NOT EXISTS smtp_use_tls BOOLEAN NOT NULL DEFAULT TRUE")
    op.execute("ALTER TABLE global_settings ADD COLUMN IF NOT EXISTS smtp_enabled BOOLEAN NOT NULL DEFAULT FALSE")


def downgrade() -> None:
    for col in ["smtp_host", "smtp_port", "smtp_user", "smtp_password",
                "smtp_from_name", "smtp_from_address", "smtp_use_tls", "smtp_enabled"]:
        op.execute(f"ALTER TABLE global_settings DROP COLUMN IF EXISTS {col}")
