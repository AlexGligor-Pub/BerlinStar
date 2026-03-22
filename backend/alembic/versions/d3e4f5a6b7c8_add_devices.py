"""add_devices

Revision ID: d3e4f5a6b7c8
Revises: c2d3e4f5a6b7
Create Date: 2026-03-21 13:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd3e4f5a6b7c8'
down_revision: Union[str, None] = 'c2d3e4f5a6b7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'devices',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('account_id', sa.Integer(), nullable=False),
        sa.Column('location_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['account_id'], ['accounts.id'], name=op.f('fk_devices_account_id_accounts')),
        sa.ForeignKeyConstraint(['location_id'], ['locations.id'], name=op.f('fk_devices_location_id_locations'), ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_devices')),
    )
    op.create_index('ix_devices_account_id_id', 'devices', ['account_id', 'id'])
    op.create_index('ix_devices_location_id', 'devices', ['location_id'])


def downgrade() -> None:
    op.drop_index('ix_devices_location_id', table_name='devices')
    op.drop_index('ix_devices_account_id_id', table_name='devices')
    op.drop_table('devices')
