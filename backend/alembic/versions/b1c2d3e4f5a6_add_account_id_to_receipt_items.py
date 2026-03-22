"""add_account_id_to_receipt_items

Revision ID: b1c2d3e4f5a6
Revises: ea4894924a46
Create Date: 2026-03-21 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b1c2d3e4f5a6'
down_revision: Union[str, None] = 'ea4894924a46'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('receipt_items', schema=None) as batch_op:
        batch_op.add_column(sa.Column('account_id', sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            batch_op.f('fk_receipt_items_account_id_accounts'),
            'accounts', ['account_id'], ['id'], ondelete='SET NULL'
        )


def downgrade() -> None:
    with op.batch_alter_table('receipt_items', schema=None) as batch_op:
        batch_op.drop_constraint(batch_op.f('fk_receipt_items_account_id_accounts'), type_='foreignkey')
        batch_op.drop_column('account_id')
