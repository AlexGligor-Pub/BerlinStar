"""add fdl_disclaimer_text to general_settings

Revision ID: fdl_003
Revises: fdl_002
Create Date: 2026-05-25 21:00:00.000000

"""
from __future__ import annotations
from alembic import op


revision = "fdl_003"
down_revision = "fdl_002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE general_settings ADD COLUMN IF NOT EXISTS fdl_disclaimer_text TEXT")


def downgrade() -> None:
    op.execute("ALTER TABLE general_settings DROP COLUMN IF EXISTS fdl_disclaimer_text")
