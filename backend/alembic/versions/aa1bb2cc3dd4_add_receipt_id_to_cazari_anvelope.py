"""add_receipt_id_to_cazari_anvelope

Revision ID: aa1bb2cc3dd4
Revises: z7a8b9c0d1e2
Create Date: 2026-04-17 00:00:00.000000

"""
from __future__ import annotations
from alembic import op
import sqlalchemy as sa


revision = "aa1bb2cc3dd4"
down_revision = "z7a8b9c0d1e2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "cazari_anvelope",
        sa.Column("receipt_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_cazari_anvelope_receipt_id",
        "cazari_anvelope",
        "receipts",
        ["receipt_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_cazari_anvelope_receipt_id", "cazari_anvelope", ["receipt_id"])


def downgrade() -> None:
    op.drop_index("ix_cazari_anvelope_receipt_id", table_name="cazari_anvelope")
    op.drop_constraint("fk_cazari_anvelope_receipt_id", "cazari_anvelope", type_="foreignkey")
    op.drop_column("cazari_anvelope", "receipt_id")
