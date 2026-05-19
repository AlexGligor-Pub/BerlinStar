"""Stripe integration pentru abonamentul anual BerlinStar.

Flux:
1. /api/subscription/checkout -> create_payment_intent
   - Calculeaza RON din EUR (curs BNR de azi)
   - Creeaza PaymentIntent Stripe in moneda configurata (RON)
   - Returneaza client_secret catre frontend pentru @stripe/stripe-js
2. Stripe webhook /api/subscription/webhook -> handle_event
   - payment_intent.succeeded -> avanseaza scadenta, unlock cont, emite factura, upload SPV
   - payment_intent.payment_failed -> marcheaza failed, salveaza motivul
"""
from __future__ import annotations

import logging
from datetime import date, datetime, timedelta, timezone
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

import stripe
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.account import Account
from app.models.global_settings import GlobalSettings
from app.models.subscription import AccountSubscription, SubscriptionPayment
from app.subscriptions import fx_service
from app.subscriptions.settings import (
    SubscriptionConfigError,
    charge_currency,
    get_or_create_global_settings,
    price_eur,
    stripe_secret_key,
    stripe_webhook_secret,
    validate_issuer_complete,
    vat_percent,
)

log = logging.getLogger("berlinstar.subscriptions.stripe")


def _q2(value: Decimal | float | int) -> Decimal:
    if not isinstance(value, Decimal):
        value = Decimal(str(value))
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _stripe_with_key(gs: GlobalSettings) -> None:
    stripe.api_key = stripe_secret_key(gs)
    # versionare API stabila ca sa nu se schimbe shape-ul webhook-ului
    stripe.api_version = "2024-12-18.acacia"


async def _get_or_create_subscription(db: AsyncSession, account_id: int, gs: GlobalSettings) -> AccountSubscription:
    sub = (
        await db.execute(
            select(AccountSubscription).where(AccountSubscription.account_id == account_id)
        )
    ).scalar_one_or_none()
    if sub is None:
        sub = AccountSubscription(
            account_id=account_id,
            next_payment_date=date.today() + timedelta(days=365),
        )
        db.add(sub)
        await db.commit()
        await db.refresh(sub)
    return sub


async def create_payment_intent(
    db: AsyncSession,
    account: Account,
    customer: dict[str, Any],
) -> dict[str, Any]:
    """Creeaza un Stripe PaymentIntent pentru reinnoirea abonamentului.

    `customer` contine datele clientului pentru factura: nume, cui (optional),
    adresa, etc. Sunt validate la nivel de Pydantic in router.
    Returneaza {client_secret, payment_intent_id, amount_ron, fx_rate}.
    """
    gs = await get_or_create_global_settings(db)
    missing = validate_issuer_complete(gs)
    if missing:
        raise SubscriptionConfigError(
            "Datele firmei BerlinStar emitente sunt incomplete: " + ", ".join(missing)
        )

    _stripe_with_key(gs)

    eur_amount = price_eur(gs)
    if eur_amount <= 0:
        raise SubscriptionConfigError("Pretul abonamentului nu este configurat (>0 EUR).")

    currency = charge_currency(gs)
    if currency == "RON":
        fx = await fx_service.get_eur_to_ron()
        ron_total = _q2(eur_amount * fx.rate)
        # TVA inclus in pret (default 19%): net = brut / (1 + vat/100)
        vat_pct = vat_percent(gs)
        if vat_pct > 0:
            ron_net = _q2(ron_total / (Decimal("1") + vat_pct / Decimal("100")))
        else:
            ron_net = ron_total
        ron_vat = _q2(ron_total - ron_net)
        stripe_amount = int((ron_total * Decimal("100")).to_integral_value(rounding=ROUND_HALF_UP))
        stripe_currency = "ron"
        fx_rate_used = fx.rate
        fx_date_used = fx.date
    else:
        # EUR direct — pastrat pentru flexibilitate viitoare
        ron_total = _q2(eur_amount)
        vat_pct = vat_percent(gs)
        ron_net = _q2(ron_total / (Decimal("1") + vat_pct / Decimal("100"))) if vat_pct > 0 else ron_total
        ron_vat = _q2(ron_total - ron_net)
        stripe_amount = int((eur_amount * Decimal("100")).to_integral_value(rounding=ROUND_HALF_UP))
        stripe_currency = "eur"
        fx_rate_used = Decimal("1")
        fx_date_used = date.today()

    # Creeaza PaymentIntent — automatic_payment_methods=automatic acopera
    # card + Apple Pay + Google Pay fara configurare suplimentara.
    try:
        intent = await _stripe_create_intent(
            amount=stripe_amount,
            currency=stripe_currency,
            metadata={
                "account_id": str(account.id),
                "account_username": account.username,
                "subscription_eur": str(eur_amount),
            },
            receipt_email=(customer.get("email") or account.email or None),
        )
    except stripe.StripeError as exc:  # noqa: BLE001
        log.error("Stripe create_intent failed: %s", exc)
        raise SubscriptionConfigError(f"Stripe a refuzat crearea platii: {exc.user_message or exc}")

    today = date.today()
    sub = await _get_or_create_subscription(db, account.id, gs)

    # Decide perioada acoperita de aceasta plata.
    # Daca contul are inca zile ramase (next_payment_date in viitor), prelungim
    # incepand de la next_payment_date; altfel, perioada incepe azi.
    if sub.next_payment_date and sub.next_payment_date > today:
        period_start = sub.next_payment_date
    else:
        period_start = today
    period_end = period_start.replace(year=period_start.year + 1)

    payment = SubscriptionPayment(
        account_id=account.id,
        stripe_payment_intent_id=intent["id"],
        status="requires_payment",
        amount_eur=eur_amount,
        amount_ron=ron_total,
        vat_amount_ron=ron_vat,
        fx_rate_eur_ron=fx_rate_used,
        fx_date=fx_date_used,
        period_start=period_start,
        period_end=period_end,
        customer_snapshot=customer,
    )
    db.add(payment)
    await db.commit()
    await db.refresh(payment)

    return {
        "client_secret": intent["client_secret"],
        "payment_intent_id": intent["id"],
        "amount_ron": float(ron_total),
        "amount_eur": float(eur_amount),
        "vat_amount_ron": float(ron_vat),
        "fx_rate": float(fx_rate_used),
        "fx_date": fx_date_used.isoformat(),
        "currency": stripe_currency.upper(),
        "publishable_key": gs.stripe_publishable_key or "",
    }


