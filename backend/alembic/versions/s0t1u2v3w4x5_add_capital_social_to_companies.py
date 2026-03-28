"""add capital_social to companies

Revision ID: s0t1u2v3w4x5
Revises: r9s0t1u2v3w4
Create Date: 2026-03-28
"""
from alembic import op
import sqlalchemy as sa

revision = 's0t1u2v3w4x5'
down_revision = 'r9s0t1u2v3w4'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('companies', sa.Column('capital_social', sa.Float(), nullable=True, server_default='200'))


def downgrade() -> None:
    op.drop_column('companies', 'capital_social')
