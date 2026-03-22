"""rename_themes_to_departments

Revision ID: 4d5e6f7a8b9c
Revises: 3c4d5e6f7a8b
Create Date: 2026-03-22 15:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '4d5e6f7a8b9c'
down_revision: Union[str, None] = '3c4d5e6f7a8b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Rename themes table → departments
    op.rename_table('themes', 'departments')

    # Rename location_themes → location_departments and its column
    op.rename_table('location_themes', 'location_departments')
    op.alter_column('location_departments', 'theme_id', new_column_name='department_id')

    # Rename theme_id → department_id in categories
    op.alter_column('categories', 'theme_id', new_column_name='department_id')

    # Rename indexes on departments
    op.drop_index('ix_themes_account_id_is_deleted_id', table_name='departments')
    op.create_index('ix_departments_account_id_is_deleted_id', 'departments', ['account_id', 'is_deleted', 'id'])
    op.drop_index('ix_themes_is_deleted_id', table_name='departments')
    op.create_index('ix_departments_is_deleted_id', 'departments', ['is_deleted', 'id'])

    # Rename index on categories
    op.drop_index('ix_categories_theme_id_is_deleted_id', table_name='categories')
    op.create_index('ix_categories_department_id_is_deleted_id', 'categories', ['department_id', 'is_deleted', 'id'])


def downgrade() -> None:
    op.drop_index('ix_categories_department_id_is_deleted_id', table_name='categories')
    op.create_index('ix_categories_theme_id_is_deleted_id', 'categories', ['theme_id', 'is_deleted', 'id'])

    op.drop_index('ix_departments_is_deleted_id', table_name='departments')
    op.create_index('ix_themes_is_deleted_id', 'departments', ['is_deleted', 'id'])
    op.drop_index('ix_departments_account_id_is_deleted_id', table_name='departments')
    op.create_index('ix_themes_account_id_is_deleted_id', 'departments', ['account_id', 'is_deleted', 'id'])

    op.alter_column('categories', 'department_id', new_column_name='theme_id')
    op.alter_column('location_departments', 'department_id', new_column_name='theme_id')
    op.rename_table('location_departments', 'location_themes')
    op.rename_table('departments', 'themes')
