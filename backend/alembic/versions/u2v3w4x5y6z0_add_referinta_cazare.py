"""add referinta_cazare to cazari_anvelope

Revision ID: u2v3w4x5y6z0
Revises: t1u2v3w4x5y6
Create Date: 2026-03-28
"""
from alembic import op
import sqlalchemy as sa

revision = 'u2v3w4x5y6z0'
down_revision = 't1u2v3w4x5y6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('cazari_anvelope', sa.Column('referinta_cazare_id', sa.Integer(), sa.ForeignKey('cazari_anvelope.id', ondelete='SET NULL'), nullable=True))
    op.add_column('cazari_anvelope', sa.Column('montate_pe_masina', sa.Boolean(), nullable=False, server_default='false'))


def downgrade() -> None:
    op.drop_column('cazari_anvelope', 'montate_pe_masina')
    op.drop_column('cazari_anvelope', 'referinta_cazare_id')
