"""Stripe integration pentru abonamentul anual BerlinStar.

Doua fluxuri de incasare, reconciliate identic (webhook sau `sync_payment`):
1. /api/subscription/checkout -> create_payment_intent
   Payment Element in pagina (card, Google Pay/Apple Pay daca browserul le are).
2. /api/subscription/checkout-session -> create_checkout_session
   Pagina Stripe hosted; URL-ul e afisat ca QR si platit de pe telefon
   (card, Google Pay, Apple Pay, PayPal — ce activeaza Dashboard-ul Stripe).

Webhook /api/subscription/webhook -> handle_event
   payment_intent.* si checkout.session.* -> status, scadenta, unlock, factura + SPV.
Fallback fara webhook: sync_payment citeste starea din Stripe (dev local, QR pe telefon).
"""
from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from decimal import ROUND_HALF_UP, Decimal
from typing import Any, Callable

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
    validate_issuer_complete,
    vat_percent,
)

log = logging.getLogger("berlinstar.subscriptions.stripe")

STRIPE_API_VERSION = "2024-12-18.acacia"
DESCRIPTION = "Abonament BerlinStar — 12 luni"
# Minimul acceptat de Stripe pentru expires_at; suficient pentru un QR scanat pe loc.
CHECKOUT_SESSION_TTL = timedelta(minutes=30)

CHECKOUT_EVENTS = {
    "checkout.session.completed",
    "checkout.session.async_payment_succeeded",
    "checkout.session.async_payment_failed",
    "checkout.session.expired",
}

# Strong refs: fara ele GC poate opri task-ul in mijlocul emiterii facturii.
_BG_TASKS: set[asyncio.Task] = set()


def _spawn_bg(coro) -> asyncio.Task:
    task = asyncio.create_task(coro)
    _BG_TASKS.add(task)
    task.add_done_callback(_BG_TASKS.discard)
    return task


def _q2(value: Decimal | float | int) -> Decimal:
    if not isinstance(value, Decimal):
        value = Decimal(str(value))
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def add_year(d: date) -> date:
    try:
        return d.replace(year=d.year + 1)
    except ValueError:
        return d.replace(year=d.year + 1, day=28)


def is_test_mode(gs: GlobalSettings) -> bool:
    return bool(gs.stripe_test_mode) or (gs.stripe_publishable_key or "").startswith("pk_test_")


def _stripe_with_key(gs: GlobalSettings) -> None:
    key = stripe_secret_key(gs)
    if gs.stripe_test_mode and key.startswith("sk_live_"):
        raise SubscriptionConfigError(
            "Stripe este pe Test mode, dar Secret Key-ul configurat este LIVE (sk_live_)."
        )
    if not gs.stripe_test_mode and key.startswith("sk_test_"):
        raise SubscriptionConfigError(
            "Stripe este pe Live mode, dar Secret Key-ul configurat este de test (sk_test_)."
        )
    stripe.api_key = key
    stripe.api_version = STRIPE_API_VERSION


def _to_dict(obj: Any) -> dict[str, Any]:
    if isinstance(obj, dict):
        return obj
    if hasattr(obj, "to_dict_recursive"):
        return obj.to_dict_recursive()
    return dict(obj)


async def _stripe_call(fn: Callable[..., Any], *args: Any, **kwargs: Any) -> dict[str, Any]:
    """SDK-ul Stripe e sincron; il rulam in thread ca sa nu blocam event loop-ul."""
    return _to_dict(await asyncio.to_thread(fn, *args, **kwargs))


# ---------- Sume ----------


@dataclass(frozen=True)
class ChargeAmounts:
    eur: Decimal
    ron_total: Decimal
    ron_net: Decimal
    ron_vat: Decimal
    fx_rate: Decimal
    fx_date: date
    stripe_amount: int
    stripe_currency: str

    def as_response(self) -> dict[str, Any]:
        return {
            "amount_ron": float(self.ron_total),
            "amount_eur": float(self.eur),
            "vat_amount_ron": float(self.ron_vat),
            "fx_rate": float(self.fx_rate),
            "fx_date": self.fx_date.isoformat(),
            "currency": self.stripe_currency.upper(),
        }


