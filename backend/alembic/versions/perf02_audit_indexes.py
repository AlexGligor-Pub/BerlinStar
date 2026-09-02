"""audit perf/DB: unique pe numerotarea documentelor, pg_trgm pe cautari, indexuri lipsa

Revision ID: perf02audit
Revises: idx01fkhot
Create Date: 2026-09-03

- unique partial (account_id, serie, nr) WHERE nr > 0 pe receipts: plasa de siguranta
  pentru alocarea atomica a numerelor de deviz/factura/chitanta. Pica daca exista deja
  duplicate in date — de verificat inainte cu:
    SELECT account_id, factura_serie, factura_nr, count(*) FROM receipts
    WHERE factura_nr > 0 GROUP BY 1,2,3 HAVING count(*) > 1;  (idem deviz_/chitanta_)
- pg_trgm + GIN pe coloanele cautate cu ilike '%q%' (receipts.titlu, receipt_items.name,
  clienti.nume, clienti.cui); CREATE EXTENSION cere drepturi de superuser/owner al DB.
- items(account_id, name), efactura_records(receipt_id, direction),
  clienti(account_id, nume, id), receipts(account_id, coalesce(updated_at, created_at)).
"""
from alembic import op
from sqlalchemy import text


revision = "perf02audit"
down_revision = "idx01fkhot"
branch_labels = None
depends_on = None

_UNIQUE_DOC_NR = [
    ("uq_receipts_account_deviz_nr", ["account_id", "deviz_serie", "deviz_nr"], "deviz_nr > 0"),
    ("uq_receipts_account_factura_nr", ["account_id", "factura_serie", "factura_nr"], "factura_nr > 0"),
    ("uq_receipts_account_chitanta_nr", ["account_id", "chitanta_serie", "chitanta_nr"], "chitanta_nr > 0"),
]

_TRGM = [
    ("ix_receipts_titlu_trgm", "receipts", "titlu"),
    ("ix_receipt_items_name_trgm", "receipt_items", "name"),
    ("ix_clienti_nume_trgm", "clienti", "nume"),
    ("ix_clienti_cui_trgm", "clienti", "cui"),
]

_PLAIN = [
    ("ix_items_account_id_name", "items", ["account_id", "name"], "is_deleted = false"),
    ("ix_clienti_account_id_nume_id", "clienti", ["account_id", "nume", "id"], "is_deleted = false"),
    ("ix_efactura_records_receipt_id_direction", "efactura_records", ["receipt_id", "direction"], None),
]


def upgrade() -> None:
    try:
        op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
    except Exception as exc:  # noqa: BLE001
        raise RuntimeError(
            "Nu s-a putut activa extensia pg_trgm (drepturi insuficiente?). Ruleaza ca superuser: "
            "CREATE EXTENSION IF NOT EXISTS pg_trgm; apoi reia migratia."
        ) from exc

    for name, cols, where in _UNIQUE_DOC_NR:
        op.create_index(name, "receipts", cols, unique=True, postgresql_where=text(where), if_not_exists=True)

    op.create_index(
        "ix_receipts_account_activity", "receipts",
        ["account_id", text("COALESCE(updated_at, created_at) DESC"), text("id DESC")],
        postgresql_where=text("is_deleted = false"), if_not_exists=True,
    )

    for name, table, cols, where in _PLAIN:
        kw = {"postgresql_where": text(where)} if where else {}
        op.create_index(name, table, cols, if_not_exists=True, **kw)

    for name, table, col in _TRGM:
        op.create_index(
            name, table, [col], postgresql_using="gin", postgresql_ops={col: "gin_trgm_ops"}, if_not_exists=True,
        )


def downgrade() -> None:
    for name, table, _ in reversed(_TRGM):
        op.drop_index(name, table_name=table, if_exists=True)
    for name, table, _, _ in reversed(_PLAIN):
        op.drop_index(name, table_name=table, if_exists=True)
    op.drop_index("ix_receipts_account_activity", table_name="receipts", if_exists=True)
    for name, _, _ in reversed(_UNIQUE_DOC_NR):
        op.drop_index(name, table_name="receipts", if_exists=True)
