"""User-facing endpoints pentru abonamentul BerlinStar.

Mount: /api/subscription/*
Auth: account normal (get_current_account).
"""
from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_account
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


class CheckoutResponse(BaseModel):
    client_secret: str
    payment_intent_id: str
    amount_ron: float
    amount_eur: float
    vat_amount_ron: float
    fx_rate: float
    fx_date: str
    currency: str
    publishable_key: str


class InvoiceHistoryItem(BaseModel):
    id: int
    status: str
    paid_at: str | None
    amount_ron: float
    amount_eur: float
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
    )


@router.get("/me", response_model=SubscriptionStatusOut)
async def my_subscription_status(
    account: Account = Depends(get_current_account),
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
    )


@router.get("/payments", response_model=list[InvoiceHistoryItem])
async def my_payments(
    account: Account = Depends(get_current_account),
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
    out: list[InvoiceHistoryItem] = []
    for r in rows:
        invoice_label = None
        if r.invoice_series and r.invoice_number:
            invoice_label = f"{r.invoice_series}{r.invoice_number:04d}"
        out.append(
            InvoiceHistoryItem(
                id=r.id,
                status=r.status,
                paid_at=r.paid_at.isoformat() if r.paid_at else None,
                amount_ron=float(r.amount_ron),
                amount_eur=float(r.amount_eur),
                invoice_number=invoice_label,
                invoice_issue_date=r.invoice_issue_date.isoformat() if r.invoice_issue_date else None,
                anaf_status=r.anaf_status,
                pdf_available=bool(r.pdf_s3_key),
                zip_available=bool(r.anaf_response_zip_s3_key),
            )
        )
    return out


@router.post("/checkout", response_model=CheckoutResponse)
async def checkout(
    body: CheckoutRequest,
    account: Account = Depends(get_current_account),
    db: AsyncSession = Depends(get_db),
):
    try:
        result = await stripe_service.create_payment_intent(
            db,
            account,
            customer=body.customer.model_dump(),
        )
    except SubscriptionConfigError as exc:
        raise HTTPException(503, str(exc))
    except Exception as exc:  # noqa: BLE001
        log.exception("Checkout failed for account_id=%s", account.id)
        raise HTTPException(500, f"Eroare la initierea platii: {exc}")

    return CheckoutResponse(**result)


@router.get("/invoices/{payment_id}/pdf")
async def download_pdf(
    payment_id: int,
    account: Account = Depends(get_current_account),
    db: AsyncSession = Depends(get_db),
):
    payment = (
        await db.execute(
            select(SubscriptionPayment).where(
                SubscriptionPayment.id == payment_id,
                SubscriptionPayment.account_id == account.id,
            )
        )
    ).scalar_one_or_none()
    if payment is None:
        raise HTTPException(404, "Factura inexistenta.")
    if not payment.pdf_s3_key:
        raise HTTPException(404, "PDF nu este inca generat.")
    try:
        data = invoice_service.get_pdf_bytes(payment)
    except FileNotFoundError as exc:
        raise HTTPException(404, str(exc))
    invoice_label = (
        f"{payment.invoice_series}{payment.invoice_number:04d}"
        if payment.invoice_series and payment.invoice_number
        else f"factura-{payment.id}"
    )
    return Response(
        content=data,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{invoice_label}.pdf"'},
    )


@router.get("/invoices/{payment_id}/anaf-zip")
async def download_anaf_zip(
    payment_id: int,
    account: Account = Depends(get_current_account),
    db: AsyncSession = Depends(get_db),
):
    payment = (
        await db.execute(
            select(SubscriptionPayment).where(
                SubscriptionPayment.id == payment_id,
                SubscriptionPayment.account_id == account.id,
            )
        )
    ).scalar_one_or_none()
    if payment is None:
        raise HTTPException(404, "Factura inexistenta.")
    if not payment.anaf_response_zip_s3_key:
        raise HTTPException(404, "ZIP-ul ANAF nu este inca disponibil.")
    try:
        data = invoice_service.get_zip_bytes(payment)
    except FileNotFoundError as exc:
        raise HTTPException(404, str(exc))
    invoice_label = (
        f"{payment.invoice_series}{payment.invoice_number:04d}"
        if payment.invoice_series and payment.invoice_number
        else f"factura-{payment.id}"
    )
    return Response(
        content=data,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{invoice_label}-anaf.zip"'},
    )
