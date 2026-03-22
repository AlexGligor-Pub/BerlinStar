"""add_logo_background_website_to_companies

Revision ID: p7q8r9s0t1u2
Revises: o6p7q8r9s0t1
Create Date: 2026-03-22

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'p7q8r9s0t1u2'
down_revision: Union[str, None] = 'o6p7q8r9s0t1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('companies', sa.Column('logo_path', sa.String(500), nullable=True))
    op.add_column('companies', sa.Column('background_path', sa.String(500), nullable=True))
    op.add_column('companies', sa.Column('website', sa.String(500), nullable=True))


def downgrade() -> None:
    op.drop_column('companies', 'website')
    op.drop_column('companies', 'background_path')
    op.drop_column('companies', 'logo_path')
