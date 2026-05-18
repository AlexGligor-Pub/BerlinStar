"""adauga index pe receipt_items.receipt_id (FK fara index = scan complet la CASCADE delete)

Revision ID: ef13rcptidx
Revises: ef12oauthglb
Create Date: 2026-05-18 16:50:00.000000

receipt_items are FK pe receipt_id cu ON DELETE CASCADE, dar fara index.
Pentru o tabela cu 100k+ receipt_items, fiecare DELETE pe receipts declanseaza
un Seq Scan complet pe receipt_items (FK trigger check). La 30k+ receipts intr-un
cleanup, asta devine O(N*M) si pierde minute. Index B-tree il rezolva instant.
"""
from alembic import op


revision = "ef13rcptidx"
down_revision = "ef12oauthglb"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index(
        "ix_receipt_items_receipt_id",
        "receipt_items",
        ["receipt_id"],
        if_not_exists=True,
    )


def downgrade() -> None:
    op.drop_index("ix_receipt_items_receipt_id", table_name="receipt_items", if_exists=True)
