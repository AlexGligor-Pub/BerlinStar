"""add_hotel_montare_image

Revision ID: zz2bb3cc4dd5
Revises: zz1aa2bb3cc4
Create Date: 2026-05-02 00:00:00.000000

"""
from __future__ import annotations
from alembic import op


revision = 'zz2bb3cc4dd5'
down_revision = 'zz1aa2bb3cc4'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE global_settings
        ADD COLUMN IF NOT EXISTS hotel_montare_image_path VARCHAR(500)
    """)


def downgrade() -> None:
    op.execute("ALTER TABLE global_settings DROP COLUMN IF EXISTS hotel_montare_image_path")
