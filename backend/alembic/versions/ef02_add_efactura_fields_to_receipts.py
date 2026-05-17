"""add efactura fields to receipts (currency, due_date, type code, totals breakdown)

Revision ID: ef02rcp001
Revises: ef01vat001
Create Date: 2026-05-16 14:05:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "ef02rcp001"
down_revision = "ef01vat001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("receipts", sa.Column("currency", sa.String(3), nullable=False, server_default="RON"))
    op.add_column("receipts", sa.Column("due_date", sa.Date(), nullable=True))
    op.add_column("receipts", sa.Column("invoice_type_code", sa.String(5), nullable=False, server_default="380"))
    op.add_column("receipts", sa.Column("tax_exclusive_total", sa.Numeric(12, 2), nullable=True))
    op.add_column("receipts", sa.Column("tax_total", sa.Numeric(12, 2), nullable=True))
    op.add_column("receipts", sa.Column("is_extern", sa.Boolean(), nullable=False, server_default=sa.text("false")))
    op.add_column(
        "receipts",
        sa.Column("parent_receipt_id", sa.Integer(), sa.ForeignKey("receipts.id", ondelete="SET NULL"), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("receipts", "parent_receipt_id")
    op.drop_column("receipts", "is_extern")
    op.drop_column("receipts", "tax_total")
    op.drop_column("receipts", "tax_exclusive_total")
    op.drop_column("receipts", "invoice_type_code")
    op.drop_column("receipts", "due_date")
    op.drop_column("receipts", "currency")
