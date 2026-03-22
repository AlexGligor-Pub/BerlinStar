"""fix_pay_method_enum_values

Revision ID: e4f5a6b7c8d9
Revises: d3e4f5a6b7c8
Branch Labels: None
Depends On: None

The previous migration created the pay_method enum with uppercase names
(NEPLATIT, CARD, ...) but SQLAlchemy stores the str-enum values
("Neplatit", "Platit cu cardul", ...). This migration recreates the enum
with the correct values.
"""
from typing import Sequence, Union
from alembic import op


revision: str = 'e4f5a6b7c8d9'
down_revision: Union[str, None] = 'd3e4f5a6b7c8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Rename old enum type
    op.execute("ALTER TYPE pay_method RENAME TO pay_method_old")

    # Create new enum with the correct string values
    op.execute("""
        CREATE TYPE pay_method AS ENUM (
            'Neplatit',
            'Platit cu cardul',
            'Platit cash',
            'Platit prin OP',
            'Platit Partial'
        )
    """)

    # Drop the server default before altering column type
    op.execute("ALTER TABLE receipts ALTER COLUMN pay_method DROP DEFAULT")

    # Migrate existing data and change column type
    op.execute("""
        ALTER TABLE receipts
        ALTER COLUMN pay_method TYPE pay_method
        USING (
            CASE pay_method::text
                WHEN 'NEPLATIT' THEN 'Neplatit'::pay_method
                WHEN 'CARD'     THEN 'Platit cu cardul'::pay_method
                WHEN 'CASH'     THEN 'Platit cash'::pay_method
                WHEN 'OP'       THEN 'Platit prin OP'::pay_method
                WHEN 'PARTIAL'  THEN 'Platit Partial'::pay_method
                ELSE 'Neplatit'::pay_method
            END
        )
    """)

    # Restore server default with the new value
    op.execute("ALTER TABLE receipts ALTER COLUMN pay_method SET DEFAULT 'Neplatit'::pay_method")

    # Drop old enum type
    op.execute("DROP TYPE pay_method_old")


def downgrade() -> None:
    op.execute("ALTER TYPE pay_method RENAME TO pay_method_old")
    op.execute("""
        CREATE TYPE pay_method AS ENUM ('NEPLATIT', 'CARD', 'CASH', 'OP', 'PARTIAL')
    """)
    op.execute("ALTER TABLE receipts ALTER COLUMN pay_method DROP DEFAULT")
    op.execute("""
        ALTER TABLE receipts
        ALTER COLUMN pay_method TYPE pay_method
        USING (
            CASE pay_method::text
                WHEN 'Neplatit'          THEN 'NEPLATIT'::pay_method
                WHEN 'Platit cu cardul'  THEN 'CARD'::pay_method
                WHEN 'Platit cash'       THEN 'CASH'::pay_method
                WHEN 'Platit prin OP'    THEN 'OP'::pay_method
                WHEN 'Platit Partial'    THEN 'PARTIAL'::pay_method
                ELSE 'NEPLATIT'::pay_method
            END
        )
    """)
    op.execute("ALTER TABLE receipts ALTER COLUMN pay_method SET DEFAULT 'NEPLATIT'::pay_method")
    op.execute("DROP TYPE pay_method_old")
