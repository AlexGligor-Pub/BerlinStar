"""Admin endpoints pentru abonament BerlinStar.

Mount: /api/admin/subscription/*
Auth: super admin (username=="admin") via _require_super_admin.
"""
from __future__ import annotations

import logging
from datetime import date, datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.efactura import runtime_config
from app.efactura.crypto import encrypt, is_configured as fernet_configured
from app.efactura.exceptions import AnafAuthError, AnafConfigError
from app.models.account import Account
from app.models.subscription import (
    AccountSubscription,
    PlatformAnafToken,
    SubscriptionPayment,
)
from app.routers.admin import _require_super_admin
from app.subscriptions import platform_anaf_oauth
from app.subscriptions.settings import get_or_create_global_settings

log = logging.getLogger("berlinstar.subscription.admin")

router = APIRouter()


# ---------- Settings ----------


class SubscriptionSettingsOut(BaseModel):
    subscription_price_eur: float
    subscription_vat_percent: float
    subscription_currency_charge: str
    subscription_invoice_series: str
    subscription_next_invoice_number: int

    issuer_name: str | None
    issuer_cui: str | None
    issuer_reg_com: str | None
    issuer_legal_form: str | None
    issuer_is_vat_payer: bool
    issuer_address: str | None
    issuer_street: str | None
    issuer_city: str | None
    issuer_county_code: str | None
    issuer_postal_code: str | None
    issuer_country_code: str
    issuer_iban: str | None
    issuer_bank_name: str | None
    issuer_email: str | None
    issuer_phone: str | None

    stripe_publishable_key: str | None
    stripe_secret_key_set: bool
    stripe_webhook_secret_set: bool
    stripe_test_mode: bool

    platform_anaf_use_test_env: bool
    platform_anaf_auto_upload: bool
    platform_anaf_connected: bool
    platform_anaf_expires_at: str | None


class SubscriptionSettingsUpdate(BaseModel):
    subscription_price_eur: float | None = Field(None, gt=0)
    subscription_vat_percent: float | None = Field(None, ge=0, le=100)
    subscription_currency_charge: str | None = Field(None, max_length=3)
    subscription_invoice_series: str | None = Field(None, max_length=20)
    subscription_next_invoice_number: int | None = Field(None, ge=1)

    issuer_name: str | None = Field(None, max_length=255)
    issuer_cui: str | None = Field(None, max_length=20)
    issuer_reg_com: str | None = Field(None, max_length=50)
    issuer_legal_form: str | None = Field(None, max_length=20)
    issuer_is_vat_payer: bool | None = None
    issuer_address: str | None = None
    issuer_street: str | None = Field(None, max_length=255)
    issuer_city: str | None = Field(None, max_length=100)
    issuer_county_code: str | None = Field(None, max_length=10)
    issuer_postal_code: str | None = Field(None, max_length=20)
    issuer_country_code: str | None = Field(None, max_length=2)
    issuer_iban: str | None = Field(None, max_length=50)
    issuer_bank_name: str | None = Field(None, max_length=100)
    issuer_email: str | None = Field(None, max_length=255)
    issuer_phone: str | None = Field(None, max_length=50)

    stripe_publishable_key: str | None = Field(None, max_length=255)
    # secret_key si webhook_secret se trimit in clar de la admin si sunt
    # criptate cu Fernet inainte de salvare. None inseamna "nu modifica".
    stripe_secret_key: str | None = None
    stripe_webhook_secret: str | None = None
    stripe_test_mode: bool | None = None

    platform_anaf_use_test_env: bool | None = None
    platform_anaf_auto_upload: bool | None = None


