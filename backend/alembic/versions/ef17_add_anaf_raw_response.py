"""adauga anaf_raw_response pe efactura_records

Revision ID: ef17rawresp
Revises: leavehrs_001
Create Date: 2026-06-23 20:10:00.000000

Persista corpul brut al raspunsului ANAF la upload (succes sau eroare) pentru
diagnostic. Necesar dupa fix-ul care nu mai marcheaza 'in_prelucrare' fara
index_incarcare (vezi anaf_client.upload_invoice + service.prepare_and_upload).

down_revision = leavehrs_001 = head-ul unic curent al lantului (confirmat cu
`alembic heads`). NU ef16recvpaid — acela are deja un copil (mrg01_ef16_fr01),
deci ar fi creat un al doilea head si `alembic upgrade head` ar fi esuat.
"""
import sqlalchemy as sa
from alembic import op


revision = "ef17rawresp"
down_revision = "leavehrs_001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "efactura_records",
        sa.Column("anaf_raw_response", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("efactura_records", "anaf_raw_response")
