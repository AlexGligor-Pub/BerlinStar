"""add_is_locked_to_accounts

Revision ID: n5o6p7q8r9s0
Revises: m4n5o6p7q8r9
Create Date: 2026-03-22

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'n5o6p7q8r9s0'
down_revision: Union[str, None] = 'm4n5o6p7q8r9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('accounts', sa.Column('is_locked', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('accounts', sa.Column('locked_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('accounts', 'locked_at')
    op.drop_column('accounts', 'is_locked')