def _settings_to_out(gs, token: PlatformAnafToken | None) -> SubscriptionSettingsOut:
    expires = None
    if token is not None:
        e = token.expires_at
        if e.tzinfo is None:
            e = e.replace(tzinfo=timezone.utc)
        expires = e.isoformat()
    return SubscriptionSettingsOut(
        subscription_price_eur=float(gs.subscription_price_eur or 0),
        subscription_vat_percent=float(gs.subscription_vat_percent or 0),
        subscription_currency_charge=gs.subscription_currency_charge or "RON",
        subscription_invoice_series=gs.subscription_invoice_series or "BS-SUB",
        subscription_next_invoice_number=int(gs.subscription_next_invoice_number or 1),
        issuer_name=gs.issuer_name,
        issuer_cui=gs.issuer_cui,
        issuer_reg_com=gs.issuer_reg_com,
        issuer_legal_form=gs.issuer_legal_form,
        issuer_is_vat_payer=bool(gs.issuer_is_vat_payer),
        issuer_address=gs.issuer_address,
        issuer_street=gs.issuer_street,
        issuer_city=gs.issuer_city,
        issuer_county_code=gs.issuer_county_code,
        issuer_postal_code=gs.issuer_postal_code,
        issuer_country_code=gs.issuer_country_code or "RO",
        issuer_iban=gs.issuer_iban,
        issuer_bank_name=gs.issuer_bank_name,
        issuer_email=gs.issuer_email,
        issuer_phone=gs.issuer_phone,
        stripe_publishable_key=gs.stripe_publishable_key,
        stripe_secret_key_set=bool(gs.stripe_secret_key_enc),
        stripe_webhook_secret_set=bool(gs.stripe_webhook_secret_enc),
        stripe_test_mode=bool(gs.stripe_test_mode),
        platform_anaf_use_test_env=bool(gs.platform_anaf_use_test_env),
        platform_anaf_auto_upload=bool(gs.platform_anaf_auto_upload),
        platform_anaf_connected=token is not None,
        platform_anaf_expires_at=expires,
    )


