"""add client_id to receipts

Revision ID: k2l3m4n5o6p7
Revises: j1k2l3m4n5o6
Create Date: 2026-03-23

"""
from alembic import op
import sqlalchemy as sa

revision = 'k2l3m4n5o6p7'
down_revision = 'j1k2l3m4n5o6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('receipts', sa.Column('client_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'fk_receipts_client_id_clienti',
        'receipts', 'clienti',
        ['client_id'], ['id'],
        ondelete='SET NULL',
    )


def downgrade() -> None:
    op.drop_constraint('fk_receipts_client_id_clienti', 'receipts', type_='foreignkey')
    op.drop_column('receipts', 'client_id')
