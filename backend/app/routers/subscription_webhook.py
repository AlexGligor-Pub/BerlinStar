"""Stripe webhook handler pentru abonament.

Mount: /api/subscription/webhook
NU foloseste middleware-ul OAuth — Stripe se autentifica prin semnatura
header-ului `Stripe-Signature`. Webhook secret-ul e stocat criptat in DB
(global_settings.stripe_webhook_secret_enc).
"""
from __future__ import annotations

import logging

import stripe
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.subscriptions import stripe_service
from app.subscriptions.settings import (
    SubscriptionConfigError,
    get_or_create_global_settings,
    stripe_webhook_secret,
)

log = logging.getLogger("berlinstar.subscription.webhook")

router = APIRouter()


@router.post("/webhook")
async def stripe_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
    stripe_signature: str | None = Header(None, alias="Stripe-Signature"),
):
    if not stripe_signature:
        raise HTTPException(400, "Lipseste header-ul Stripe-Signature.")

    gs = await get_or_create_global_settings(db)
    try:
        secret = stripe_webhook_secret(gs)
    except SubscriptionConfigError as exc:
        log.error("Webhook fara secret configurat: %s", exc)
        raise HTTPException(503, str(exc))

    payload = await request.body()

    try:
        event = stripe_service.verify_event(payload, stripe_signature, secret)
    except (ValueError, stripe.SignatureVerificationError) as exc:
        log.warning("Stripe webhook signature invalid: %s", exc)
        raise HTTPException(400, "Semnatura Stripe invalida.")

    # event poate fi obiect Stripe sau dict — normalizam la dict
    if hasattr(event, "to_dict_recursive"):
        event = event.to_dict_recursive()
    elif not isinstance(event, dict):
        event = dict(event)

    try:
        await stripe_service.handle_event(db, event)
    except Exception:  # noqa: BLE001
        # Handler-ele sunt idempotente, deci lasam Stripe sa reincerce (backoff, max 3 zile).
        log.exception("Webhook handler raised (type=%s)", event.get("type"))
        raise HTTPException(500, "Eroare interna la procesarea webhook-ului.")
    return {"received": True}
