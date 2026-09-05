"""Radar AI — descoperire concurenti pentru o firma a contului (admin + manager).

Mount: /api/radar/discovery/*
"""
from __future__ import annotations

import asyncio
import logging
import re
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_settings_account_id
from app.models.company import Company
from app.models.radar import RadarDiscovery, RadarSource
from app.radar.settings import load_ai_settings
from app.radar.types import CollectorError
from app.routers.radar import _get_or_create_settings, _settings_out
from app.schemas.radar import (
    DiscoveryCreate,
    DiscoveryOut,
    ImportIn,
    ImportOut,
    PrepareIn,
    PrepareOut,
    RadarSettingsOut,
)

log = logging.getLogger("berlinstar.radar.discovery")

router = APIRouter()

ACTIVE_STATUSES = ("queued", "running")
_CHANNEL_ID_RE = re.compile(r"channel/(UC[\w-]{22})")


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def _get_company(db: AsyncSession, account_id: int, company_id: int) -> Company:
    company = (await db.execute(
        select(Company).where(
            Company.id == company_id,
            Company.account_id == account_id,
            Company.is_deleted == False,  # noqa: E712
        )
    )).scalar_one_or_none()
    if company is None:
        raise HTTPException(404, "Firma nu a fost gasita.")
    return company


async def _get_discovery(db: AsyncSession, account_id: int, discovery_id: int) -> RadarDiscovery:
    discovery = (await db.execute(
        select(RadarDiscovery).where(
            RadarDiscovery.id == discovery_id, RadarDiscovery.account_id == account_id
        )
    )).scalar_one_or_none()
    if discovery is None:
        raise HTTPException(404, "Descoperirea nu a fost gasita.")
    return discovery


def _out(discovery: RadarDiscovery, company_name: str, with_result: bool = False) -> DiscoveryOut:
    return DiscoveryOut(
        id=discovery.id,
        company_id=discovery.company_id,
        company_name=company_name,
        status=discovery.status,
        created_at=discovery.created_at,
        finished_at=discovery.finished_at,
        error=discovery.error,
        progress=discovery.progress,
        answers=discovery.answers,
        profile=discovery.profile,
        tokens_in=discovery.tokens_in or 0,
        tokens_out=discovery.tokens_out or 0,
        cost_usd=float(discovery.cost_usd or 0),
        result=discovery.result if with_result else None,
    )


async def _company_names(db: AsyncSession, account_id: int) -> dict[int, str]:
    rows = (await db.execute(
        select(Company.id, Company.name).where(Company.account_id == account_id)
    )).all()
    return {cid: name for cid, name in rows}


@router.post("/prepare", response_model=PrepareOut)
async def prepare_discovery(
    body: PrepareIn,
    account_id: int = Depends(get_settings_account_id),
    db: AsyncSession = Depends(get_db),
):
    """Intrebarile-prerechizite, cu sugestii precompletate (AI daca e cheie)."""
    company = await _get_company(db, account_id, body.company_id)
    try:
        from app.radar.discovery import prepare
    except ImportError:
        raise HTTPException(503, "Descoperirea de concurenti nu este disponibila pe acest server.")
    data = await prepare(db, account_id, company)
    return PrepareOut(**data)


@router.post("", response_model=DiscoveryOut, status_code=201)
async def create_discovery(
    body: DiscoveryCreate,
    account_id: int = Depends(get_settings_account_id),
    db: AsyncSession = Depends(get_db),
):
    """Porneste o descoperire in fundal pentru firma aleasa."""
    company = await _get_company(db, account_id, body.company_id)
    ai = await load_ai_settings(db)
    if not ai.configured:
        raise HTTPException(400, "Cheia Anthropic nu este configurata. Contacteaza administratorul platformei.")
    if not ai.places_configured:
        raise HTTPException(400, "Cheia Google Places nu este configurata. Contacteaza administratorul platformei.")
    active = (await db.execute(
        select(RadarDiscovery.id).where(
            RadarDiscovery.account_id == account_id,
            RadarDiscovery.status.in_(ACTIVE_STATUSES),
        ).limit(1)
    )).scalar_one_or_none()
    if active is not None:
        raise HTTPException(409, "Exista deja o descoperire in curs. Asteapta sa se termine.")

    try:
        from app.radar.discovery import build_profile_draft, merge_answers, run_discovery
    except ImportError:
        raise HTTPException(503, "Descoperirea de concurenti nu este disponibila pe acest server.")

    profile = merge_answers(await build_profile_draft(db, company), body.answers)
    discovery = RadarDiscovery(
        account_id=account_id,
        company_id=company.id,
        status="queued",
        created_at=_now(),
        progress={"step": "in asteptare", "done": 0, "total": 0, "log": []},
        answers=dict(body.answers or {}),
        profile=profile,
    )
    db.add(discovery)
    await db.commit()
    await db.refresh(discovery)
    asyncio.create_task(run_discovery(discovery.id))
    return _out(discovery, company.name)


