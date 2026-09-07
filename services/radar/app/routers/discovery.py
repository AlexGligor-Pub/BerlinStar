"""Descoperirea de concurenti: pregatire (job), pornire (job), rezultate, import surse.

Mount: /v1/discovery
"""
from __future__ import annotations

import logging
import re
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import monolith
from app.auth import require_account
from app.database import get_db
from app.jobs import queue
from app.models.radar import RadarDiscovery, RadarSource
from app.radar.discovery import (
    build_profile_draft,
    context_items,
    find_company,
    merge_answers,
)
from app.routers.settings import _get_or_create_settings, _settings_out
from app.schemas.jobs import PrepareJobOut, PrepareStatusOut
from app.schemas.radar import (
    DiscoveryCreate,
    DiscoveryOut,
    ImportIn,
    ImportOut,
    PrepareIn,
    PrepareOut,
    RadarSettingsOut,
)

log = logging.getLogger("radar.discovery")

router = APIRouter()

ACTIVE_STATUSES = ("queued", "running")
_CHANNEL_ID_RE = re.compile(r"channel/(UC[\w-]{22})")


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def _context_company(account_id: int, company_id: int) -> tuple[dict, dict, list[dict]]:
    context = await monolith.business_context(account_id)
    company = find_company(context, company_id)
    if company is None:
        raise HTTPException(404, "Firma nu a fost gasita.")
    return context, company, context_items(context)


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


def _company_names(context: dict) -> dict[int, str]:
    return {
        int(c["id"]): c.get("name") or ""
        for c in (context.get("companies") or [])
        if isinstance(c, dict) and c.get("id") is not None
    }


@router.post("/discovery/prepare", response_model=PrepareJobOut, status_code=202)
async def prepare_discovery(
    body: PrepareIn,
    account_id: int = Depends(require_account),
    db: AsyncSession = Depends(get_db),
):
    """Pune pregatirea in coada (apel AI); rezultatul se ia din `/prepare/{job_id}`."""
    context, company, _ = await _context_company(account_id, body.company_id)
    key = f"discovery_prepare:{account_id}:{body.company_id}:{uuid.uuid4()}"
    try:
        job, _created = await queue.enqueue(
            db,
            kind="discovery_prepare",
            account_id=account_id,
            idempotency_key=key,
            target_id=body.company_id,
            payload={"context": context, "company_id": body.company_id},
        )
    except queue.ActiveJobExists as exc:
        raise HTTPException(409, str(exc))
    log.info("job_id=%s account_id=%s pregatire pentru firma %s", job.id, account_id, company.get("id"))
    return PrepareJobOut(job_id=job.id, status=job.status)


@router.get("/discovery/prepare/{job_id}", response_model=PrepareStatusOut)
async def prepare_status(
    job_id: int,
    account_id: int = Depends(require_account),
    db: AsyncSession = Depends(get_db),
):
    from app.models.jobs import RadarJob

    job = (await db.execute(
        select(RadarJob).where(
            RadarJob.id == job_id,
            RadarJob.account_id == account_id,
            RadarJob.kind == "discovery_prepare",
        )
    )).scalar_one_or_none()
    if job is None:
        raise HTTPException(404, "Pregatirea nu a fost gasita.")
    result = PrepareOut(**job.result) if job.status == "done" and job.result else None
    return PrepareStatusOut(job_id=job.id, status=job.status, error=job.error, result=result)


@router.post("/discovery", response_model=DiscoveryOut, status_code=201)
async def create_discovery(
    body: DiscoveryCreate,
    account_id: int = Depends(require_account),
    db: AsyncSession = Depends(get_db),
):
    """Creeaza descoperirea in `queued` si pune job-ul in coada."""
    ai = await monolith.ai_config()
    if not ai.configured:
        raise HTTPException(400, "Cheia Anthropic nu este configurata. Contacteaza administratorul platformei.")
    if not ai.places_configured:
        raise HTTPException(400, "Cheia Google Places nu este configurata. Contacteaza administratorul platformei.")

    context, company, items = await _context_company(account_id, body.company_id)
    active = (await db.execute(
        select(RadarDiscovery.id).where(
            RadarDiscovery.account_id == account_id,
            RadarDiscovery.status.in_(ACTIVE_STATUSES),
        ).limit(1)
    )).scalar_one_or_none()
    if active is not None:
        raise HTTPException(409, "Exista deja o descoperire in curs. Asteapta sa se termine.")

    profile = merge_answers(build_profile_draft(company, items), body.answers)
    discovery = RadarDiscovery(
        account_id=account_id,
        company_id=int(company["id"]),
        status="queued",
        created_at=_now(),
        progress={"step": "in asteptare", "done": 0, "total": 0, "log": []},
        answers=dict(body.answers or {}),
        profile=profile,
    )
    db.add(discovery)
    await db.flush()
    key = f"discovery:{account_id}:{discovery.id}"
    try:
        job, created = await queue.enqueue(
            db,
            kind="discovery",
            account_id=account_id,
            idempotency_key=key,
            target_id=discovery.id,
            payload={"context": context},
        )
    except queue.ActiveJobExists as exc:
        raise HTTPException(409, str(exc))
    if not created:
        raise HTTPException(409, "Exista deja o descoperire in curs. Asteapta sa se termine.")
    log.info("job_id=%s account_id=%s descoperire %s pusa in coada", job.id, account_id, discovery.id)
    await db.refresh(discovery)
    return _out(discovery, company.get("name") or "")


@router.get("/discovery", response_model=list[DiscoveryOut])
async def list_discoveries(
    limit: int = Query(20, ge=1, le=100),
    account_id: int = Depends(require_account),
    db: AsyncSession = Depends(get_db),
):
    rows = (await db.execute(
        select(RadarDiscovery)
        .where(RadarDiscovery.account_id == account_id)
        .order_by(RadarDiscovery.created_at.desc(), RadarDiscovery.id.desc())
        .limit(limit)
    )).scalars().all()
    if not rows:
        return []
    try:
        names = _company_names(await monolith.business_context(account_id))
    except monolith.MonolithUnavailable:
        names = {}
    return [_out(row, names.get(row.company_id, "")) for row in rows]


@router.get("/discovery/{discovery_id}", response_model=DiscoveryOut)
async def get_discovery(
    discovery_id: int,
    account_id: int = Depends(require_account),
    db: AsyncSession = Depends(get_db),
):
    discovery = await _get_discovery(db, account_id, discovery_id)
    try:
        names = _company_names(await monolith.business_context(account_id))
    except monolith.MonolithUnavailable:
        names = {}
    return _out(discovery, names.get(discovery.company_id, ""), with_result=True)


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


@router.post("/discovery/{discovery_id}/import", response_model=ImportOut)
async def import_discovery(
    discovery_id: int,
    body: ImportIn,
    account_id: int = Depends(require_account),
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


@router.post("/discovery/{discovery_id}/use-focus", response_model=RadarSettingsOut)
async def use_suggested_focus(
    discovery_id: int,
    account_id: int = Depends(require_account),
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


@router.delete("/discovery/{discovery_id}", status_code=204)
async def delete_discovery(
    discovery_id: int,
    account_id: int = Depends(require_account),
    db: AsyncSession = Depends(get_db),
):
    discovery = await _get_discovery(db, account_id, discovery_id)
    if discovery.status in ACTIVE_STATUSES:
        raise HTTPException(409, "Descoperirea este in curs; nu poate fi stearsa.")
    await db.delete(discovery)
    await db.commit()
    return Response(status_code=204)
