"""global_settings: chei AI (Anthropic, Google Places), model si tarife tokeni

Revision ID: ai01settings
Revises: prg01employee
"""
from __future__ import annotations
from alembic import op
import sqlalchemy as sa

revision = "ai01settings"
down_revision = "prg01employee"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("global_settings", sa.Column("anthropic_api_key_enc", sa.Text(), nullable=True))
    op.add_column("global_settings", sa.Column("google_places_api_key_enc", sa.Text(), nullable=True))
    op.add_column("global_settings", sa.Column("ai_model", sa.String(length=80), nullable=True))
    op.add_column("global_settings", sa.Column("ai_price_in_usd_mtok", sa.Numeric(10, 4), nullable=True))
    op.add_column("global_settings", sa.Column("ai_price_out_usd_mtok", sa.Numeric(10, 4), nullable=True))


def downgrade() -> None:
    op.drop_column("global_settings", "ai_price_out_usd_mtok")
    op.drop_column("global_settings", "ai_price_in_usd_mtok")
    op.drop_column("global_settings", "ai_model")
    op.drop_column("global_settings", "google_places_api_key_enc")
    op.drop_column("global_settings", "anthropic_api_key_enc")
