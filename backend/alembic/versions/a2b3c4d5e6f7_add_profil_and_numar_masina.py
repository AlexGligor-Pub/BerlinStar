"""add_profil_and_numar_masina

Revision ID: a2b3c4d5e6f7
Revises: z7a8b9c0d1e2
Create Date: 2026-04-06 00:00:00.000000

"""
from __future__ import annotations
from alembic import op


revision = 'a2b3c4d5e6f7'
down_revision = 'z7a8b9c0d1e2'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS profiluri_anvelope (
            id SERIAL PRIMARY KEY,
            account_id INTEGER NOT NULL REFERENCES accounts(id),
            valoare VARCHAR(200) NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ,
            is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
            deleted_at TIMESTAMPTZ
        )
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_profiluri_anvelope_account_id_is_deleted_id
        ON profiluri_anvelope (account_id, is_deleted, id)
    """)
    op.execute("""
        ALTER TABLE anvelope
        ADD COLUMN IF NOT EXISTS profil_id INTEGER REFERENCES profiluri_anvelope(id) ON DELETE SET NULL
    """)
    op.execute("""
        ALTER TABLE cazari_anvelope
        ADD COLUMN IF NOT EXISTS numar_masina VARCHAR(50)
    """)


def downgrade() -> None:
    op.execute("ALTER TABLE cazari_anvelope DROP COLUMN IF EXISTS numar_masina")
    op.execute("ALTER TABLE anvelope DROP COLUMN IF EXISTS profil_id")
    op.drop_table('profiluri_anvelope')