async def _stripe_create_intent(
    *,
    amount: int,
    currency: str,
    metadata: dict[str, str],
    receipt_email: str | None,
) -> dict[str, Any]:
    """Wrapper sync->async pentru stripe.PaymentIntent.create."""
    import asyncio

    def _create() -> dict[str, Any]:
        kwargs = dict(
            amount=amount,
            currency=currency,
            metadata=metadata,
            automatic_payment_methods={"enabled": True},
            description="Abonament BerlinStar — 12 luni",
        )
        if receipt_email:
            kwargs["receipt_email"] = receipt_email
        intent = stripe.PaymentIntent.create(**kwargs)
        return intent.to_dict_recursive() if hasattr(intent, "to_dict_recursive") else dict(intent)

    return await asyncio.to_thread(_create)


# ---------- Webhook ----------


def verify_event(payload_bytes: bytes, sig_header: str, webhook_secret: str) -> dict[str, Any]:
    """Verifica semnatura Stripe si returneaza event-ul parsed."""
    return stripe.Webhook.construct_event(payload_bytes, sig_header, webhook_secret)


async def handle_event(db: AsyncSession, event: dict[str, Any]) -> None:
    event_type = event.get("type")
    data = event.get("data", {}).get("object", {})
    intent_id = data.get("id")
    if not intent_id:
        log.warning("Stripe webhook fara id (type=%s)", event_type)
        return

    payment = (
        await db.execute(
            select(SubscriptionPayment).where(
                SubscriptionPayment.stripe_payment_intent_id == intent_id
            )
        )
    ).scalar_one_or_none()
    if payment is None:
        log.warning("Webhook pentru PI necunoscut: %s (type=%s)", intent_id, event_type)
        return

    if event_type == "payment_intent.succeeded":
        await _on_payment_succeeded(db, payment, data)
    elif event_type == "payment_intent.payment_failed":
        await _on_payment_failed(db, payment, data)
    elif event_type == "payment_intent.canceled":
        payment.status = "canceled"
        payment.updated_at = datetime.now(timezone.utc)
        await db.commit()
    elif event_type == "payment_intent.processing":
        if payment.status == "requires_payment":
            payment.status = "processing"
            payment.updated_at = datetime.now(timezone.utc)
            await db.commit()
    else:
        log.info("Webhook Stripe ignorat: %s", event_type)


async def _on_payment_succeeded(
    db: AsyncSession,
    payment: SubscriptionPayment,
    data: dict[str, Any],
) -> None:
    if payment.status == "succeeded":
        log.info("PaymentIntent %s deja procesat — skip", payment.stripe_payment_intent_id)
        return

    charges = data.get("charges") or {}
    charge_list = charges.get("data") or []
    if charge_list:
        payment.stripe_charge_id = charge_list[0].get("id")

    payment.status = "succeeded"
    payment.paid_at = datetime.now(timezone.utc)
    payment.updated_at = payment.paid_at

    # Avanseaza scadenta abonamentului
    sub = (
        await db.execute(
            select(AccountSubscription).where(
                AccountSubscription.account_id == payment.account_id
            )
        )
    ).scalar_one_or_none()
    today = date.today()
    if sub is None:
        sub = AccountSubscription(
            account_id=payment.account_id,
            next_payment_date=payment.period_end or (today + timedelta(days=365)),
            last_payment_date=today,
        )
        db.add(sub)
    else:
        sub.next_payment_date = payment.period_end or (
            sub.next_payment_date.replace(year=sub.next_payment_date.year + 1)
            if sub.next_payment_date
            else today + timedelta(days=365)
        )
        sub.last_payment_date = today
        sub.renewal_email_sent_for = None
        sub.updated_at = datetime.now(timezone.utc)

    # Deblocheaza contul (a fost lock-at de scheduler la scadenta).
    account = (
        await db.execute(select(Account).where(Account.id == payment.account_id))
    ).scalar_one_or_none()
    if account is not None and account.is_locked:
        account.is_locked = False
        account.locked_at = None
        account.updated_at = datetime.now(timezone.utc)

    await db.commit()
    log.info(
        "Subscription payment succeeded account_id=%s, next_payment=%s",
        payment.account_id, sub.next_payment_date.isoformat(),
    )

    # Genereaza factura + upload SPV in background (nu blocam webhook-ul Stripe)
    import asyncio
    from app.subscriptions import invoice_service

    asyncio.create_task(invoice_service.issue_invoice_async(payment.id))


async def _on_payment_failed(
    db: AsyncSession,
    payment: SubscriptionPayment,
    data: dict[str, Any],
) -> None:
    payment.status = "failed"
    err = data.get("last_payment_error") or {}
    payment.failure_reason = err.get("message") or "Plata respinsa."
    payment.updated_at = datetime.now(timezone.utc)
    await db.commit()
    log.warning(
        "PaymentIntent %s esuat pentru account_id=%s: %s",
        payment.stripe_payment_intent_id, payment.account_id, payment.failure_reason,
    )
