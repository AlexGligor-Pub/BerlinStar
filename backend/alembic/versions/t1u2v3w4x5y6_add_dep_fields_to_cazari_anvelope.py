"""add dep fields to cazari_anvelope

Revision ID: t1u2v3w4x5y6
Revises: s0t1u2v3w4x5
Create Date: 2026-03-28
"""
from alembic import op
import sqlalchemy as sa

revision = 't1u2v3w4x5y6'
down_revision = 's0t1u2v3w4x5'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('cazari_anvelope', sa.Column('dep_anvelope', sa.Boolean(), nullable=False, server_default='true'))
    op.add_column('cazari_anvelope', sa.Column('dep_capace', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('cazari_anvelope', sa.Column('dep_roti_complete', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('cazari_anvelope', sa.Column('dep_antifurturi', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('cazari_anvelope', sa.Column('dep_prezoane', sa.Boolean(), nullable=False, server_default='false'))


def downgrade() -> None:
    op.drop_column('cazari_anvelope', 'dep_prezoane')
    op.drop_column('cazari_anvelope', 'dep_antifurturi')
    op.drop_column('cazari_anvelope', 'dep_roti_complete')
    op.drop_column('cazari_anvelope', 'dep_capace')
    op.drop_column('cazari_anvelope', 'dep_anvelope')