@router.get("/settings", response_model=SubscriptionSettingsOut)
async def get_settings(
    _admin: Account = Depends(_require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    gs = await get_or_create_global_settings(db)
    token = (await db.execute(select(PlatformAnafToken).limit(1))).scalar_one_or_none()
    return _settings_to_out(gs, token)


@router.put("/settings", response_model=SubscriptionSettingsOut)
async def update_settings(
    body: SubscriptionSettingsUpdate,
    _admin: Account = Depends(_require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    gs = await get_or_create_global_settings(db)
    data = body.model_dump(exclude_unset=True)

    # Stripe secret_key / webhook_secret — encrypt daca primim valori noi
    if "stripe_secret_key" in data:
        new = (data.pop("stripe_secret_key") or "").strip()
        if new:
            if not fernet_configured():
                raise HTTPException(
                    503,
                    "Cheia Fernet (eFactura) nu este configurata. AdminV2 -> eFactura -> Configurare globala.",
                )
            gs.stripe_secret_key_enc = encrypt(new)
        else:
            gs.stripe_secret_key_enc = None  # explicit clear cu sir gol e tratat ca pastreaza

    if "stripe_webhook_secret" in data:
        new = (data.pop("stripe_webhook_secret") or "").strip()
        if new:
            if not fernet_configured():
                raise HTTPException(
                    503,
                    "Cheia Fernet (eFactura) nu este configurata. AdminV2 -> eFactura -> Configurare globala.",
                )
            gs.stripe_webhook_secret_enc = encrypt(new)
        else:
            gs.stripe_webhook_secret_enc = None

    for field_name, value in data.items():
        setattr(gs, field_name, value)
    await db.commit()
    await db.refresh(gs)
    token = (await db.execute(select(PlatformAnafToken).limit(1))).scalar_one_or_none()
    return _settings_to_out(gs, token)


# ---------- Platform ANAF OAuth ----------


class AnafAuthUrlOut(BaseModel):
    auth_url: str


@router.get("/anaf/auth-url", response_model=AnafAuthUrlOut)
async def anaf_auth_url(
    _admin: Account = Depends(_require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    try:
        url = await platform_anaf_oauth.build_authorize_url(db)
    except AnafConfigError as exc:
        raise HTTPException(409, str(exc))
    return AnafAuthUrlOut(auth_url=url)


@router.get("/anaf/callback")
async def anaf_callback(
    code: str = Query(...),
    state: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """Callback OAuth ANAF — redirecteaza inapoi in AdminV2 (tab Abonament)."""
    target = runtime_config.derived_admin_subscription_callback()
    try:
        await platform_anaf_oauth.handle_callback(db, code, state)
        return RedirectResponse(url=target + "&anaf=connected")
    except (AnafAuthError, AnafConfigError) as exc:
        return RedirectResponse(url=f"{target}&anaf_error={exc}")


@router.post("/anaf/disconnect")
async def anaf_disconnect(
    _admin: Account = Depends(_require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    deleted = await platform_anaf_oauth.revoke(db)
    return {"deleted": deleted}


# ---------- Accounts management ----------


class AccountSubscriptionItem(BaseModel):
    account_id: int
    account_name: str
    account_username: str
    email: str | None
    is_locked: bool
    next_payment_date: str | None
    last_payment_date: str | None
    last_payment_status: str | None


class AccountListOut(BaseModel):
    items: list[AccountSubscriptionItem]
    total: int


@router.get("/accounts", response_model=AccountListOut)
async def list_accounts(
    _admin: Account = Depends(_require_super_admin),
    db: AsyncSession = Depends(get_db),
    q: str | None = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    base = select(Account).where(Account.is_deleted == False)  # noqa: E712
    if q:
        like = f"%{q.strip()}%"
        base = base.where(
            (Account.name.ilike(like))
            | (Account.username.ilike(like))
            | (Account.email.ilike(like))
        )
    total = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar() or 0
    rows = (
        await db.execute(base.order_by(Account.name).limit(limit).offset(offset))
    ).scalars().all()

    items: list[AccountSubscriptionItem] = []
    for acc in rows:
        sub = (
            await db.execute(
                select(AccountSubscription).where(AccountSubscription.account_id == acc.id)
            )
        ).scalar_one_or_none()
        last_pay = (
            await db.execute(
                select(SubscriptionPayment)
                .where(SubscriptionPayment.account_id == acc.id)
                .order_by(desc(SubscriptionPayment.created_at))
                .limit(1)
            )
        ).scalar_one_or_none()
        items.append(
            AccountSubscriptionItem(
                account_id=acc.id,
                account_name=acc.name,
                account_username=acc.username,
                email=acc.email,
                is_locked=acc.is_locked,
                next_payment_date=sub.next_payment_date.isoformat() if sub and sub.next_payment_date else None,
                last_payment_date=sub.last_payment_date.isoformat() if sub and sub.last_payment_date else None,
                last_payment_status=last_pay.status if last_pay else None,
            )
        )
    return AccountListOut(items=items, total=total)


class AccountUpdate(BaseModel):
    next_payment_date: date | None = None
    is_locked: bool | None = None


@router.patch("/accounts/{account_id}", response_model=AccountSubscriptionItem)
async def update_account_subscription(
    account_id: int,
    body: AccountUpdate,
    _admin: Account = Depends(_require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    acc = (
        await db.execute(select(Account).where(Account.id == account_id, Account.is_deleted == False))
    ).scalar_one_or_none()
    if acc is None:
        raise HTTPException(404, "Account inexistent.")

    sub = (
        await db.execute(
            select(AccountSubscription).where(AccountSubscription.account_id == account_id)
        )
    ).scalar_one_or_none()
    if sub is None:
        sub = AccountSubscription(
            account_id=account_id,
            next_payment_date=date.today(),
        )
        db.add(sub)
        await db.flush()

    patch = body.model_dump(exclude_unset=True)
    if "next_payment_date" in patch and patch["next_payment_date"] is not None:
        sub.next_payment_date = patch["next_payment_date"]
        sub.updated_at = datetime.now(timezone.utc)
    if "is_locked" in patch and patch["is_locked"] is not None:
        acc.is_locked = patch["is_locked"]
        acc.locked_at = datetime.now(timezone.utc) if patch["is_locked"] else None
        acc.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(sub)
    await db.refresh(acc)

    last_pay = (
        await db.execute(
            select(SubscriptionPayment)
            .where(SubscriptionPayment.account_id == acc.id)
            .order_by(desc(SubscriptionPayment.created_at))
            .limit(1)
        )
    ).scalar_one_or_none()

    return AccountSubscriptionItem(
        account_id=acc.id,
        account_name=acc.name,
        account_username=acc.username,
        email=acc.email,
        is_locked=acc.is_locked,
        next_payment_date=sub.next_payment_date.isoformat() if sub.next_payment_date else None,
        last_payment_date=sub.last_payment_date.isoformat() if sub.last_payment_date else None,
        last_payment_status=last_pay.status if last_pay else None,
    )


class AccountPaymentItem(BaseModel):
    id: int
    status: str
    paid_at: str | None
    amount_eur: float
    amount_ron: float
    invoice_number: str | None
    anaf_status: str | None


@router.get("/accounts/{account_id}/payments", response_model=list[AccountPaymentItem])
async def list_account_payments(
    account_id: int,
    _admin: Account = Depends(_require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    rows = (
        await db.execute(
            select(SubscriptionPayment)
            .where(SubscriptionPayment.account_id == account_id)
            .order_by(desc(SubscriptionPayment.created_at))
        )
    ).scalars().all()
    out: list[AccountPaymentItem] = []
    for r in rows:
        label = (
            f"{r.invoice_series}{r.invoice_number:04d}"
            if r.invoice_series and r.invoice_number
            else None
        )
        out.append(
            AccountPaymentItem(
                id=r.id,
                status=r.status,
                paid_at=r.paid_at.isoformat() if r.paid_at else None,
                amount_eur=float(r.amount_eur),
                amount_ron=float(r.amount_ron),
                invoice_number=label,
                anaf_status=r.anaf_status,
            )
        )
    return out
