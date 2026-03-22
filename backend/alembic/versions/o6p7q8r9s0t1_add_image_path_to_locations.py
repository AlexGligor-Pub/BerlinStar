"""add_image_path_to_locations

Revision ID: o6p7q8r9s0t1
Revises: n5o6p7q8r9s0
Create Date: 2026-03-22

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'o6p7q8r9s0t1'
down_revision: Union[str, None] = 'n5o6p7q8r9s0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('locations', sa.Column('image_path', sa.String(500), nullable=True))


def downgrade() -> None:
    op.drop_column('locations', 'image_path')
