"""add FDL (Fisa de Lucru) fields to receipts

Revision ID: fdl_001
Revises: leaves_001
Create Date: 2026-05-25 20:00:00.000000

"""
from __future__ import annotations
from alembic import op


revision = "fdl_001"
down_revision = "leaves_001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE receipts ADD COLUMN IF NOT EXISTS constatari TEXT")
    op.execute("ALTER TABLE receipts ADD COLUMN IF NOT EXISTS sugestii TEXT")
    op.execute("ALTER TABLE receipts ADD COLUMN IF NOT EXISTS timp_estimat_ore NUMERIC(6, 2)")


def downgrade() -> None:
    op.execute("ALTER TABLE receipts DROP COLUMN IF EXISTS timp_estimat_ore")
    op.execute("ALTER TABLE receipts DROP COLUMN IF EXISTS sugestii")
    op.execute("ALTER TABLE receipts DROP COLUMN IF EXISTS constatari")
