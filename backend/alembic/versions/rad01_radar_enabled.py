"""comutator pentru Radar AI

Revision ID: rad01radar
Revises: imp05loc
Create Date: 2026-09-22 09:00:00.000000

Radar AI se poate stinge din AdminV2 pentru toata platforma: nu mai apare in
meniu, iar rutele /api/radar/* raspund 404. Implicit ramane pornit, ca
instalarile existente sa nu se schimbe la migrare.
"""
from alembic import op
import sqlalchemy as sa


revision = "rad01radar"
down_revision = "imp05loc"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "global_settings",
        sa.Column("radar_enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
    )


def downgrade() -> None:
    op.drop_column("global_settings", "radar_enabled")
