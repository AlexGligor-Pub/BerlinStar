"""add_hotel_anvelope

Revision ID: q8r9s0t1u2v3
Revises: p7q8r9s0t1u2
Create Date: 2026-03-23

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = 'q8r9s0t1u2v3'
down_revision: Union[str, None] = 'p7q8r9s0t1u2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'marci_anvelope',
        sa.Column('id', sa.Integer, primary_key=True, autoincrement=True),
        sa.Column('account_id', sa.Integer, sa.ForeignKey('accounts.id'), nullable=False),
        sa.Column('nume', sa.String(200), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_deleted', sa.Boolean, nullable=False, server_default='0'),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_marci_anvelope_account_id_is_deleted_id', 'marci_anvelope', ['account_id', 'is_deleted', 'id'])

    op.create_table(
        'dimensiuni_anvelope',
        sa.Column('id', sa.Integer, primary_key=True, autoincrement=True),
        sa.Column('account_id', sa.Integer, sa.ForeignKey('accounts.id'), nullable=False),
        sa.Column('valoare', sa.String(100), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_deleted', sa.Boolean, nullable=False, server_default='0'),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_dimensiuni_anvelope_account_id_is_deleted_id', 'dimensiuni_anvelope', ['account_id', 'is_deleted', 'id'])

    op.execute(sa.text("""
        DO $$ BEGIN
            CREATE TYPE tip_anvelopa AS ENUM ('iarna', 'vara', 'ms', 'altele');
        EXCEPTION WHEN duplicate_object THEN null;
        END $$;
    """))
    tip_anvelopa_enum = postgresql.ENUM('iarna', 'vara', 'ms', 'altele', name='tip_anvelopa', create_type=False)

    op.create_table(
        'anvelope',
        sa.Column('id', sa.Integer, primary_key=True, autoincrement=True),
        sa.Column('account_id', sa.Integer, sa.ForeignKey('accounts.id'), nullable=False),
        sa.Column('client_id', sa.Integer, sa.ForeignKey('clienti.id', ondelete='SET NULL'), nullable=True),
        sa.Column('marca_id', sa.Integer, sa.ForeignKey('marci_anvelope.id', ondelete='SET NULL'), nullable=True),
        sa.Column('dimensiune_id', sa.Integer, sa.ForeignKey('dimensiuni_anvelope.id', ondelete='SET NULL'), nullable=True),
        sa.Column('tip', tip_anvelopa_enum, nullable=False, server_default='vara'),
        sa.Column('adancime', sa.Float, nullable=True),
        sa.Column('comments', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_deleted', sa.Boolean, nullable=False, server_default='0'),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_anvelope_account_id_is_deleted_id', 'anvelope', ['account_id', 'is_deleted', 'id'])
    op.create_index('ix_anvelope_account_id_client_id', 'anvelope', ['account_id', 'client_id'])

    op.create_table(
        'locuri_cazare',
        sa.Column('id', sa.Integer, primary_key=True, autoincrement=True),
        sa.Column('account_id', sa.Integer, sa.ForeignKey('accounts.id'), nullable=False),
        sa.Column('nume', sa.String(200), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_deleted', sa.Boolean, nullable=False, server_default='0'),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_locuri_cazare_account_id_is_deleted_id', 'locuri_cazare', ['account_id', 'is_deleted', 'id'])

    op.create_table(
        'cazari_anvelope',
        sa.Column('id', sa.Integer, primary_key=True, autoincrement=True),
        sa.Column('account_id', sa.Integer, sa.ForeignKey('accounts.id'), nullable=False),
        sa.Column('client_id', sa.Integer, sa.ForeignKey('clienti.id', ondelete='SET NULL'), nullable=True),
        sa.Column('employee_id', sa.Integer, sa.ForeignKey('employees.id', ondelete='SET NULL'), nullable=True),
        sa.Column('loc_cazare_id', sa.Integer, sa.ForeignKey('locuri_cazare.id', ondelete='SET NULL'), nullable=True),
        sa.Column('data_checkin', sa.Date, nullable=False),
        sa.Column('data_checkout', sa.Date, nullable=True),
        sa.Column('comments', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_deleted', sa.Boolean, nullable=False, server_default='0'),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_cazari_anvelope_account_id_is_deleted_id', 'cazari_anvelope', ['account_id', 'is_deleted', 'id'])
    op.create_index('ix_cazari_anvelope_account_id_data_checkin', 'cazari_anvelope', ['account_id', 'data_checkin'])

    op.create_table(
        'cazare_anvelope_items',
        sa.Column('id', sa.Integer, primary_key=True, autoincrement=True),
        sa.Column('account_id', sa.Integer, sa.ForeignKey('accounts.id'), nullable=False),
        sa.Column('cazare_id', sa.Integer, sa.ForeignKey('cazari_anvelope.id', ondelete='CASCADE'), nullable=False),
        sa.Column('anvelopa_id', sa.Integer, sa.ForeignKey('anvelope.id', ondelete='SET NULL'), nullable=True),
    )
    op.create_index('ix_cazare_anvelope_items_cazare_id', 'cazare_anvelope_items', ['cazare_id'])


def downgrade() -> None:
    op.drop_table('cazare_anvelope_items')
    op.drop_index('ix_cazari_anvelope_account_id_data_checkin', table_name='cazari_anvelope')
    op.drop_index('ix_cazari_anvelope_account_id_is_deleted_id', table_name='cazari_anvelope')
    op.drop_table('cazari_anvelope')
    op.drop_index('ix_locuri_cazare_account_id_is_deleted_id', table_name='locuri_cazare')
    op.drop_table('locuri_cazare')
    op.drop_index('ix_anvelope_account_id_client_id', table_name='anvelope')
    op.drop_index('ix_anvelope_account_id_is_deleted_id', table_name='anvelope')
    op.drop_table('anvelope')
    sa.Enum(name='tip_anvelopa').drop(op.get_bind(), checkfirst=True)
    op.drop_index('ix_dimensiuni_anvelope_account_id_is_deleted_id', table_name='dimensiuni_anvelope')
    op.drop_table('dimensiuni_anvelope')
    op.drop_index('ix_marci_anvelope_account_id_is_deleted_id', table_name='marci_anvelope')
    op.drop_table('marci_anvelope')
