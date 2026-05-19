from __future__ import annotations
from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy import (
    BigInteger,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class PlatformAnafToken(Base):
    """Token OAuth ANAF al firmei BerlinStar SRL (emitent platforma).

    Singleton (id=1). Diferit de `anaf_tokens` (per-company al clientilor).
    Folosit la upload-ul facturilor de abonament catre SPV.
    """
    __tablename__ = "platform_anaf_token"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    cui: Mapped[str] = mapped_column(String(20), nullable=False)
    access_token_enc: Mapped[str] = mapped_column(Text, nullable=False)
    refresh_token_enc: Mapped[str] = mapped_column(Text, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    token_type: Mapped[str] = mapped_column(String(50), nullable=False, default="Bearer")
    scope: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class AccountSubscription(Base):
    """Starea abonamentului unui Account la BerlinStar.

    1:1 cu accounts. `next_payment_date` e data la care expira abonamentul
    curent. La login dupa aceasta data, contul se blocheaza.
    """
    __tablename__ = "account_subscription"
    __table_args__ = (
        Index("ix_account_subscription_next_payment", "next_payment_date"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    account_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("accounts.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    next_payment_date: Mapped[date] = mapped_column(Date, nullable=False)
    last_payment_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    renewal_email_sent_for: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class SubscriptionPayment(Base):
    """Istoricul platilor de abonament (Stripe).

    Pe `payment_intent.succeeded` se actualizeaza statusul, se genereaza
    factura (XML+PDF), se trimite in SPV si se avanseaza
    `AccountSubscription.next_payment_date`.
    """
    __tablename__ = "subscription_payment"
    __table_args__ = (
        Index("ix_subscription_payment_account", "account_id"),
        Index("ix_subscription_payment_status", "status"),
        Index(
            "ix_subscription_payment_stripe_pi",
            "stripe_payment_intent_id",
            unique=True,
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    account_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False
    )

    stripe_payment_intent_id: Mapped[str] = mapped_column(String(255), nullable=False)
    stripe_charge_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(
        String(30), nullable=False, server_default="requires_payment"
    )  # requires_payment | processing | succeeded | failed | canceled

    amount_eur: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    amount_ron: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    vat_amount_ron: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    fx_rate_eur_ron: Mapped[Decimal] = mapped_column(Numeric(10, 6), nullable=False)
    fx_date: Mapped[date] = mapped_column(Date, nullable=False)

    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    period_start: Mapped[date | None] = mapped_column(Date, nullable=True)
    period_end: Mapped[date | None] = mapped_column(Date, nullable=True)

    # Snapshot al datelor clientului completate la checkout — necesar pentru
    # factura (numele firmei, CUI, adresa, etc., asa cum erau la momentul
    # platii).
    customer_snapshot: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    # Factura emisa
    invoice_series: Mapped[str | None] = mapped_column(String(20), nullable=True)
    invoice_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    invoice_issue_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    xml_s3_key: Mapped[str | None] = mapped_column(String(500), nullable=True)
    pdf_s3_key: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # SPV upload
    anaf_index_incarcare: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    anaf_download_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    anaf_status: Mapped[str | None] = mapped_column(String(50), nullable=True)
    anaf_error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    anaf_response_zip_s3_key: Mapped[str | None] = mapped_column(String(500), nullable=True)

    failure_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