async def compute_amounts(gs: GlobalSettings) -> ChargeAmounts:
    """Pretul e brut (TVA inclus). Factura e mereu in RON la cursul BNR al zilei,
    indiferent daca Stripe incaseaza RON sau EUR."""
    eur_amount = price_eur(gs)
    if eur_amount <= 0:
        raise SubscriptionConfigError("Pretul abonamentului nu este configurat (>0 EUR).")
    fx = await fx_service.get_eur_to_ron()
    ron_total = _q2(eur_amount * fx.rate)
    vat_pct = vat_percent(gs)
    ron_net = _q2(ron_total / (Decimal("1") + vat_pct / Decimal("100"))) if vat_pct > 0 else ron_total
    ron_vat = _q2(ron_total - ron_net)

    if charge_currency(gs) == "RON":
        charged, currency = ron_total, "ron"
    else:
        charged, currency = _q2(eur_amount), "eur"
    stripe_amount = int((charged * Decimal("100")).to_integral_value(rounding=ROUND_HALF_UP))
    return ChargeAmounts(
        eur=eur_amount,
        ron_total=ron_total,
        ron_net=ron_net,
        ron_vat=ron_vat,
        fx_rate=fx.rate,
        fx_date=fx.date,
        stripe_amount=stripe_amount,
        stripe_currency=currency,
    )


# ---------- Creare plata ----------


async def _prepare(db: AsyncSession) -> GlobalSettings:
    gs = await get_or_create_global_settings(db)
    missing = validate_issuer_complete(gs)
    if missing:
        raise SubscriptionConfigError(
            "Datele firmei BerlinStar emitente sunt incomplete: " + ", ".join(missing)
        )
    _stripe_with_key(gs)
    return gs


def _period_for(sub: AccountSubscription | None, today: date) -> tuple[date, date]:
    """Prelungim de la scadenta curenta daca e in viitor, altfel de azi."""
    if sub is not None and sub.next_payment_date and sub.next_payment_date > today:
        start = sub.next_payment_date
    else:
        start = today
    return start, add_year(start)


async def _new_payment_row(
    db: AsyncSession, account: Account, customer: dict[str, Any], amounts: ChargeAmounts
) -> SubscriptionPayment:
    sub = (
        await db.execute(
            select(AccountSubscription).where(AccountSubscription.account_id == account.id)
        )
    ).scalar_one_or_none()
    period_start, period_end = _period_for(sub, date.today())
    payment = SubscriptionPayment(
        account_id=account.id,
        status="requires_payment",
        amount_eur=amounts.eur,
        amount_ron=amounts.ron_total,
        vat_amount_ron=amounts.ron_vat,
        fx_rate_eur_ron=amounts.fx_rate,
        fx_date=amounts.fx_date,
        period_start=period_start,
        period_end=period_end,
        customer_snapshot=customer,
    )
    db.add(payment)
    await db.flush()
    return payment


def _metadata(account: Account, payment: SubscriptionPayment, amounts: ChargeAmounts) -> dict[str, str]:
    return {
        "payment_id": str(payment.id),
        "account_id": str(account.id),
        "account_username": account.username,
        "subscription_eur": str(amounts.eur),
    }


def _customer_email(customer: dict[str, Any], account: Account) -> str | None:
    return customer.get("email") or account.email or None


async def create_payment_intent(
    db: AsyncSession, account: Account, customer: dict[str, Any]
) -> dict[str, Any]:
    """PaymentIntent pentru Payment Element (plata in pagina).
    Returneaza client_secret + sumele afisate + payment_id pentru polling."""
    gs = await _prepare(db)
    amounts = await compute_amounts(gs)
    payment = await _new_payment_row(db, account, customer, amounts)

    kwargs: dict[str, Any] = dict(
        amount=amounts.stripe_amount,
        currency=amounts.stripe_currency,
        metadata=_metadata(account, payment, amounts),
        automatic_payment_methods={"enabled": True},
        description=DESCRIPTION,
    )
    email = _customer_email(customer, account)
    if email:
        kwargs["receipt_email"] = email
    try:
        intent = await _stripe_call(stripe.PaymentIntent.create, **kwargs)
    except stripe.StripeError as exc:
        await db.rollback()
        log.error("Stripe PaymentIntent.create failed: %s", exc)
        raise SubscriptionConfigError(f"Stripe a refuzat crearea platii: {exc.user_message or exc}")

    payment.stripe_payment_intent_id = intent["id"]
    await db.commit()
    return {
        **amounts.as_response(),
        "payment_id": payment.id,
        "client_secret": intent["client_secret"],
        "payment_intent_id": intent["id"],
        "publishable_key": gs.stripe_publishable_key or "",
        "test_mode": is_test_mode(gs),
    }


