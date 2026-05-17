"""add structured address + email + legal_form to companies (for eFactura)

Revision ID: ef03cmp001
Revises: ef02rcp001
Create Date: 2026-05-16 14:10:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "ef03cmp001"
down_revision = "ef02rcp001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("companies", sa.Column("email", sa.String(255), nullable=True))
    op.add_column("companies", sa.Column("legal_form", sa.String(20), nullable=True))
    op.add_column("companies", sa.Column("street", sa.String(255), nullable=True))
    op.add_column("companies", sa.Column("city", sa.String(100), nullable=True))
    op.add_column("companies", sa.Column("county_code", sa.String(5), nullable=True))
    op.add_column("companies", sa.Column("country_code", sa.String(2), nullable=False, server_default="RO"))


def downgrade() -> None:
    op.drop_column("companies", "country_code")
    op.drop_column("companies", "county_code")
    op.drop_column("companies", "city")
    op.drop_column("companies", "street")
    op.drop_column("companies", "legal_form")
    op.drop_column("companies", "email")
