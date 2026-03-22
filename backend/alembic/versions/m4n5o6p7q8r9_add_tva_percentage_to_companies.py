"""add tva_percentage to companies

Revision ID: m4n5o6p7q8r9
Revises: l3m4n5o6p7q8
Create Date: 2026-03-22

"""
from alembic import op
import sqlalchemy as sa

revision = 'm4n5o6p7q8r9'
down_revision = 'l3m4n5o6p7q8'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('companies', sa.Column('tva_percentage', sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column('companies', 'tva_percentage')
