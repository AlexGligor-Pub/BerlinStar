"""add fdl_finalized_at to receipts

Revision ID: zzb1kk2ll3mm4
Revises: marci_global_002
Create Date: 2026-05-27 00:00:00.000000

"""
from __future__ import annotations
from alembic import op
import sqlalchemy as sa


revision = "zzb1kk2ll3mm4"
down_revision = "marci_global_002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "receipts",
        sa.Column("fdl_finalized_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("receipts", "fdl_finalized_at")