@router.get("", response_model=list[DiscoveryOut])
async def list_discoveries(
    limit: int = Query(20, ge=1, le=100),
    account_id: int = Depends(get_settings_account_id),
    db: AsyncSession = Depends(get_db),
):
    rows = (await db.execute(
        select(RadarDiscovery)
        .where(RadarDiscovery.account_id == account_id)
        .order_by(RadarDiscovery.created_at.desc(), RadarDiscovery.id.desc())
        .limit(limit)
    )).scalars().all()
    names = await _company_names(db, account_id)
    return [_out(row, names.get(row.company_id, "")) for row in rows]


@router.get("/{discovery_id}", response_model=DiscoveryOut)
async def get_discovery(
    discovery_id: int,
    account_id: int = Depends(get_settings_account_id),
    db: AsyncSession = Depends(get_db),
):
    discovery = await _get_discovery(db, account_id, discovery_id)
    company = await db.get(Company, discovery.company_id)
    return _out(discovery, company.name if company else "", with_result=True)


def _source_payload(kind: str, competitor: dict) -> tuple[str, dict] | None:
    """(value, meta) pentru o sursa Radar creata dintr-un concurent descoperit."""
    name = (competitor.get("name") or "")[:200]
    if kind == "gbusiness":
        place_id = (competitor.get("place_id") or "").strip()
        if not place_id:
            return None
        return f"place:{place_id}", {
            "place_id": place_id,
            "name": name,
            "address": competitor.get("address") or "",
            "rating": competitor.get("rating"),
        }
    if kind == "website":
        url = (competitor.get("website") or "").strip()
        if not url:
            return None
        return url, {"url": url, "title": competitor.get("site_title") or name}
    if kind == "youtube":
        url = (competitor.get("youtube_channel") or "").strip()
        if not url:
            return None
        meta = {"url": url}
        match = _CHANNEL_ID_RE.search(url)
        if match:
            meta["channel_id"] = match.group(1)
        return url, meta
    cui = competitor.get("cui")
    if not cui:
        return None
    return str(cui), {"cui": int(cui), "name": name}


@router.post("/{discovery_id}/import", response_model=ImportOut)
async def import_discovery(
    discovery_id: int,
    body: ImportIn,
    account_id: int = Depends(get_settings_account_id),
    db: AsyncSession = Depends(get_db),
):
    """Creeaza surse Radar din concurentii selectati; sare peste cele deja existente."""
    discovery = await _get_discovery(db, account_id, discovery_id)
    result = discovery.result or {}
    competitors = {
        c.get("index"): c for c in (result.get("competitors") or []) if isinstance(c, dict)
    }
    if not competitors:
        raise HTTPException(400, "Descoperirea nu are inca rezultate.")

    existing = {
        (kind, value)
        for kind, value in (await db.execute(
            select(RadarSource.kind, RadarSource.value).where(
                RadarSource.account_id == account_id
            )
        )).all()
    }
    created = skipped = 0
    for item in body.items:
        competitor = competitors.get(item.index)
        if competitor is None:
            skipped += 1
            continue
        for kind in item.kinds:
            payload = _source_payload(kind, competitor)
            if payload is None:
                skipped += 1
                continue
            value, meta = payload
            if (kind, value[:500]) in existing:
                skipped += 1
                continue
            existing.add((kind, value[:500]))
            db.add(RadarSource(
                account_id=account_id,
                kind=kind,
                label=(competitor.get("name") or value)[:200],
                value=value[:500],
                meta=meta,
                enabled=True,
                created_at=_now(),
            ))
            created += 1
    await db.commit()
    return ImportOut(created=created, skipped=skipped)


@router.post("/{discovery_id}/use-focus", response_model=RadarSettingsOut)
async def use_suggested_focus(
    discovery_id: int,
    account_id: int = Depends(get_settings_account_id),
    db: AsyncSession = Depends(get_db),
):
    """Pune focusul sugerat de AI in setarile Radar (adaugat la final daca exista deja)."""
    discovery = await _get_discovery(db, account_id, discovery_id)
    suggested = ((discovery.result or {}).get("suggested_focus") or "").strip()
    if not suggested:
        raise HTTPException(400, "Descoperirea nu are un focus sugerat.")
    row = await _get_or_create_settings(db, account_id)
    current = (row.focus_prompt or "").strip()
    row.focus_prompt = suggested if not current else f"{current}\n\n{suggested}"
    row.updated_at = _now()
    await db.commit()
    await db.refresh(row)
    return await _settings_out(db, row)


@router.delete("/{discovery_id}", status_code=204)
async def delete_discovery(
    discovery_id: int,
    account_id: int = Depends(get_settings_account_id),
    db: AsyncSession = Depends(get_db),
):
    discovery = await _get_discovery(db, account_id, discovery_id)
    if discovery.status in ACTIVE_STATUSES:
        raise HTTPException(409, "Descoperirea este in curs; nu poate fi stearsa.")
    await db.delete(discovery)
    await db.commit()
    return Response(status_code=204)
