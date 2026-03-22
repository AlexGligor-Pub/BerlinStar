"""redesign_registers

Revision ID: f7a8b9c0d1e2
Revises: e6f7a8b9c0d1
Create Date: 2026-03-22 21:00:00.000000

Drop old single-type registers table and replace with one record
per register that holds serie/numar for all four document types.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f7a8b9c0d1e2'
down_revision: Union[str, None] = 'e6f7a8b9c0d1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_index('ix_registers_account_id_is_deleted_id', table_name='registers')
    op.drop_table('registers')

    op.create_table(
        'registers',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('account_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('deviz_serie', sa.String(50), nullable=False, server_default=''),
        sa.Column('deviz_numar', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('factura_serie', sa.String(50), nullable=False, server_default=''),
        sa.Column('factura_numar', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('chitanta_serie', sa.String(50), nullable=False, server_default=''),
        sa.Column('chitanta_numar', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('aviz_serie', sa.String(50), nullable=False, server_default=''),
        sa.Column('aviz_numar', sa.Integer(), nullable=False, server_default='0'),
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
