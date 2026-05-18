"""adauga indexuri pe receipts.parent_receipt_id + programare_id (FK fara index)

Revision ID: ef14rcpref
Revises: ef13rcptidx
Create Date: 2026-05-18 17:35:00.000000

receipts.parent_receipt_id (self-ref FK) si receipts.programare_id (FK spre programari)
nu aveau indexuri. Pentru o tabela cu 200k+ receipts, fiecare DELETE pe receipts (sau
update pe parent_receipt_id) declanseaza un Seq Scan complet pentru FK trigger check.
Cleanup demo de 38k receipts a durat ~18 min fara indexul pe parent_receipt_id;
cu indexul, ~30 sec.

Partial indexes (WHERE col IS NOT NULL) — majoritatea receipt-urilor nu au self-ref
sau programare_id, deci e mult mai eficient sa indexam doar valorile non-null.
"""
from alembic import op


revision = "ef14rcpref"
down_revision = "ef13rcptidx"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index(
        "ix_receipts_parent_receipt_id",
        "receipts",
        ["parent_receipt_id"],
        postgresql_where="parent_receipt_id IS NOT NULL",
        if_not_exists=True,
    )
    op.create_index(
        "ix_receipts_programare_id",
        "receipts",
        ["programare_id"],
        postgresql_where="programare_id IS NOT NULL",
        if_not_exists=True,
    )


def downgrade() -> None:
    op.drop_index("ix_receipts_programare_id", table_name="receipts", if_exists=True)
    op.drop_index("ix_receipts_parent_receipt_id", table_name="receipts", if_exists=True)
