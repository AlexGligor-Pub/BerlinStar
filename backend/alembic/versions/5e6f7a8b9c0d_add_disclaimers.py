"""add_disclaimers

Revision ID: 5e6f7a8b9c0d
Revises: 4d5e6f7a8b9c, a1b2c3d4e5f7
Create Date: 2026-03-22 16:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '5e6f7a8b9c0d'
down_revision: Union[str, tuple] = ('4d5e6f7a8b9c', 'a1b2c3d4e5f7')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'disclaimers',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('account_id', sa.Integer(), nullable=False),
        sa.Column('text', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['account_id'], ['accounts.id'], name=op.f('fk_disclaimers_account_id_accounts')),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_disclaimers')),
    )
    op.create_index('ix_disclaimers_account_id_is_deleted_id', 'disclaimers', ['account_id', 'is_deleted', 'id'])


def downgrade() -> None:
    op.drop_index('ix_disclaimers_account_id_is_deleted_id', table_name='disclaimers')
    op.drop_table('disclaimers')
