"""add_global_settings

Revision ID: zz1aa2bb3cc4
Revises: z7a8b9c0d1e2
Create Date: 2026-05-01 00:00:00.000000

"""
from __future__ import annotations
from alembic import op


revision = 'zz1aa2bb3cc4'
down_revision = 'z7a8b9c0d1e2'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS global_settings (
            id SERIAL PRIMARY KEY,
            hotel_cazare_image_path VARCHAR(500),
            hotel_scoatere_image_path VARCHAR(500)
        )
    """)
    op.execute("INSERT INTO global_settings DEFAULT VALUES")


def downgrade() -> None:
    op.drop_table('global_settings')
