"""add_company_id_to_registers

Revision ID: i0j1k2l3m4n5
Revises: h9i0j1k2l3m4
Create Date: 2026-03-22 23:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'i0j1k2l3m4n5'
down_revision: Union[str, None] = 'h9i0j1k2l3m4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('registers', sa.Column('company_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'fk_registers_company_id_companies',
        'registers', 'companies',
        ['company_id'], ['id'],
        ondelete='SET NULL',
    )


def downgrade() -> None:
    op.drop_constraint('fk_registers_company_id_companies', 'registers', type_='foreignkey')
    op.drop_column('registers', 'company_id')
