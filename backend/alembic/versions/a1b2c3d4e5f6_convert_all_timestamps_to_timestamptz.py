"""convert_all_timestamps_to_timestamptz

Revision ID: a1b2c3d4e5f6
Revises: f5a6b7c8d9e0
Branch Labels: None
Depends On: None

All DateTime columns were created as TIMESTAMP (no tz). Values stored are UTC
but returned without offset, so JS treats them as local time (2h off).
Convert everything to TIMESTAMPTZ, treating existing values as UTC.
"""
from typing import Sequence, Union
from alembic import op


revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'f5a6b7c8d9e0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLES_COLS = {
    "accounts":   ["created_at", "updated_at"],
    "categories": ["created_at", "updated_at", "deleted_at"],
    "items":      ["created_at", "updated_at", "deleted_at"],
    "themes":     ["created_at", "updated_at", "deleted_at"],
    "employees":  ["created_at", "updated_at", "deleted_at"],
    "receipts":   ["created_at", "updated_at", "deleted_at"],
    "locations":  ["created_at", "updated_at", "deleted_at"],
}


def upgrade() -> None:
    for table, cols in TABLES_COLS.items():
        for col in cols:
            op.execute(
                f"ALTER TABLE {table} "
                f"ALTER COLUMN {col} TYPE TIMESTAMPTZ "
                f"USING {col} AT TIME ZONE 'UTC'"
            )


def downgrade() -> None:
    for table, cols in TABLES_COLS.items():
        for col in cols:
            op.execute(
                f"ALTER TABLE {table} "
                f"ALTER COLUMN {col} TYPE TIMESTAMP "
                f"USING {col} AT TIME ZONE 'UTC'"
            )
