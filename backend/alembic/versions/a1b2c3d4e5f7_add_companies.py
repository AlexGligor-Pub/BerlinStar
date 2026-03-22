"""add companies table

Revision ID: a1b2c3d4e5f7
Revises: ea4894924a46
Create Date: 2026-03-22
"""
from alembic import op
import sqlalchemy as sa

revision = 'a1b2c3d4e5f7'
down_revision = 'ea4894924a46'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'companies',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('account_id', sa.Integer(), nullable=False),
        sa.Column('cui', sa.BigInteger(), nullable=False),
        sa.Column('name', sa.String(300), nullable=False),
        sa.Column('address', sa.Text(), nullable=True),
        sa.Column('nr_reg_com', sa.String(50), nullable=True),
        sa.Column('phone', sa.String(50), nullable=True),
        sa.Column('postal_code', sa.String(20), nullable=True),
        sa.Column('is_vat_payer', sa.Boolean(), nullable=True),
        sa.Column('registration_status', sa.String(200), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('comments', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['account_id'], ['accounts.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_companies_account_id_is_deleted_id', 'companies',
                    ['account_id', 'is_deleted', 'id'])


def downgrade() -> None:
    op.drop_index('ix_companies_account_id_is_deleted_id', table_name='companies')
    op.drop_table('companies')
