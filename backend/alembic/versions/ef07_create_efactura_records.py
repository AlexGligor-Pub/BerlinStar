"""create efactura_records table (sent/received invoices state machine)

Revision ID: ef07rec001
Revises: ef06ant001
Create Date: 2026-05-16 14:30:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "ef07rec001"
down_revision = "ef06ant001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "efactura_records",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id"), nullable=False),
        sa.Column("receipt_id", sa.Integer(), sa.ForeignKey("receipts.id", ondelete="SET NULL"), nullable=True),
        sa.Column("cui", sa.String(20), nullable=False),
        sa.Column("direction", sa.String(10), nullable=False, server_default="sent"),
        sa.Column("xml_content", sa.Text(), nullable=True),
        sa.Column("xml_s3_key", sa.String(500), nullable=True),
        sa.Column("standard", sa.String(10), nullable=False, server_default="UBL"),
        sa.Column("invoice_type", sa.String(10), nullable=False, server_default="380"),
        sa.Column("index_incarcare", sa.BigInteger(), nullable=True),
        sa.Column("data_creare_anaf", sa.String(20), nullable=True),
        sa.Column("status", sa.String(50), nullable=False, server_default="draft"),
        sa.Column("anaf_stare", sa.String(50), nullable=True),
        sa.Column("anaf_error_message", sa.Text(), nullable=True),
        sa.Column("download_id", sa.BigInteger(), nullable=True),
        sa.Column("response_zip_s3_key", sa.String(500), nullable=True),
        sa.Column("response_seal_valid", sa.Boolean(), nullable=True),
        sa.Column("upload_attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_attempt_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("next_retry_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("invoice_issue_date", sa.Date(), nullable=False),
        sa.Column("deadline_transmit", sa.Date(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_efactura_status", "efactura_records", ["status"])
    op.create_index("ix_efactura_deadline", "efactura_records", ["deadline_transmit"])
    op.create_index("ix_efactura_company", "efactura_records", ["company_id"])
    op.execute(
        "CREATE UNIQUE INDEX ux_efactura_index_incarcare ON efactura_records (index_incarcare) "
        "WHERE index_incarcare IS NOT NULL"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ux_efactura_index_incarcare")
    op.drop_index("ix_efactura_company", table_name="efactura_records")
    op.drop_index("ix_efactura_deadline", table_name="efactura_records")
    op.drop_index("ix_efactura_status", table_name="efactura_records")
    op.drop_table("efactura_records")
