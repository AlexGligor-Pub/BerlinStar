"""add_disclaimer_id_to_locations

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a8
Create Date: 2026-03-22 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, None] = 'b2c3d4e5f6a8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('locations', sa.Column('disclaimer_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'fk_locations_disclaimer_id_disclaimers',
        'locations', 'disclaimers',
        ['disclaimer_id'], ['id'],
        ondelete='SET NULL',
    )


def downgrade() -> None:
    op.drop_constraint('fk_locations_disclaimer_id_disclaimers', 'locations', type_='foreignkey')
    op.drop_column('locations', 'disclaimer_id')
