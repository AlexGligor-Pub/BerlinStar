"""add_general_settings

Revision ID: y6z0a1b2c3d4
Revises: 9342f270bc97
Create Date: 2026-04-02 00:00:00.000000

"""
from __future__ import annotations
from alembic import op


revision = 'y6z0a1b2c3d4'
down_revision = '9342f270bc97'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS general_settings (
            id SERIAL PRIMARY KEY,
            account_id INTEGER NOT NULL UNIQUE REFERENCES accounts(id),
            use_factura BOOLEAN NOT NULL DEFAULT TRUE,
            use_aviz BOOLEAN NOT NULL DEFAULT TRUE
        )
    """)


def downgrade() -> None:
    op.drop_table('general_settings')
