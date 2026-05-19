"""add subscription / abonament BerlinStar

Revision ID: sub01abonam
Revises: zz9ii0jj1kk2
Create Date: 2026-05-20 12:00:00.000000

Extinde `global_settings` cu campurile pentru abonament, datele firmei
emitente, Stripe (criptat) si ANAF emitent platforma. Adauga tabelele:
- platform_anaf_token (singleton, token-ul OAuth ANAF al BerlinStar SRL)
- account_subscription (1:1 cu accounts, data scadentei urmatoare)
- subscription_payment (istoricul platilor Stripe + facturile emise)

Data-fill: pentru fiecare account ne-sters, seteaza
next_payment_date = today + 1 an (cum a confirmat utilizatorul).
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "sub01abonam"
down_revision = "zz9ii0jj1kk2"
branch_labels = None
depends_on = None


_NEW_GS_COLUMNS: list[tuple[str, sa.Column]] = [
    # ── Abonament BerlinStar ──
    (
        "subscription_price_eur",
        sa.Column(
            "subscription_price_eur",
            sa.Numeric(10, 2),
            nullable=False,
            server_default="700.00",
        ),
    ),
    (
        "subscription_vat_percent",
        sa.Column(
            "subscription_vat_percent",
            sa.Numeric(5, 2),
            nullable=False,
            server_default="19.00",
        ),
    ),
    (
        "subscription_currency_charge",
        sa.Column(
            "subscription_currency_charge",
            sa.String(3),
            nullable=False,
            server_default="RON",
        ),
    ),
    (
        "subscription_invoice_series",
        sa.Column(
            "subscription_invoice_series",
            sa.String(20),
            nullable=False,
            server_default="BS-SUB",
        ),
    ),
    (
        "subscription_next_invoice_number",
        sa.Column(
            "subscription_next_invoice_number",
            sa.Integer(),
            nullable=False,
            server_default="1",
        ),
    ),
    # ── Date firma emitenta (BerlinStar SRL) ──
    ("issuer_name", sa.Column("issuer_name", sa.String(255), nullable=True)),
    ("issuer_cui", sa.Column("issuer_cui", sa.String(20), nullable=True)),
    ("issuer_reg_com", sa.Column("issuer_reg_com", sa.String(50), nullable=True)),
    ("issuer_legal_form", sa.Column("issuer_legal_form", sa.String(20), nullable=True)),
    (
        "issuer_is_vat_payer",
        sa.Column(
            "issuer_is_vat_payer",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
    ),
    ("issuer_address", sa.Column("issuer_address", sa.Text(), nullable=True)),
    ("issuer_street", sa.Column("issuer_street", sa.String(255), nullable=True)),
    ("issuer_city", sa.Column("issuer_city", sa.String(100), nullable=True)),
    ("issuer_county_code", sa.Column("issuer_county_code", sa.String(10), nullable=True)),
    ("issuer_postal_code", sa.Column("issuer_postal_code", sa.String(20), nullable=True)),
    (
        "issuer_country_code",
        sa.Column(
            "issuer_country_code",
            sa.String(2),
            nullable=False,
            server_default="RO",
        ),
    ),
    ("issuer_iban", sa.Column("issuer_iban", sa.String(50), nullable=True)),
    ("issuer_bank_name", sa.Column("issuer_bank_name", sa.String(100), nullable=True)),
    ("issuer_email", sa.Column("issuer_email", sa.String(255), nullable=True)),
    ("issuer_phone", sa.Column("issuer_phone", sa.String(50), nullable=True)),
    # ── Stripe ──
    (
        "stripe_publishable_key",
        sa.Column("stripe_publishable_key", sa.String(255), nullable=True),
    ),
    ("stripe_secret_key_enc", sa.Column("stripe_secret_key_enc", sa.Text(), nullable=True)),
    (
        "stripe_webhook_secret_enc",
        sa.Column("stripe_webhook_secret_enc", sa.Text(), nullable=True),
    ),
    (
        "stripe_test_mode",
        sa.Column(
            "stripe_test_mode",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
    ),
    # ── ANAF emitent platforma ──
    (
        "platform_anaf_use_test_env",
        sa.Column(
            "platform_anaf_use_test_env",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
    ),
    (
        "platform_anaf_auto_upload",
        sa.Column(
            "platform_anaf_auto_upload",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
    ),
]


def upgrade() -> None:
    # 1. extinde global_settings
    for _, col in _NEW_GS_COLUMNS:
        op.add_column("global_settings", col)
    # global_settings este creata in zz1aa2bb3cc4 si gestionata code-side
    # (get_or_create_global_settings) — nu mai facem INSERT aici.

    # 2. platform_anaf_token
    op.create_table(
        "platform_anaf_token",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("cui", sa.String(20), nullable=False),
        sa.Column("access_token_enc", sa.Text(), nullable=False),
        sa.Column("refresh_token_enc", sa.Text(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("token_type", sa.String(50), nullable=False, server_default="Bearer"),
        sa.Column("scope", sa.String(255), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )

    # 3. account_subscription
    op.create_table(
        "account_subscription",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "account_id",
            sa.Integer(),
            sa.ForeignKey("accounts.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("next_payment_date", sa.Date(), nullable=False),
        sa.Column("last_payment_date", sa.Date(), nullable=True),
        sa.Column("renewal_email_sent_for", sa.Date(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_account_subscription_next_payment",
        "account_subscription",
        ["next_payment_date"],
    )

    # 4. subscription_payment
    op.create_table(
        "subscription_payment",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "account_id",
            sa.Integer(),
            sa.ForeignKey("accounts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("stripe_payment_intent_id", sa.String(255), nullable=False),
        sa.Column("stripe_charge_id", sa.String(255), nullable=True),
        sa.Column(
            "status",
            sa.String(30),
            nullable=False,
            server_default="requires_payment",
        ),
        sa.Column("amount_eur", sa.Numeric(10, 2), nullable=False),
        sa.Column("amount_ron", sa.Numeric(10, 2), nullable=False),
        sa.Column("vat_amount_ron", sa.Numeric(10, 2), nullable=False),
        sa.Column("fx_rate_eur_ron", sa.Numeric(10, 6), nullable=False),
        sa.Column("fx_date", sa.Date(), nullable=False),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("period_start", sa.Date(), nullable=True),
        sa.Column("period_end", sa.Date(), nullable=True),
        sa.Column(
            "customer_snapshot",
            postgresql.JSONB(),
            nullable=True,
        ),
        sa.Column("invoice_series", sa.String(20), nullable=True),
        sa.Column("invoice_number", sa.Integer(), nullable=True),
        sa.Column("invoice_issue_date", sa.Date(), nullable=True),
        sa.Column("xml_s3_key", sa.String(500), nullable=True),
        sa.Column("pdf_s3_key", sa.String(500), nullable=True),
        sa.Column("anaf_index_incarcare", sa.BigInteger(), nullable=True),
        sa.Column("anaf_download_id", sa.BigInteger(), nullable=True),
        sa.Column("anaf_status", sa.String(50), nullable=True),
        sa.Column("anaf_error_message", sa.Text(), nullable=True),
        sa.Column("anaf_response_zip_s3_key", sa.String(500), nullable=True),
        sa.Column("failure_reason", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_subscription_payment_account",
        "subscription_payment",
        ["account_id"],
    )
    op.create_index(
        "ix_subscription_payment_status",
        "subscription_payment",
        ["status"],
    )
    op.create_index(
        "ix_subscription_payment_stripe_pi",
        "subscription_payment",
        ["stripe_payment_intent_id"],
        unique=True,
    )

    # 5. data-fill conturi existente: next_payment_date = today + 1 an
    op.execute(
        "INSERT INTO account_subscription (account_id, next_payment_date, created_at) "
        "SELECT id, (CURRENT_DATE + INTERVAL '1 year')::date, NOW() "
        "FROM accounts WHERE is_deleted = false "
        "ON CONFLICT (account_id) DO NOTHING"
    )


def downgrade() -> None:
    op.drop_index("ix_subscription_payment_stripe_pi", table_name="subscription_payment")
    op.drop_index("ix_subscription_payment_status", table_name="subscription_payment")
    op.drop_index("ix_subscription_payment_account", table_name="subscription_payment")
    op.drop_table("subscription_payment")
    op.drop_index(
        "ix_account_subscription_next_payment", table_name="account_subscription"
    )
    op.drop_table("account_subscription")
    op.drop_table("platform_anaf_token")
    for name, _ in reversed(_NEW_GS_COLUMNS):
        op.drop_column("global_settings", name)
