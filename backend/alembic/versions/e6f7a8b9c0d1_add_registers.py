"""add_registers

Revision ID: e6f7a8b9c0d1
Revises: e5f6a7b8c9d0
Create Date: 2026-03-22 20:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'e6f7a8b9c0d1'
down_revision: Union[str, None] = 'e5f6a7b8c9d0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'registers',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('account_id', sa.Integer(), nullable=False),
        sa.Column('type', sa.String(50), nullable=False),
        sa.Column('serie', sa.String(50), nullable=False),
        sa.Column('numar', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['account_id'], ['accounts.id'], name=op.f('fk_registers_account_id_accounts')),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_registers')),
    )
    op.create_index('ix_registers_account_id_is_deleted_id', 'registers', ['account_id', 'is_deleted', 'id'])


def downgrade() -> None:
    op.drop_index('ix_registers_account_id_is_deleted_id', table_name='registers')
    op.drop_table('registers')
