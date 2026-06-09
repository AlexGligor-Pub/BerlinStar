"""add hour-based leave types (invoire / overtime / recuperare) + time/hours columns

Revision ID: leavehrs_001
Revises: leavedet_001
Create Date: 2026-06-09 00:00:00.000000

"""
from __future__ import annotations
from alembic import op


revision = "leavehrs_001"
down_revision = "leavedet_001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Valorile noi de enum se adauga in autocommit_block: in PostgreSQL
    # `ALTER TYPE ... ADD VALUE` nu poate fi folosit in aceeasi tranzactie
    # in care valoarea ar fi si utilizata; izolarea pe autocommit e robusta
    # pe toate versiunile PG.
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE leave_type ADD VALUE IF NOT EXISTS 'Invoire'")
        op.execute("ALTER TYPE leave_type ADD VALUE IF NOT EXISTS 'Overtime'")
        op.execute("ALTER TYPE leave_type ADD VALUE IF NOT EXISTS 'Recuperare Ore invoire'")

    # Coloane pentru tipurile masurate in ore (single-day).
    op.execute("ALTER TABLE leaves ADD COLUMN IF NOT EXISTS start_time TIME")
    op.execute("ALTER TABLE leaves ADD COLUMN IF NOT EXISTS end_time TIME")
    op.execute("ALTER TABLE leaves ADD COLUMN IF NOT EXISTS hours NUMERIC(5,2)")


def downgrade() -> None:
    op.execute("ALTER TABLE leaves DROP COLUMN IF EXISTS hours")
    op.execute("ALTER TABLE leaves DROP COLUMN IF EXISTS end_time")
    op.execute("ALTER TABLE leaves DROP COLUMN IF EXISTS start_time")
    # Valorile de enum nu se elimina la downgrade — PostgreSQL nu suporta
    # eliminarea simpla a unei valori dintr-un tip enum existent.
