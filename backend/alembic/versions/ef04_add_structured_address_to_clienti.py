"""add structured address to clienti (for eFactura)

Revision ID: ef04cli001
Revises: ef03cmp001
Create Date: 2026-05-16 14:15:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "ef04cli001"
down_revision = "ef03cmp001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("clienti", sa.Column("street", sa.String(255), nullable=True))
    op.add_column("clienti", sa.Column("city", sa.String(100), nullable=True))
    op.add_column("clienti", sa.Column("county_code", sa.String(5), nullable=True))
    op.add_column("clienti", sa.Column("country_code", sa.String(2), nullable=False, server_default="RO"))
    op.add_column("clienti", sa.Column("postal_code", sa.String(20), nullable=True))


def downgrade() -> None:
    op.drop_column("clienti", "postal_code")
    op.drop_column("clienti", "country_code")
    op.drop_column("clienti", "county_code")
    op.drop_column("clienti", "city")
    op.drop_column("clienti", "street")
