"""add show-field toggles for Montare Roti and Hotel Anvelope

Revision ID: mr_show_toggles_001
Revises: dot01_anvelope
Create Date: 2026-05-21 12:00:00.000000

"""
from __future__ import annotations
from alembic import op
import sqlalchemy as sa


revision = "mr_show_toggles_001"
down_revision = "dot01_anvelope"
branch_labels = None
depends_on = None


_NEW_COLUMNS = [
    "montare_roti_show_presiune",
    "montare_roti_show_marca",
    "montare_roti_show_profil",
    "montare_roti_show_dimensiune",
    "montare_roti_show_dot",
    "montare_roti_show_tip",
    "montare_roti_show_adancime",
    "montare_roti_show_cuplu",
    "hotel_anvelope_show_profil",
    "hotel_anvelope_show_dot",
    "hotel_anvelope_show_adancime",
    "hotel_anvelope_show_tip",
]


def upgrade() -> None:
    for col in _NEW_COLUMNS:
        op.add_column(
            "general_settings",
            sa.Column(col, sa.Boolean(), nullable=False, server_default=sa.text("true")),
        )


def downgrade() -> None:
    for col in reversed(_NEW_COLUMNS):
        op.drop_column("general_settings", col)
