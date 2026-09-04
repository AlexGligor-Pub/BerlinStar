"""abonament: Checkout Session (QR) + metoda de plata pe subscription_payment

Revision ID: sub02checkout
Revises: perf02audit
Create Date: 2026-09-04

- stripe_payment_intent_id devine nullable: o Checkout Session primeste PaymentIntent
  abia la confirmarea platii de catre client.
- stripe_checkout_session_id (unique) pentru reconcilierea evenimentelor checkout.session.*.
- payment_method_type: card / google_pay / apple_pay / paypal / link, din charge.
"""
from alembic import op
import sqlalchemy as sa


revision = "sub02checkout"
down_revision = "perf02audit"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "subscription_payment",
        "stripe_payment_intent_id",
        existing_type=sa.String(255),
        nullable=True,
    )
    op.add_column(
        "subscription_payment",
        sa.Column("stripe_checkout_session_id", sa.String(255), nullable=True),
    )
    op.add_column(
        "subscription_payment",
        sa.Column("payment_method_type", sa.String(50), nullable=True),
    )
    op.create_index(
        "ix_subscription_payment_stripe_cs",
        "subscription_payment",
        ["stripe_checkout_session_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ix_subscription_payment_stripe_cs", table_name="subscription_payment")
    op.drop_column("subscription_payment", "payment_method_type")
    op.drop_column("subscription_payment", "stripe_checkout_session_id")
    op.execute("DELETE FROM subscription_payment WHERE stripe_payment_intent_id IS NULL")
    op.alter_column(
        "subscription_payment",
        "stripe_payment_intent_id",
        existing_type=sa.String(255),
        nullable=False,
    )
