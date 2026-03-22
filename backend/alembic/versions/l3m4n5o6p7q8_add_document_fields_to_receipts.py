"""add document fields to receipts

Revision ID: l3m4n5o6p7q8
Revises: k2l3m4n5o6p7
Create Date: 2026-03-23

"""
from alembic import op
import sqlalchemy as sa

revision = 'l3m4n5o6p7q8'
down_revision = 'k2l3m4n5o6p7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('receipts', sa.Column('deviz_serie', sa.String(50), nullable=False, server_default=''))
    op.add_column('receipts', sa.Column('deviz_nr', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('receipts', sa.Column('factura_serie', sa.String(50), nullable=False, server_default=''))
    op.add_column('receipts', sa.Column('factura_nr', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('receipts', sa.Column('chitanta_serie', sa.String(50), nullable=False, server_default=''))
    op.add_column('receipts', sa.Column('chitanta_nr', sa.Integer(), nullable=False, server_default='0'))
    op.alter_column('receipts', 'deviz_serie', server_default=None)
    op.alter_column('receipts', 'deviz_nr', server_default=None)
    op.alter_column('receipts', 'factura_serie', server_default=None)
    op.alter_column('receipts', 'factura_nr', server_default=None)
    op.alter_column('receipts', 'chitanta_serie', server_default=None)
    op.alter_column('receipts', 'chitanta_nr', server_default=None)


def downgrade() -> None:
    op.drop_column('receipts', 'chitanta_nr')
    op.drop_column('receipts', 'chitanta_serie')
    op.drop_column('receipts', 'factura_nr')
    op.drop_column('receipts', 'factura_serie')
    op.drop_column('receipts', 'deviz_nr')
    op.drop_column('receipts', 'deviz_serie')
