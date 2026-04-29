"""add_location_id_to_cazari_anvelope

Revision ID: cc3dd4ee5ff6
Revises: bb2cc3dd4ee5
Create Date: 2026-04-17 00:00:00.000000

"""
from __future__ import annotations
from alembic import op
import sqlalchemy as sa


revision = "cc3dd4ee5ff6"
down_revision = "bb2cc3dd4ee5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "cazari_anvelope",
        sa.Column("location_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_cazari_anvelope_location_id",
        "cazari_anvelope", "locations",
        ["location_id"], ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_cazari_anvelope_location_id", "cazari_anvelope", ["location_id"])


def downgrade() -> None:
    op.drop_index("ix_cazari_anvelope_location_id", table_name="cazari_anvelope")
    op.drop_constraint("fk_cazari_anvelope_location_id", "cazari_anvelope", type_="foreignkey")
    op.drop_column("cazari_anvelope", "location_id")