def _with_query(url: str, extra: str) -> str:
    base = url.split("#", 1)[0]
    return f"{base}{'&' if '?' in base else '?'}{extra}"


async def create_checkout_session(
    db: AsyncSession, account: Account, customer: dict[str, Any], return_url: str
) -> dict[str, Any]:
    """Checkout Session hosted (URL pentru QR). Metodele de plata vin dinamic din
    Dashboard-ul Stripe (card, Google Pay, Apple Pay, PayPal daca e activat)."""
    gs = await _prepare(db)
    amounts = await compute_amounts(gs)
    payment = await _new_payment_row(db, account, customer, amounts)
    meta = _metadata(account, payment, amounts)
    expires_at = datetime.now(timezone.utc) + CHECKOUT_SESSION_TTL
    email = _customer_email(customer, account)

    intent_data: dict[str, Any] = {"metadata": meta, "description": DESCRIPTION}
    if email:
        intent_data["receipt_email"] = email
    kwargs: dict[str, Any] = dict(
        mode="payment",
        line_items=[{
            "quantity": 1,
            "price_data": {
                "currency": amounts.stripe_currency,
                "unit_amount": amounts.stripe_amount,
                "product_data": {"name": DESCRIPTION},
            },
        }],
        success_url=_with_query(return_url, f"payment=success&payment_id={payment.id}"),
        cancel_url=_with_query(return_url, f"payment=cancel&payment_id={payment.id}"),
        client_reference_id=str(payment.id),
        metadata=meta,
        payment_intent_data=intent_data,
        expires_at=int(expires_at.timestamp()),
        locale="ro",
    )
    if email:
        kwargs["customer_email"] = email
    try:
        session = await _stripe_call(stripe.checkout.Session.create, **kwargs)
    except stripe.StripeError as exc:
        await db.rollback()
        log.error("Stripe checkout.Session.create failed: %s", exc)
        raise SubscriptionConfigError(f"Stripe a refuzat crearea platii: {exc.user_message or exc}")

    payment.stripe_checkout_session_id = session["id"]
    pi = session.get("payment_intent")
    if isinstance(pi, str):
        payment.stripe_payment_intent_id = pi
    await db.commit()
    return {
        **amounts.as_response(),
        "payment_id": payment.id,
        "session_id": session["id"],
        "url": session["url"],
        "expires_at": expires_at.isoformat(),
        "test_mode": is_test_mode(gs),
    }


# ---------- Webhook ----------


def verify_event(payload_bytes: bytes, sig_header: str, webhook_secret: str) -> dict[str, Any]:
    return stripe.Webhook.construct_event(payload_bytes, sig_header, webhook_secret)


def _metadata_payment_id(data: dict[str, Any]) -> int | None:
    raw = (data.get("metadata") or {}).get("payment_id") or data.get("client_reference_id")
    try:
        return int(raw) if raw else None
    except (TypeError, ValueError):
        return None


async def _find_payment(db: AsyncSession, data: dict[str, Any]) -> SubscriptionPayment | None:
    """Row lock: Stripe poate livra acelasi eveniment de doua ori in paralel."""
    obj_id = data.get("id")
    col = (
        SubscriptionPayment.stripe_checkout_session_id
        if data.get("object") == "checkout.session"
        else SubscriptionPayment.stripe_payment_intent_id
    )
    payment = None
    if obj_id:
        payment = (
            await db.execute(select(SubscriptionPayment).where(col == obj_id).with_for_update())
        ).scalar_one_or_none()
    if payment is None:
        pid = _metadata_payment_id(data)
        if pid is not None:
            payment = (
                await db.execute(
                    select(SubscriptionPayment).where(SubscriptionPayment.id == pid).with_for_update()
                )
            ).scalar_one_or_none()
    return payment


