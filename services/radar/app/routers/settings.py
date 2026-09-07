"""Setarile Radar ale contului: focus, context de business, frecventa.

Mount: /v1/settings
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import monolith
from app.auth import require_account
from app.database import get_db
from app.models.radar import RadarSettings
from app.schemas.radar import RadarSettingsOut, RadarSettingsUpdate, SuggestContextOut

log = logging.getLogger("radar.settings")

router = APIRouter()


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def _get_or_create_settings(db: AsyncSession, account_id: int) -> RadarSettings:
    row = (
        await db.execute(select(RadarSettings).where(RadarSettings.account_id == account_id))
    ).scalar_one_or_none()
    if row is None:
        row = RadarSettings(
            account_id=account_id, focus_prompt="", business_context="", schedule="off"
        )
        db.add(row)
        await db.commit()
        await db.refresh(row)
    return row


async def _settings_out(db: AsyncSession, row: RadarSettings) -> RadarSettingsOut:
    ai = await monolith.ai_config()
    return RadarSettingsOut(
        focus_prompt=row.focus_prompt or "",
        business_context=row.business_context or "",
        schedule=row.schedule or "off",
        ai_configured=ai.configured,
        places_configured=ai.places_configured,
        model=ai.model,
    )


@router.get("/settings", response_model=RadarSettingsOut)
async def get_radar_settings(
    account_id: int = Depends(require_account),
    db: AsyncSession = Depends(get_db),
):
    row = await _get_or_create_settings(db, account_id)
    return await _settings_out(db, row)


@router.put("/settings", response_model=RadarSettingsOut)
async def update_radar_settings(
    body: RadarSettingsUpdate,
    account_id: int = Depends(require_account),
    db: AsyncSession = Depends(get_db),
):
    row = await _get_or_create_settings(db, account_id)
    for field, value in body.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(row, field, value)
    row.updated_at = _now()
    await db.commit()
    await db.refresh(row)
    return await _settings_out(db, row)


@router.post("/settings/suggest-context", response_model=SuggestContextOut)
async def suggest_business_context(
    account_id: int = Depends(require_account),
    db: AsyncSession = Depends(get_db),
):
    """Genereaza cu AI descrierea afacerii, din companiile si produsele contului."""
    from app.radar.engine import build_business_context

    ai = await monolith.ai_config()
    if not ai.configured:
        raise HTTPException(400, "Cheia Anthropic nu este configurata. Contacteaza administratorul platformei.")
    context = await monolith.business_context(account_id)
    text = await build_business_context(db, account_id, context)
    row = await _get_or_create_settings(db, account_id)
    row.business_context = text
    row.updated_at = _now()
    await db.commit()
    return SuggestContextOut(business_context=text)
