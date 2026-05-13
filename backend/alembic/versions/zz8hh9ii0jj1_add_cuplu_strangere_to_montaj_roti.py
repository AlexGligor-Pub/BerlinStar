"""add cuplu_strangere to montaj_roti

Revision ID: zz8hh9ii0jj1
Revises: zz7gg8hh9ii0
Create Date: 2026-05-13 00:00:00.000000

"""
from __future__ import annotations
from alembic import op
import sqlalchemy as sa


revision = "zz8hh9ii0jj1"
down_revision = "zz7gg8hh9ii0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "montaj_roti",
        sa.Column("cuplu_strangere", sa.Float(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("montaj_roti", "cuplu_strangere")
