"""indexuri FK + (account_id, created_at) pe tabelele mari de tranzactii

Revision ID: idx01fkhot
Revises: cnp01norm
Create Date: 2026-09-02

Postgres nu indexeaza FK-urile automat. Fara ele, listarea bonurilor pe client/
locatie, rapoartele pe angajat/produs si FK trigger check-urile la DELETE fac
Seq Scan pe receipts/receipt_items/cazari_anvelope/programari.
"""
from alembic import op


revision = "idx01fkhot"
down_revision = "cnp01norm"
branch_labels = None
depends_on = None

_INDEXES = [
    ("ix_receipts_account_id_created_at", "receipts", ["account_id", "created_at"]),
    ("ix_receipts_client_id", "receipts", ["client_id"]),
    ("ix_receipts_location_id", "receipts", ["location_id"]),
    ("ix_receipt_items_employee_id", "receipt_items", ["employee_id"]),
    ("ix_receipt_items_item_id", "receipt_items", ["item_id"]),
    ("ix_cazari_anvelope_client_id", "cazari_anvelope", ["client_id"]),
    ("ix_cazari_anvelope_employee_id", "cazari_anvelope", ["employee_id"]),
    ("ix_cazari_anvelope_loc_cazare_id", "cazari_anvelope", ["loc_cazare_id"]),
    ("ix_programari_client_id", "programari", ["client_id"]),
]


def upgrade() -> None:
    for name, table, cols in _INDEXES:
        op.create_index(name, table, cols, if_not_exists=True)


def downgrade() -> None:
    for name, table, _ in reversed(_INDEXES):
        op.drop_index(name, table_name=table, if_exists=True)
