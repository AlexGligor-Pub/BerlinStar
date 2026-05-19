"""adauga paid + paid_at pe efactura_received_index

Revision ID: ef16recvpaid
Revises: ef15recvread
Create Date: 2026-05-19 19:00:00.000000

Pentru tracking plati pe facturile primite (buton "Marcheaza plata" din
modalul de detalii + coloana "Platit" in tabel).
"""
import sqlalchemy as sa
from alembic import op


revision = "ef16recvpaid"
down_revision = "ef15recvread"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "efactura_received_index",
        sa.Column("paid", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        "efactura_received_index",
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_efactura_received_paid",
        "efactura_received_index",
        ["company_id", "paid"],
        if_not_exists=True,
    )


def downgrade() -> None:
    op.drop_index("ix_efactura_received_paid", table_name="efactura_received_index", if_exists=True)
    op.drop_column("efactura_received_index", "paid_at")
    op.drop_column("efactura_received_index", "paid")
