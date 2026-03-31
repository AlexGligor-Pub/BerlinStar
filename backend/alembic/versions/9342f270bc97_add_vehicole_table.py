"""add_vehicole_table

Revision ID: 9342f270bc97
Revises: x5y6z0a1b2c3
Create Date: 2026-03-31 20:24:00.000000

"""
from __future__ import annotations
from alembic import op
import sqlalchemy as sa


revision = '9342f270bc97'
down_revision = 'x5y6z0a1b2c3'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS vehicole (
            id SERIAL PRIMARY KEY,
            account_id INTEGER NOT NULL REFERENCES accounts(id),
            receipt_id INTEGER NOT NULL UNIQUE REFERENCES receipts(id) ON DELETE CASCADE,
            numar_masina VARCHAR(50) NOT NULL,
            marca VARCHAR(100),
            model VARCHAR(100),
            numar_kilometrii INTEGER,
            vin VARCHAR(17),
            observatii TEXT,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            updated_at TIMESTAMP WITH TIME ZONE,
            is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
            deleted_at TIMESTAMP WITH TIME ZONE
        )
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_vehicole_account_id ON vehicole (account_id)
    """)


def downgrade() -> None:
    op.drop_table('vehicole')
