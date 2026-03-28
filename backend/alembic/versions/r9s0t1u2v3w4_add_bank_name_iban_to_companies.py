"""add bank_name and iban to companies

Revision ID: r9s0t1u2v3w4
Revises: q8r9s0t1u2v3
Create Date: 2026-03-28
"""
from alembic import op
import sqlalchemy as sa

revision = 'r9s0t1u2v3w4'
down_revision = 'q8r9s0t1u2v3'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('companies', sa.Column('bank_name', sa.String(200), nullable=True))
    op.add_column('companies', sa.Column('iban', sa.String(50), nullable=True))


def downgrade() -> None:
    op.drop_column('companies', 'iban')
    op.drop_column('companies', 'bank_name')
