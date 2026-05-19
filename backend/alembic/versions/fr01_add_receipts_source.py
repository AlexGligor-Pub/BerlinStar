"""add source column to receipts

Revision ID: fr01_source
Revises: sub01abonam
Create Date: 2026-05-20 00:00:00.000000

"""
from __future__ import annotations
from alembic import op
import sqlalchemy as sa


revision = "fr01_source"
down_revision = "sub01abonam"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "receipts",
        sa.Column("source", sa.String(20), nullable=True),
    )
    op.execute("UPDATE receipts SET source='reception' WHERE source IS NULL")
    op.alter_column(
        "receipts",
        "source",
        nullable=False,
        server_default="reception",
    )
    op.create_index(
        "ix_receipts_account_source_id",
        "receipts",
        ["account_id", "source", sa.text("id DESC")],
    )


def downgrade() -> None:
    op.drop_index("ix_receipts_account_source_id", table_name="receipts")
    op.drop_column("receipts", "source")
