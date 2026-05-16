"""merge dept and programari heads

Revision ID: mr06merge001
Revises: mr05dept001, mr05programari001
Create Date: 2026-05-16 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'mr06merge001'
down_revision: Union[str, tuple] = ('mr05dept001', 'mr05programari001')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
