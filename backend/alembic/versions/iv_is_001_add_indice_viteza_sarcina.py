"""add indice_viteza + indice_sarcina to anvelope/montaj_roti + show toggles

Revision ID: iv_is_001
Revises: zza0jj1kk2ll3
Create Date: 2026-05-23 12:00:00.000000

"""
from __future__ import annotations
from alembic import op
import sqlalchemy as sa


revision = "iv_is_001"
down_revision = "zza0jj1kk2ll3"
branch_labels = None
depends_on = None


_NEW_TOGGLE_COLUMNS = [
    "montare_roti_show_indice_viteza",
    "montare_roti_show_indice_sarcina",
    "hotel_anvelope_show_indice_viteza",
    "hotel_anvelope_show_indice_sarcina",
]


def upgrade() -> None:
    op.add_column("anvelope", sa.Column("indice_viteza", sa.String(4), nullable=True))
    op.add_column("anvelope", sa.Column("indice_sarcina", sa.Integer(), nullable=True))
    op.add_column("montaj_roti", sa.Column("indice_viteza", sa.String(4), nullable=True))
    op.add_column("montaj_roti", sa.Column("indice_sarcina", sa.Integer(), nullable=True))

    for col in _NEW_TOGGLE_COLUMNS:
        op.add_column(
            "general_settings",
            sa.Column(col, sa.Boolean(), nullable=False, server_default=sa.text("false")),
        )


def downgrade() -> None:
    for col in reversed(_NEW_TOGGLE_COLUMNS):
        op.drop_column("general_settings", col)

    op.drop_column("montaj_roti", "indice_sarcina")
    op.drop_column("montaj_roti", "indice_viteza")
    op.drop_column("anvelope", "indice_sarcina")
    op.drop_column("anvelope", "indice_viteza")
