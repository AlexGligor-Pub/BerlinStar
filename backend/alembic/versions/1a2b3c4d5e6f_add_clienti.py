"""add_clienti

Revision ID: 1a2b3c4d5e6f
Revises: f5a6b7c8d9e0
Create Date: 2026-03-22 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '1a2b3c4d5e6f'
down_revision: Union[str, None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'clienti',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('account_id', sa.Integer(), nullable=False),
        sa.Column('tip', sa.String(length=10), nullable=False, server_default='fizic'),
        sa.Column('nume', sa.String(length=200), nullable=False),
        sa.Column('cui', sa.String(length=50), nullable=True),
        sa.Column('reprezentant', sa.String(length=200), nullable=True),
        sa.Column('telefon', sa.String(length=50), nullable=True),
        sa.Column('email', sa.String(length=255), nullable=True),
        sa.Column('adresa', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['account_id'], ['accounts.id'], name=op.f('fk_clienti_account_id_accounts')),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_clienti')),
    )
    op.create_index('ix_clienti_account_id_is_deleted_id', 'clienti', ['account_id', 'is_deleted', 'id'])


def downgrade() -> None:
    op.drop_index('ix_clienti_account_id_is_deleted_id', table_name='clienti')
    op.drop_table('clienti')
