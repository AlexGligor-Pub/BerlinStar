"""create anaf_settings table (per-company OAuth + behavior config)

Revision ID: ef05ans001
Revises: ef04cli001
Create Date: 2026-05-16 14:20:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "ef05ans001"
down_revision = "ef04cli001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "anaf_settings",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "company_id",
            sa.Integer(),
            sa.ForeignKey("companies.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("use_test_env", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("client_id", sa.String(255), nullable=True),
        sa.Column("client_secret_enc", sa.Text(), nullable=True),
        sa.Column("redirect_uri", sa.String(500), nullable=True),
        sa.Column("payment_terms_days", sa.Integer(), nullable=False, server_default="30"),
        sa.Column("default_invoice_type", sa.String(5), nullable=False, server_default="380"),
        sa.Column("auto_upload", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("auto_upload_delay_minutes", sa.Integer(), nullable=False, server_default="60"),
        sa.Column("deadline_alert_email", sa.String(255), nullable=True),
        sa.Column("validate_schematron", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("last_sync_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("anaf_settings")
