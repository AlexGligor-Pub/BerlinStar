"""add activeaza_fisa_de_lucru flag to general_settings

Revision ID: fdl_002
Revises: fdl_001
Create Date: 2026-05-25 20:30:00.000000

"""
from __future__ import annotations
from alembic import op


revision = "fdl_002"
down_revision = "fdl_001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE general_settings
        ADD COLUMN IF NOT EXISTS activeaza_fisa_de_lucru BOOLEAN NOT NULL DEFAULT FALSE
    """)


def downgrade() -> None:
    op.execute("ALTER TABLE general_settings DROP COLUMN IF EXISTS activeaza_fisa_de_lucru")