def _link_ids(payment: SubscriptionPayment, data: dict[str, Any]) -> None:
    if data.get("object") == "checkout.session":
        payment.stripe_checkout_session_id = payment.stripe_checkout_session_id or data.get("id")
        pi = data.get("payment_intent")
        if isinstance(pi, str) and not payment.stripe_payment_intent_id:
            payment.stripe_payment_intent_id = pi
    elif data.get("object") == "payment_intent" and not payment.stripe_payment_intent_id:
        payment.stripe_payment_intent_id = data.get("id")


async def handle_event(db: AsyncSession, event: dict[str, Any]) -> None:
    event_type = event.get("type") or ""
    data = event.get("data", {}).get("object", {}) or {}
    if not data.get("id"):
        log.warning("Stripe webhook fara id (type=%s)", event_type)
        return

    payment = await _find_payment(db, data)
    if payment is None:
        log.warning("Webhook pentru obiect necunoscut: %s (type=%s)", data.get("id"), event_type)
        return
    _link_ids(payment, data)
    gs = await get_or_create_global_settings(db)
    await _apply_event(db, gs, payment, event_type, data)


async def _apply_event(
    db: AsyncSession,
    gs: GlobalSettings,
    payment: SubscriptionPayment,
    event_type: str,
    data: dict[str, Any],
) -> None:
    now = datetime.now(timezone.utc)
    if event_type in ("checkout.session.completed", "checkout.session.async_payment_succeeded"):
        if data.get("payment_status") == "paid":
            await _mark_succeeded(db, gs, payment, intent_id=data.get("payment_intent"))
        else:
            await _set_status(db, payment, "processing", now)
    elif event_type == "checkout.session.async_payment_failed":
        await _mark_failed(db, payment, "Plata (metoda asincrona) a fost respinsa.")
    elif event_type == "checkout.session.expired":
        if payment.status in ("requires_payment", "processing"):
            await _set_status(db, payment, "canceled", now)
    elif event_type == "payment_intent.succeeded":
        charge_id = data.get("latest_charge")
        if not isinstance(charge_id, str):
            charges = (data.get("charges") or {}).get("data") or []
            charge_id = charges[0].get("id") if charges else None
        await _mark_succeeded(db, gs, payment, intent_id=data.get("id"), charge_id=charge_id)
    elif event_type == "payment_intent.payment_failed":
        err = data.get("last_payment_error") or {}
        await _mark_failed(db, payment, err.get("message") or "Plata respinsa.")
    elif event_type == "payment_intent.canceled":
        if payment.status != "succeeded":
            await _set_status(db, payment, "canceled", now)
    elif event_type == "payment_intent.processing":
        if payment.status == "requires_payment":
            await _set_status(db, payment, "processing", now)
    else:
        await db.commit()
        log.info("Webhook Stripe ignorat: %s", event_type)


async def _set_status(db: AsyncSession, payment: SubscriptionPayment, status: str, now: datetime) -> None:
    payment.status = status
    payment.updated_at = now
    await db.commit()


async def _mark_failed(db: AsyncSession, payment: SubscriptionPayment, reason: str) -> None:
    if payment.status == "succeeded":
        await db.commit()
        return
    payment.status = "failed"
    payment.failure_reason = reason
    payment.updated_at = datetime.now(timezone.utc)
    await db.commit()
    log.warning(
        "Plata abonament esuata account_id=%s pi=%s: %s",
        payment.account_id, payment.stripe_payment_intent_id, reason,
    )


def _describe_charge(charge: dict[str, Any]) -> str | None:
    pmd = charge.get("payment_method_details") or {}
    kind = pmd.get("type")
    if kind == "card":
        wallet = (pmd.get("card") or {}).get("wallet") or {}
        return wallet.get("type") or "card"
    return kind


async def _fetch_charge_details(
    gs: GlobalSettings, intent_id: str | None, charge_id: str | None
) -> tuple[str | None, str | None]:
    """(charge_id, metoda de plata) din Stripe; best-effort, nu blocheaza confirmarea."""
    try:
        _stripe_with_key(gs)
        if charge_id:
            charge = await _stripe_call(stripe.Charge.retrieve, charge_id)
        elif intent_id:
            intent = await _stripe_call(stripe.PaymentIntent.retrieve, intent_id, expand=["latest_charge"])
            charge = intent.get("latest_charge")
            if not isinstance(charge, dict):
                return None, None
        else:
            return None, None
        return charge.get("id"), _describe_charge(charge)
    except Exception as exc:  # noqa: BLE001
        log.warning("Nu am putut citi detaliile charge-ului (%s/%s): %s", intent_id, charge_id, exc)
        return charge_id, None


