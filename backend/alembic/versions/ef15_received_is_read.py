"""adauga is_read + read_at pe efactura_received_index

Revision ID: ef15recvread
Revises: ef14rcpref
Create Date: 2026-05-19 12:00:00.000000

Pentru pagina noua /efactura/primite avem nevoie de tracking citit/necitit
per factura. Mai bun decat downloaded (care reflecta doar starea de descarcare
ANAF, nu si actiunea de citire de catre utilizator).
"""
import sqlalchemy as sa
from alembic import op


revision = "ef15recvread"
down_revision = "ef14rcpref"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "efactura_received_index",
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        "efactura_received_index",
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_efactura_received_read",
        "efactura_received_index",
        ["company_id", "is_read"],
        if_not_exists=True,
    )


def downgrade() -> None:
    op.drop_index("ix_efactura_received_read", table_name="efactura_received_index", if_exists=True)
    op.drop_column("efactura_received_index", "read_at")
    op.drop_column("efactura_received_index", "is_read")
