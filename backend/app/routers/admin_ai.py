"""Setari AI globale + consum pe conturi (super-admin platforma).

Mount: /api/admin/ai-settings, /api/admin/ai-usage
"""
from __future__ import annotations


from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_platform_admin_account
from app.efactura.crypto import encrypt, is_configured as fernet_configured
from app.models.account import Account
from app import radar_client
from app.ai_settings import DEFAULT_MODEL, DEFAULT_PRICE_IN_USD_MTOK, DEFAULT_PRICE_OUT_USD_MTOK
from app.schemas.admin_ai import AccountUsageOut, AiSettingsOut, AiSettingsUpdate
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
    """Consum agregat pe cont in ultimele `months` luni, calculat de serviciul Radar AI."""
    return await usage_from_service(months, db)


async def usage_from_service(months: int, db: AsyncSession) -> list[AccountUsageOut]:
    """Consum pe cont din serviciu; forma asteptata de la `/v1/internal/usage`:
    `[{account_id, tokens_in, tokens_out, cost_usd, runs}]` (agregat pe fereastra de `months` luni)."""
    rows = await radar_client.get_json("/v1/internal/usage", params={"months": months})
    names = dict((await db.execute(select(Account.id, Account.name))).all())
    out = [
        AccountUsageOut(
            account_id=row["account_id"],
            account_name=names.get(row["account_id"], str(row["account_id"])),
            tokens_in=int(row.get("tokens_in") or 0),
            tokens_out=int(row.get("tokens_out") or 0),
            cost_usd=float(row.get("cost_usd") or 0),
            runs=int(row.get("runs") or 0),
        )
        for row in (rows or [])
    ]
    out.sort(key=lambda r: r.cost_usd, reverse=True)
    return out
