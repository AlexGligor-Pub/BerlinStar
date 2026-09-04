"""Setari AI globale + consum pe conturi (super-admin platforma).

Mount: /api/admin/ai-settings, /api/admin/ai-usage
"""
from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_platform_admin_account
from app.efactura.crypto import encrypt, is_configured as fernet_configured
from app.models.account import Account
from app.models.radar import AiUsage, RadarRun
from app.radar.types import DEFAULT_MODEL, DEFAULT_PRICE_IN_USD_MTOK, DEFAULT_PRICE_OUT_USD_MTOK
from app.routers.radar import window_start
from app.schemas.radar import AccountUsageOut, AiSettingsOut, AiSettingsUpdate
from app.subscriptions.settings import get_or_create_global_settings

router = APIRouter()

_KEY_FIELDS = {
    "anthropic_api_key": "anthropic_api_key_enc",
    "google_places_api_key": "google_places_api_key_enc",
}


def _out(gs) -> AiSettingsOut:
    return AiSettingsOut(
        anthropic_api_key_set=bool(gs.anthropic_api_key_enc),
        google_places_api_key_set=bool(gs.google_places_api_key_enc),
        ai_model=gs.ai_model or DEFAULT_MODEL,
        ai_price_in_usd_mtok=float(gs.ai_price_in_usd_mtok) if gs.ai_price_in_usd_mtok is not None else DEFAULT_PRICE_IN_USD_MTOK,
        ai_price_out_usd_mtok=float(gs.ai_price_out_usd_mtok) if gs.ai_price_out_usd_mtok is not None else DEFAULT_PRICE_OUT_USD_MTOK,
    )


@router.get("/ai-settings", response_model=AiSettingsOut)
async def get_ai_settings(
    _admin: Account = Depends(get_platform_admin_account),
    db: AsyncSession = Depends(get_db),
):
    return _out(await get_or_create_global_settings(db))


@router.put("/ai-settings", response_model=AiSettingsOut)
async def update_ai_settings(
    body: AiSettingsUpdate,
    _admin: Account = Depends(get_platform_admin_account),
    db: AsyncSession = Depends(get_db),
):
    gs = await get_or_create_global_settings(db)
    data = body.model_dump(exclude_unset=True)
    for plain_field, enc_field in _KEY_FIELDS.items():
        if plain_field not in data:
            continue
        new = (data.pop(plain_field) or "").strip()
        if not new:
            setattr(gs, enc_field, None)
            continue
        if not fernet_configured():
            raise HTTPException(
                503,
                "Cheia Fernet (eFactura) nu este configurata. AdminV2 -> eFactura -> Configurare globala.",
            )
        setattr(gs, enc_field, encrypt(new))
    for field, value in data.items():
        if value is not None:
            setattr(gs, field, value)
    await db.commit()
    await db.refresh(gs)
    return _out(gs)


@router.get("/ai-usage", response_model=list[AccountUsageOut])
async def get_ai_usage(
    months: int = Query(6, ge=1, le=36),
    _admin: Account = Depends(get_platform_admin_account),
    db: AsyncSession = Depends(get_db),
):
    """Consum agregat pe cont in ultimele `months` luni (agregare in Python, portabila)."""
    start = datetime.combine(window_start(months), datetime.min.time(), tzinfo=timezone.utc)
    rows = (
        await db.execute(select(AiUsage).where(AiUsage.created_at >= start))
    ).scalars().all()
    runs = dict(
        (
            await db.execute(
                select(RadarRun.account_id, func.count())
                .where(RadarRun.started_at >= start)
                .group_by(RadarRun.account_id)
            )
        ).all()
    )
    names = dict(
        (await db.execute(select(Account.id, Account.name))).all()
    )

    agg: dict[int, list] = {}
    for row in rows:
        acc = agg.setdefault(row.account_id, [0, 0, Decimal(0)])
        acc[0] += row.tokens_in or 0
        acc[1] += row.tokens_out or 0
        acc[2] += Decimal(str(row.cost_usd or 0))
    for account_id in runs:
        agg.setdefault(account_id, [0, 0, Decimal(0)])

    out = [
        AccountUsageOut(
            account_id=account_id,
            account_name=names.get(account_id, str(account_id)),
            tokens_in=v[0],
            tokens_out=v[1],
            cost_usd=float(v[2]),
            runs=runs.get(account_id, 0),
        )
        for account_id, v in agg.items()
    ]
    out.sort(key=lambda r: r.cost_usd, reverse=True)
    return out
