"""User-facing endpoints pentru abonamentul BerlinStar.

Mount: /api/subscription/*
Auth: adminul contului (get_admin_account) — abonamentul si facturile
catre noi sunt treaba proprietarului, nu a managerilor.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_admin_account
from app.models.account import Account
from app.models.subscription import SubscriptionPayment
from app.subscriptions import invoice_service, notifications, stripe_service
from app.subscriptions.settings import (
    SubscriptionConfigError,
    get_or_create_global_settings,
)

log = logging.getLogger("berlinstar.subscription")

router = APIRouter()


class SubscriptionStatusOut(BaseModel):
    configured: bool
    next_payment_date: str | None
    last_payment_date: str | None
    days_left: int | None
    banner_kind: str
    show_banner: bool
    message: str
    price_eur: float
    vat_percent: float
    test_mode: bool


class CheckoutCustomer(BaseModel):
    nume: str = Field(..., min_length=1, max_length=255)
    tip: str = Field("juridic", pattern="^(juridic|fizic)$")
    cui: str | None = Field(None, max_length=20)
    email: EmailStr | None = None
    telefon: str | None = Field(None, max_length=50)
    adresa: str | None = Field(None, max_length=500)
    street: str | None = Field(None, max_length=255)
    city: str | None = Field(None, max_length=100)
    county_code: str | None = Field(None, max_length=10)
    postal_code: str | None = Field(None, max_length=20)
    country_code: str | None = Field("RO", max_length=2)


class CheckoutRequest(BaseModel):
    customer: CheckoutCustomer


class CheckoutSessionRequest(CheckoutRequest):
    return_url: str = Field(..., min_length=8, max_length=500, pattern="^https?://")


class AmountsOut(BaseModel):
    payment_id: int
    amount_ron: float
    amount_eur: float
    vat_amount_ron: float
    fx_rate: float
    fx_date: str
    currency: str
    test_mode: bool


class CheckoutResponse(AmountsOut):
    client_secret: str
    payment_intent_id: str
    publishable_key: str


class CheckoutSessionResponse(AmountsOut):
    session_id: str
    url: str
    expires_at: str


class InvoiceHistoryItem(BaseModel):
    id: int
    status: str
    paid_at: str | None
    amount_ron: float
    amount_eur: float
    payment_method: str | None
    period_start: str | None
    period_end: str | None
    failure_reason: str | None
    invoice_number: str | None
    invoice_issue_date: str | None
    anaf_status: str | None
    pdf_available: bool
    zip_available: bool


class ConfigOut(BaseModel):
    publishable_key: str
    price_eur: float
    vat_percent: float
    currency: str
    test_mode: bool


def _invoice_label(p: SubscriptionPayment) -> str | None:
    if p.invoice_series and p.invoice_number:
        return f"{p.invoice_series}{p.invoice_number:04d}"
    return None


def _to_item(r: SubscriptionPayment) -> InvoiceHistoryItem:
    return InvoiceHistoryItem(
        id=r.id,
        status=r.status,
        paid_at=r.paid_at.isoformat() if r.paid_at else None,
        amount_ron=float(r.amount_ron),
        amount_eur=float(r.amount_eur),
        payment_method=r.payment_method_type,
        period_start=r.period_start.isoformat() if r.period_start else None,
        period_end=r.period_end.isoformat() if r.period_end else None,
        failure_reason=r.failure_reason,
        invoice_number=_invoice_label(r),
        invoice_issue_date=r.invoice_issue_date.isoformat() if r.invoice_issue_date else None,
        anaf_status=r.anaf_status,
        pdf_available=bool(r.pdf_s3_key),
        zip_available=bool(r.anaf_response_zip_s3_key),
    )


async def _own_payment(db: AsyncSession, account: Account, payment_id: int) -> SubscriptionPayment:
    payment = (
        await db.execute(
            select(SubscriptionPayment).where(
                SubscriptionPayment.id == payment_id,
                SubscriptionPayment.account_id == account.id,
            )
        )
    ).scalar_one_or_none()
    if payment is None:
        raise HTTPException(404, "Plata inexistenta.")
    return payment


@router.get("/config", response_model=ConfigOut)
async def subscription_config(db: AsyncSession = Depends(get_db)):
    """Configurare publica pentru frontend (publishable key Stripe + pret).

    Cheia publica e oricum expusa in browser; nu e secreta.
    """
    gs = await get_or_create_global_settings(db)
    return ConfigOut(
        publishable_key=gs.stripe_publishable_key or "",
        price_eur=float(gs.subscription_price_eur or 0),
        vat_percent=float(gs.subscription_vat_percent or 0),
        currency=(gs.subscription_currency_charge or "RON").upper(),
        test_mode=stripe_service.is_test_mode(gs),
    )


@router.get("/me", response_model=SubscriptionStatusOut)
async def my_subscription_status(
    account: Account = Depends(get_admin_account),
    db: AsyncSession = Depends(get_db),
):
    status = await notifications.get_status(db, account.id)
    gs = await get_or_create_global_settings(db)
    return SubscriptionStatusOut(
        configured=status["configured"],
        next_payment_date=status["next_payment_date"],
        last_payment_date=status["last_payment_date"],
        days_left=status["days_left"],
        banner_kind=status["banner_kind"],
        show_banner=status["show_banner"],
        message=status["message"],
        price_eur=float(gs.subscription_price_eur or 0),
        vat_percent=float(gs.subscription_vat_percent or 0),
        test_mode=stripe_service.is_test_mode(gs),
    )


@router.get("/payments", response_model=list[InvoiceHistoryItem])
async def my_payments(
    account: Account = Depends(get_admin_account),
    db: AsyncSession = Depends(get_db),
):
    rows = (
        await db.execute(
            select(SubscriptionPayment)
            .where(SubscriptionPayment.account_id == account.id)
            .order_by(desc(SubscriptionPayment.created_at))
            .limit(50)
        )
    ).scalars().all()
    return [_to_item(r) for r in rows]


@router.get("/payments/{payment_id}", response_model=InvoiceHistoryItem)
async def payment_status(
    payment_id: int,
    account: Account = Depends(get_admin_account),
    db: AsyncSession = Depends(get_db),
):
    return _to_item(await _own_payment(db, account, payment_id))


@router.post("/payments/{payment_id}/sync", response_model=InvoiceHistoryItem)
async def payment_sync(
    payment_id: int,
    account: Account = Depends(get_admin_account),
    db: AsyncSession = Depends(get_db),
):
    """Reconciliere cu Stripe fara webhook (QR platit pe telefon, dev local)."""
    payment = await _own_payment(db, account, payment_id)
    try:
        payment = await stripe_service.sync_payment(db, payment)
    except SubscriptionConfigError as exc:
        raise HTTPException(503, str(exc))
    except Exception:  # noqa: BLE001
        log.exception("Sync failed for payment_id=%s", payment_id)
        raise HTTPException(502, "Stripe nu a raspuns; reincearca in cateva secunde.")
    return _to_item(payment)


@router.post("/checkout", response_model=CheckoutResponse)
async def checkout(
    body: CheckoutRequest,
    account: Account = Depends(get_admin_account),
    db: AsyncSession = Depends(get_db),
):
    try:
        result = await stripe_service.create_payment_intent(
            db, account, customer=body.customer.model_dump()
        )
    except SubscriptionConfigError as exc:
        raise HTTPException(503, str(exc))
    except Exception:  # noqa: BLE001
        log.exception("Checkout failed for account_id=%s", account.id)
        raise HTTPException(500, "Eroare la initierea platii.")
    return CheckoutResponse(**result)


@router.post("/checkout-session", response_model=CheckoutSessionResponse)
async def checkout_session(
    body: CheckoutSessionRequest,
    account: Account = Depends(get_admin_account),
    db: AsyncSession = Depends(get_db),
):
    """Pagina Stripe hosted, afisata ca QR: card / Google Pay / Apple Pay / PayPal."""
    try:
        result = await stripe_service.create_checkout_session(
            db, account, customer=body.customer.model_dump(), return_url=body.return_url
        )
    except SubscriptionConfigError as exc:
        raise HTTPException(503, str(exc))
    except Exception:  # noqa: BLE001
        log.exception("Checkout session failed for account_id=%s", account.id)
        raise HTTPException(500, "Eroare la initierea platii.")
    return CheckoutSessionResponse(**result)


def _file_response(payment: SubscriptionPayment, data: bytes, media_type: str, suffix: str) -> Response:
    label = _invoice_label(payment) or f"factura-{payment.id}"
    return Response(
        content=data,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{label}{suffix}"'},
    )


@router.get("/invoices/{payment_id}/pdf")
async def download_pdf(
    payment_id: int,
    account: Account = Depends(get_admin_account),
    db: AsyncSession = Depends(get_db),
):
    payment = await _own_payment(db, account, payment_id)
    if not payment.pdf_s3_key:
        raise HTTPException(404, "PDF nu este inca generat.")
    try:
        data = invoice_service.get_pdf_bytes(payment)
    except FileNotFoundError as exc:
        raise HTTPException(404, str(exc))
    return _file_response(payment, data, "application/pdf", ".pdf")


@router.get("/invoices/{payment_id}/anaf-zip")
async def download_anaf_zip(
    payment_id: int,
    account: Account = Depends(get_admin_account),
    db: AsyncSession = Depends(get_db),
):
    payment = await _own_payment(db, account, payment_id)
    if not payment.anaf_response_zip_s3_key:
        raise HTTPException(404, "ZIP-ul ANAF nu este inca disponibil.")
    try:
        data = invoice_service.get_zip_bytes(payment)
    except FileNotFoundError as exc:
        raise HTTPException(404, str(exc))
    return _file_response(payment, data, "application/zip", "-anaf.zip")
