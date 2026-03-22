"""drop casier from receipts

Revision ID: j1k2l3m4n5o6
Revises: i0j1k2l3m4n5
Create Date: 2026-03-23

"""
from alembic import op

revision = 'j1k2l3m4n5o6'
down_revision = 'i0j1k2l3m4n5'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_column('receipts', 'casier')


def downgrade() -> None:
    import sqlalchemy as sa
    op.add_column('receipts', sa.Column('casier', sa.String(200), nullable=False, server_default=''))
    op.alter_column('receipts', 'casier', server_default=None)
