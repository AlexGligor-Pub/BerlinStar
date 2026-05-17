"""create efactura_received_index (cache for /listaMesajeFactura)

Revision ID: ef08rcv001
Revises: ef07rec001
Create Date: 2026-05-16 14:35:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "ef08rcv001"
down_revision = "ef07rec001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "efactura_received_index",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id"), nullable=False),
        sa.Column("cui", sa.String(20), nullable=False),
        sa.Column("id_solicitare", sa.BigInteger(), nullable=False),
        sa.Column("tip", sa.String(50), nullable=True),
        sa.Column("data_creare", sa.String(20), nullable=True),
        sa.Column("cif_emitent", sa.String(20), nullable=True),
        sa.Column("nume_emitent", sa.String(255), nullable=True),
        sa.Column("cif_beneficiar", sa.String(20), nullable=True),
        sa.Column("nume_beneficiar", sa.String(255), nullable=True),
        sa.Column("detalii", sa.Text(), nullable=True),
        sa.Column("raw_payload", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("downloaded", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("response_zip_s3_key", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("company_id", "id_solicitare", name="ux_efactura_received_unique"),
    )
    op.create_index("ix_efactura_received_company", "efactura_received_index", ["company_id"])


def downgrade() -> None:
    op.drop_index("ix_efactura_received_company", table_name="efactura_received_index")
    op.drop_table("efactura_received_index")
