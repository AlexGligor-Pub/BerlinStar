"""add_afiseaza_tehnician_deviz

Revision ID: b3c4d5e6f7a8
Revises: y6z0a1b2c3d4
Create Date: 2026-04-08 00:00:00.000000

"""
from __future__ import annotations
from alembic import op
import sqlalchemy as sa


revision = 'b3c4d5e6f7a8'
down_revision = 'y6z0a1b2c3d4'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'general_settings',
        sa.Column('afiseaza_tehnician_deviz', sa.Boolean(), nullable=False, server_default='false')
    )


def downgrade() -> None:
    op.drop_column('general_settings', 'afiseaza_tehnician_deviz')
