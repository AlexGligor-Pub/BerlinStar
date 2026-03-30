"""add_location_id_to_receipts

Revision ID: x5y6z0a1b2c3
Revises: w4x5y6z0a1b2
Create Date: 2026-03-30 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "x5y6z0a1b2c3"
down_revision: Union[str, None] = "w4x5y6z0a1b2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE receipts
        ADD COLUMN IF NOT EXISTS location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL
    """)


def downgrade() -> None:
    op.execute("ALTER TABLE receipts DROP COLUMN IF EXISTS location_id")
