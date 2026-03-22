"""add_account_id_indexes

Revision ID: c2d3e4f5a6b7
Revises: b1c2d3e4f5a6
Create Date: 2026-03-21 12:30:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'c2d3e4f5a6b7'
down_revision: Union[str, None] = 'b1c2d3e4f5a6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index('ix_receipt_items_account_id', 'receipt_items', ['account_id'])
    op.create_index('ix_items_account_id_is_deleted_id', 'items', ['account_id', 'is_deleted', 'id'])
    op.create_index('ix_categories_account_id_is_deleted_id', 'categories', ['account_id', 'is_deleted', 'id'])
    op.create_index('ix_themes_account_id_is_deleted_id', 'themes', ['account_id', 'is_deleted', 'id'])
    op.create_index('ix_locations_account_id_is_deleted_id', 'locations', ['account_id', 'is_deleted', 'id'])


def downgrade() -> None:
    op.drop_index('ix_locations_account_id_is_deleted_id', table_name='locations')
    op.drop_index('ix_themes_account_id_is_deleted_id', table_name='themes')
    op.drop_index('ix_categories_account_id_is_deleted_id', table_name='categories')
    op.drop_index('ix_items_account_id_is_deleted_id', table_name='items')
    op.drop_index('ix_receipt_items_account_id', table_name='receipt_items')
