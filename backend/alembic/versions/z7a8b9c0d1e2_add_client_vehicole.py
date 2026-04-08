"""add_client_vehicole

Revision ID: z7a8b9c0d1e2
Revises: y6z0a1b2c3d4
Create Date: 2026-04-06 00:00:00.000000

"""
from __future__ import annotations
from alembic import op


revision = 'z7a8b9c0d1e2'
down_revision = 'y6z0a1b2c3d4'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS client_vehicole (
            id SERIAL PRIMARY KEY,
            account_id INTEGER NOT NULL REFERENCES accounts(id),
            client_id INTEGER NOT NULL REFERENCES clienti(id) ON DELETE CASCADE,
            numar_masina VARCHAR(50) NOT NULL,
            marca VARCHAR(100),
            model VARCHAR(100),
            numar_kilometrii INTEGER,
            vin VARCHAR(17),
            observatii TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ,
            is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
            deleted_at TIMESTAMPTZ
        )
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_client_vehicole_account_client
        ON client_vehicole (account_id, client_id, is_deleted)
    """)


def downgrade() -> None:
    op.drop_table('client_vehicole')
