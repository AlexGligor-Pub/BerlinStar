"""add montare_roti per-position images to global_settings

Revision ID: zz9ii0jj1kk2
Revises: zz8hh9ii0jj1
Create Date: 2026-05-14 00:00:00.000000

"""
from __future__ import annotations
from alembic import op
import sqlalchemy as sa


revision = "zz9ii0jj1kk2"
down_revision = "zz8hh9ii0jj1"
branch_labels = None
depends_on = None


_COLUMNS = [
    "montare_stanga_fata_image_path",
    "montare_dreapta_fata_image_path",
    "montare_stanga_spate_image_path",
    "montare_dreapta_spate_image_path",
    "montare_rezerva_image_path",
    "montare_nespecificat_image_path",
]


def upgrade() -> None:
    for col in _COLUMNS:
        op.add_column("global_settings", sa.Column(col, sa.String(500), nullable=True))


def downgrade() -> None:
    for col in reversed(_COLUMNS):
        op.drop_column("global_settings", col)
