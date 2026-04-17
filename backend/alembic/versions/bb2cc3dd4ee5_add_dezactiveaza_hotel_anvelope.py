"""add_dezactiveaza_hotel_anvelope

Revision ID: bb2cc3dd4ee5
Revises: aa1bb2cc3dd4
Create Date: 2026-04-17 00:00:00.000000

"""
from __future__ import annotations
from alembic import op
import sqlalchemy as sa


revision = "bb2cc3dd4ee5"
down_revision = "aa1bb2cc3dd4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "general_settings",
        sa.Column("dezactiveaza_hotel_anvelope", sa.Boolean(), nullable=False, server_default="false"),
    )


def downgrade() -> None:
    op.drop_column("general_settings", "dezactiveaza_hotel_anvelope")
