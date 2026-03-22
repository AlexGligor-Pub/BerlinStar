"""revert_pay_method_enum_to_names

Revision ID: f5a6b7c8d9e0
Revises: e4f5a6b7c8d9
Branch Labels: None
Depends On: None

SQLAlchemy Enum(PayMethod) stores the member *names* (NEPLATIT, CARD, ...)
not the str values ("Neplatit", ...). Migration e4f5a6b7c8d9 wrongly changed
the DB enum to the str values. This migration reverts it back to names.
"""
from typing import Sequence, Union
from alembic import op


revision: str = 'f5a6b7c8d9e0'
down_revision: Union[str, None] = 'e4f5a6b7c8d9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
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
                WHEN 'Neplatit'         THEN 'NEPLATIT'::pay_method
                WHEN 'Platit cu cardul' THEN 'CARD'::pay_method
                WHEN 'Platit cash'      THEN 'CASH'::pay_method
                WHEN 'Platit prin OP'   THEN 'OP'::pay_method
                WHEN 'Platit Partial'   THEN 'PARTIAL'::pay_method
                ELSE 'NEPLATIT'::pay_method
            END
        )
    """)
    op.execute("ALTER TABLE receipts ALTER COLUMN pay_method SET DEFAULT 'NEPLATIT'::pay_method")
    op.execute("DROP TYPE pay_method_old")


def downgrade() -> None:
    op.execute("ALTER TYPE pay_method RENAME TO pay_method_old")
    op.execute("""
        CREATE TYPE pay_method AS ENUM (
            'Neplatit', 'Platit cu cardul', 'Platit cash', 'Platit prin OP', 'Platit Partial'
        )
    """)
    op.execute("ALTER TABLE receipts ALTER COLUMN pay_method DROP DEFAULT")
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
    op.execute("ALTER TABLE receipts ALTER COLUMN pay_method SET DEFAULT 'Neplatit'::pay_method")
    op.execute("DROP TYPE pay_method_old")
