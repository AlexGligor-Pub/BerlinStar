"""merge_disclaimers_and_timestamps

Revision ID: b2c3d4e5f6a8
Revises: 5e6f7a8b9c0d, a1b2c3d4e5f6
Create Date: 2026-03-22 17:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b2c3d4e5f6a8'
down_revision: Union[str, tuple] = ('5e6f7a8b9c0d', 'a1b2c3d4e5f6')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