async def _mark_succeeded(
    db: AsyncSession,
    gs: GlobalSettings,
    payment: SubscriptionPayment,
    *,
    intent_id: str | None,
    charge_id: str | None = None,
) -> bool:
    """Idempotent: a doua confirmare pentru aceeasi plata nu mai schimba nimic."""
    if payment.status == "succeeded":
        await db.commit()
        log.info("Plata %s deja confirmata — skip", payment.id)
        return False

    if isinstance(intent_id, str) and not payment.stripe_payment_intent_id:
        payment.stripe_payment_intent_id = intent_id
    charge_id, method = await _fetch_charge_details(gs, payment.stripe_payment_intent_id, charge_id)
    payment.stripe_charge_id = charge_id or payment.stripe_charge_id
    payment.payment_method_type = method or payment.payment_method_type

    now = datetime.now(timezone.utc)
    today = date.today()
    payment.status = "succeeded"
    payment.paid_at = now
    payment.updated_at = now
    payment.failure_reason = None

    sub = (
        await db.execute(
            select(AccountSubscription).where(AccountSubscription.account_id == payment.account_id)
        )
    ).scalar_one_or_none()
    next_date = payment.period_end or add_year(today)
    if sub is None:
        sub = AccountSubscription(
            account_id=payment.account_id, next_payment_date=next_date, last_payment_date=today
        )
        db.add(sub)
    else:
        sub.next_payment_date = next_date
        sub.last_payment_date = today
        sub.renewal_email_sent_for = None
        sub.updated_at = now

    account = (
        await db.execute(select(Account).where(Account.id == payment.account_id))
    ).scalar_one_or_none()
    if account is not None and account.is_locked:
        account.is_locked = False
        account.locked_at = None
        account.updated_at = now

    await db.commit()
    log.info(
        "Plata abonament confirmata account_id=%s payment_id=%s metoda=%s next_payment=%s",
        payment.account_id, payment.id, method, next_date.isoformat(),
    )
    from app.subscriptions import invoice_service

    _spawn_bg(invoice_service.issue_invoice_async(payment.id))
    return True


# ---------- Reconciliere fara webhook ----------


async def sync_payment(db: AsyncSession, payment: SubscriptionPayment) -> SubscriptionPayment:
    """Citeste starea reala din Stripe si o aplica. Folosit de polling-ul din UI
    (QR pe telefon, dev local fara Stripe CLI) si de butonul „Verifica plata"."""
    if payment.status == "succeeded":
        return payment
    gs = await get_or_create_global_settings(db)
    _stripe_with_key(gs)
    now = datetime.now(timezone.utc)

    if payment.stripe_checkout_session_id and not payment.stripe_payment_intent_id:
        session = await _stripe_call(stripe.checkout.Session.retrieve, payment.stripe_checkout_session_id)
        pi = session.get("payment_intent")
        if isinstance(pi, str):
            payment.stripe_payment_intent_id = pi
        elif session.get("status") == "expired":
            await _set_status(db, payment, "canceled", now)
            return payment
        elif session.get("payment_status") == "paid":
            await _mark_succeeded(db, gs, payment, intent_id=None)
            return payment
        else:
            await db.commit()
            return payment

    if not payment.stripe_payment_intent_id:
        return payment
    intent = await _stripe_call(stripe.PaymentIntent.retrieve, payment.stripe_payment_intent_id)
    status = intent.get("status")
    if status == "succeeded":
        charge = intent.get("latest_charge")
        await _mark_succeeded(
            db, gs, payment, intent_id=intent.get("id"),
            charge_id=charge if isinstance(charge, str) else None,
        )
    elif status == "canceled":
        await _set_status(db, payment, "canceled", now)
    elif status == "processing":
        await _set_status(db, payment, "processing", now)
    else:
        err = intent.get("last_payment_error") or {}
        if err.get("message"):
            payment.failure_reason = err["message"]
            payment.updated_at = now
        await db.commit()
    return payment
