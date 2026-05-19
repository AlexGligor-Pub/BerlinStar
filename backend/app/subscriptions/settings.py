"""Helpers pentru citirea setarilor de abonament din global_settings.

Singura sursa de adevar e tabela `global_settings` (singleton). NU folosim
.env pentru Stripe — toate cheile sunt configurabile din AdminV2.
"""
from __future__ import annotations

import logging
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.efactura.crypto import decrypt, is_configured as fernet_configured
from app.models.global_settings import GlobalSettings

log = logging.getLogger("berlinstar.subscriptions.settings")


class SubscriptionConfigError(RuntimeError):
    """Setarile de abonament sunt incomplete (Stripe / issuer / etc.)."""


async def get_or_create_global_settings(db: AsyncSession) -> GlobalSettings:
    row = (await db.execute(select(GlobalSettings).limit(1))).scalar_one_or_none()
    if row is None:
        row = GlobalSettings()
        db.add(row)
        await db.commit()
        await db.refresh(row)
    return row


def stripe_secret_key(gs: GlobalSettings) -> str:
    """Decripteaza secret_key din DB. Ridica daca lipseste sau Fernet inca nu e configurat."""
    if not gs.stripe_secret_key_enc:
        raise SubscriptionConfigError(
            "Stripe Secret Key nu este configurat. AdminV2 -> Abonament -> Setari."
        )
    if not fernet_configured():
        raise SubscriptionConfigError(
            "Cheia Fernet (eFactura) nu este configurata — necesara pentru decriptarea cheilor Stripe."
        )
    return decrypt(gs.stripe_secret_key_enc)


def stripe_webhook_secret(gs: GlobalSettings) -> str:
    if not gs.stripe_webhook_secret_enc:
        raise SubscriptionConfigError(
            "Stripe Webhook Secret nu este configurat. AdminV2 -> Abonament -> Setari."
        )
    if not fernet_configured():
        raise SubscriptionConfigError(
            "Cheia Fernet (eFactura) nu este configurata — necesara pentru decriptarea cheilor Stripe."
        )
    return decrypt(gs.stripe_webhook_secret_enc)


def price_eur(gs: GlobalSettings) -> Decimal:
    return Decimal(str(gs.subscription_price_eur or 0))


def vat_percent(gs: GlobalSettings) -> Decimal:
    return Decimal(str(gs.subscription_vat_percent or 0))


def charge_currency(gs: GlobalSettings) -> str:
    return (gs.subscription_currency_charge or "RON").upper()


def validate_issuer_complete(gs: GlobalSettings) -> list[str]:
    """Returneaza o lista cu campurile lipsa din issuer (BerlinStar SRL).
    Lista goala = totul ok pentru factura."""
    missing: list[str] = []
    for field in (
        "issuer_name",
        "issuer_cui",
        "issuer_city",
        "issuer_county_code",
    ):
        if not getattr(gs, field):
            missing.append(field)
    return missing
