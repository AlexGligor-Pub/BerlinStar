"""add_register_id_to_locations

Revision ID: a8b9c0d1e2f3
Revises: f7a8b9c0d1e2
Create Date: 2026-03-22 22:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a8b9c0d1e2f3'
down_revision: Union[str, None] = 'f7a8b9c0d1e2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('locations', sa.Column('register_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'fk_locations_register_id_registers',
        'locations', 'registers',
        ['register_id'], ['id'],
        ondelete='SET NULL',
    )


def downgrade() -> None:
    op.drop_constraint('fk_locations_register_id_registers', 'locations', type_='foreignkey')
    op.drop_column('locations', 'register_id')
