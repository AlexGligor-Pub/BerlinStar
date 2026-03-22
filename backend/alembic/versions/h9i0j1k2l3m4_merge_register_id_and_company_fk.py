"""merge register_id and company_fk heads

Revision ID: h9i0j1k2l3m4
Revises: a8b9c0d1e2f3, g8h9i0j1k2l3
Create Date: 2026-03-22 23:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = 'h9i0j1k2l3m4'
down_revision: Union[str, tuple] = ('a8b9c0d1e2f3', 'g8h9i0j1k2l3')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
