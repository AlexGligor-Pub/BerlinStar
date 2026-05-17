"""create efactura_global_settings (singleton table for all .env-driven config)

Revision ID: ef09gbl001
Revises: ef08rcv001
Create Date: 2026-05-17 09:00:00.000000

Mutam din .env in DB:
- ANAF_FERNET_KEY -> fernet_key (auto-generat la prima salvare daca lipseste)
- ANAF_AUTH_URL, ANAF_TOKEN_URL, ANAF_API_BASE_PROD/TEST -> override URLs
- ANAF_DEFAULT_REDIRECT_URI -> default_redirect_uri
- EFACTURA_SCHEDULER_ENABLED -> scheduler_enabled
- ANAF_FRONTEND_CALLBACK_REDIRECT -> frontend_callback_redirect
"""
from alembic import op
import sqlalchemy as sa


revision = "ef09gbl001"
down_revision = "ef08rcv001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "efactura_global_settings",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("fernet_key", sa.Text(), nullable=True),
        sa.Column("anaf_auth_url", sa.String(500), nullable=True),
        sa.Column("anaf_token_url", sa.String(500), nullable=True),
        sa.Column("anaf_api_base_prod", sa.String(500), nullable=True),
        sa.Column("anaf_api_base_test", sa.String(500), nullable=True),
        sa.Column("default_redirect_uri", sa.String(500), nullable=True),
        sa.Column("frontend_callback_redirect", sa.String(500), nullable=True),
        sa.Column("scheduler_enabled", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.execute("INSERT INTO efactura_global_settings DEFAULT VALUES")


def downgrade() -> None:
    op.drop_table("efactura_global_settings")
