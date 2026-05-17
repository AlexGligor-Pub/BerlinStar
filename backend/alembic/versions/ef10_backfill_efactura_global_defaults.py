"""backfill efactura_global_settings cu URL-uri default + NOT NULL constraint

Revision ID: ef10gblbk
Revises: ef09gbl001
Create Date: 2026-05-17 16:00:00.000000

Pentru instalari unde ef09 a rulat in versiunea veche (fara server_default si fara
INSERT cu valori): completam coloanele URL care sunt NULL si trecem la NOT NULL.
"""
from alembic import op
import sqlalchemy as sa


revision = "ef10gblbk"
down_revision = "ef09gbl001"
branch_labels = None
depends_on = None


_DEF_AUTH_URL = "https://logincert.anaf.ro/anaf-oauth2/v1/authorize"
_DEF_TOKEN_URL = "https://logincert.anaf.ro/anaf-oauth2/v1/token"
_DEF_API_PROD = "https://api.anaf.ro/prod/FCTEL/rest"
_DEF_API_TEST = "https://api.anaf.ro/test/FCTEL/rest"
_DEF_REDIRECT = "http://localhost:8000/api/efactura/callback"
_DEF_FRONTEND = "http://localhost:2000/adminv2?section=efactura"


def upgrade() -> None:
    # 1. Asigura ca exista cel putin un rand singleton (id=1)
    op.execute("INSERT INTO efactura_global_settings (id) SELECT 1 WHERE NOT EXISTS (SELECT 1 FROM efactura_global_settings)")

    # 2. Backfill NULL-urile cu valorile default
    bind = op.get_bind()
    bind.execute(sa.text(
        "UPDATE efactura_global_settings SET "
        "anaf_auth_url = COALESCE(anaf_auth_url, :auth), "
        "anaf_token_url = COALESCE(anaf_token_url, :token), "
        "anaf_api_base_prod = COALESCE(anaf_api_base_prod, :prod), "
        "anaf_api_base_test = COALESCE(anaf_api_base_test, :test), "
        "default_redirect_uri = COALESCE(default_redirect_uri, :redirect), "
        "frontend_callback_redirect = COALESCE(frontend_callback_redirect, :frontend)"
    ).bindparams(
        auth=_DEF_AUTH_URL,
        token=_DEF_TOKEN_URL,
        prod=_DEF_API_PROD,
        test=_DEF_API_TEST,
        redirect=_DEF_REDIRECT,
        frontend=_DEF_FRONTEND,
    ))

    # 3. NOT NULL + server_default pe coloane (pentru consistenta cu ef09 reschis)
    for col, default in (
        ("anaf_auth_url", _DEF_AUTH_URL),
        ("anaf_token_url", _DEF_TOKEN_URL),
        ("anaf_api_base_prod", _DEF_API_PROD),
        ("anaf_api_base_test", _DEF_API_TEST),
        ("default_redirect_uri", _DEF_REDIRECT),
        ("frontend_callback_redirect", _DEF_FRONTEND),
    ):
        op.alter_column(
            "efactura_global_settings",
            col,
            existing_type=sa.String(500),
            nullable=False,
            server_default=default,
        )


def downgrade() -> None:
    for col in (
        "anaf_auth_url",
        "anaf_token_url",
        "anaf_api_base_prod",
        "anaf_api_base_test",
        "default_redirect_uri",
        "frontend_callback_redirect",
    ):
        op.alter_column(
            "efactura_global_settings",
            col,
            existing_type=sa.String(500),
            nullable=True,
            server_default=None,
        )
