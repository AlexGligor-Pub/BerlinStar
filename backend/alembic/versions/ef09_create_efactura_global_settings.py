"""create efactura_global_settings (singleton table cu toate setarile globale)

Revision ID: ef09gbl001
Revises: ef08rcv001
Create Date: 2026-05-17 09:00:00.000000

Mutam din .env in DB:
- ANAF_FERNET_KEY -> fernet_key (auto-generat la primul startup daca lipseste)
- ANAF_AUTH_URL, ANAF_TOKEN_URL, ANAF_API_BASE_PROD/TEST -> server_default cu URL-urile oficiale
- ANAF_DEFAULT_REDIRECT_URI -> default_redirect_uri (cu fallback localhost)
- ANAF_FRONTEND_CALLBACK_REDIRECT -> frontend_callback_redirect
- EFACTURA_SCHEDULER_ENABLED -> scheduler_enabled (default false)

Toate URL-urile au server_default — la INSERT DEFAULT VALUES rezulta o configuratie completa,
admin-ul vede valorile populate in UI de la primul start.
"""
from alembic import op
import sqlalchemy as sa


revision = "ef09gbl001"
down_revision = "ef08rcv001"
branch_labels = None
depends_on = None


# Defaults oficiale ANAF (conform documentatiei mai 2026)
_DEF_AUTH_URL = "https://logincert.anaf.ro/anaf-oauth2/v1/authorize"
_DEF_TOKEN_URL = "https://logincert.anaf.ro/anaf-oauth2/v1/token"
_DEF_API_PROD = "https://api.anaf.ro/prod/FCTEL/rest"
_DEF_API_TEST = "https://api.anaf.ro/test/FCTEL/rest"
_DEF_REDIRECT = "http://localhost:8000/api/efactura/callback"
_DEF_FRONTEND = "http://localhost:2000/adminv2?section=efactura"


def upgrade() -> None:
    op.create_table(
        "efactura_global_settings",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("fernet_key", sa.Text(), nullable=True),
        sa.Column("anaf_auth_url", sa.String(500), nullable=False, server_default=_DEF_AUTH_URL),
        sa.Column("anaf_token_url", sa.String(500), nullable=False, server_default=_DEF_TOKEN_URL),
        sa.Column("anaf_api_base_prod", sa.String(500), nullable=False, server_default=_DEF_API_PROD),
        sa.Column("anaf_api_base_test", sa.String(500), nullable=False, server_default=_DEF_API_TEST),
        sa.Column("default_redirect_uri", sa.String(500), nullable=False, server_default=_DEF_REDIRECT),
        sa.Column("frontend_callback_redirect", sa.String(500), nullable=False, server_default=_DEF_FRONTEND),
        sa.Column("scheduler_enabled", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.execute("INSERT INTO efactura_global_settings DEFAULT VALUES")


def downgrade() -> None:
    op.drop_table("efactura_global_settings")
