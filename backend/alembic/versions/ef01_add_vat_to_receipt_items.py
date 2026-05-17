"""add vat fields to receipt_items for eFactura mapping

Revision ID: ef01vat001
Revises: mr09stoc003
Create Date: 2026-05-16 14:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "ef01vat001"
down_revision = "mr09stoc003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("receipt_items", sa.Column("vat_category", sa.String(10), nullable=False, server_default="S"))
    op.add_column("receipt_items", sa.Column("vat_percent", sa.Numeric(5, 2), nullable=True))
    op.add_column("receipt_items", sa.Column("unit_code", sa.String(10), nullable=True))
    op.add_column("receipt_items", sa.Column("tax_exemption_reason", sa.String(50), nullable=True))


def downgrade() -> None:
    op.drop_column("receipt_items", "tax_exemption_reason")
    op.drop_column("receipt_items", "unit_code")
    op.drop_column("receipt_items", "vat_percent")
    op.drop_column("receipt_items", "vat_category")
