"""Sursele urmarite de Radar si snapshot-urile lor.

Mount: /v1/sources
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app import monolith
from app.auth import require_account
from app.database import get_db
from app.models.radar import RadarSnapshot, RadarSource
from app.radar.collectors import anaf, gplaces, website, youtube
from app.radar.types import CollectorError
from app.schemas.radar import (
    RadarSnapshotOut,
    RadarSourceCreate,
    RadarSourceOut,
    RadarSourceUpdate,
)

log = logging.getLogger("radar.sources")

router = APIRouter()


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def _snapshot_counts(db: AsyncSession, account_id: int) -> dict[int, int]:
    rows = (
        await db.execute(
            select(RadarSnapshot.source_id, func.count())
            .where(RadarSnapshot.account_id == account_id)
            .group_by(RadarSnapshot.source_id)
        )
    ).all()
    return {sid: cnt for sid, cnt in rows}


def _source_out(src: RadarSource, count: int) -> RadarSourceOut:
    return RadarSourceOut(
        id=src.id,
        kind=src.kind,
        label=src.label or "",
        value=src.value,
        meta=src.meta,
        enabled=bool(src.enabled),
        created_at=src.created_at,
        last_collected_at=src.last_collected_at,
        last_error=src.last_error,
        snapshots_count=count,
    )


@router.get("/sources", response_model=list[RadarSourceOut])
async def list_sources(
    account_id: int = Depends(require_account),
    db: AsyncSession = Depends(get_db),
):
    rows = (
        await db.execute(
            select(RadarSource).where(RadarSource.account_id == account_id).order_by(RadarSource.id)
        )
    ).scalars().all()
    counts = await _snapshot_counts(db, account_id)
    return [_source_out(s, counts.get(s.id, 0)) for s in rows]


def _cui_digits(value: str) -> int:
    digits = "".join(ch for ch in value if ch.isdigit())
    if not digits:
        raise HTTPException(400, "CUI invalid. Introdu doar cifrele CUI-ului (ex: 12345678).")
    return int(digits)


async def _resolve(kind: str, value: str) -> tuple[dict, str]:
    """Interogheaza colectorul si intoarce (meta, eticheta implicita)."""
    try:
        if kind == "youtube":
            info = await youtube.resolve_channel(value)
            return {"channel_id": info.channel_id, "title": info.title, "url": info.url}, info.title
        if kind == "company":
            cui = _cui_digits(value)
            info = await anaf.fetch_company(cui)
            meta = {
                "cui": info.cui,
                "name": info.name,
                "vat_payer": info.vat_payer,
                "address": info.address,
                "status": info.status,
                "caen": info.caen,
            }
            return meta, info.name
        if kind == "website":
            info = await website.fetch_page(value)
            return {"title": info.title, "url": info.url}, info.title or info.url
        ai = await monolith.ai_config()
        if not ai.places_configured:
            raise HTTPException(400, "Cheia Google Places nu este configurata. Contacteaza administratorul platformei.")
        info = await gplaces.resolve_place(value, ai.places_key)
        meta = {
            "place_id": info.place_id,
            "name": info.name,
            "address": info.address,
            "rating": info.rating,
            "reviews_count": info.reviews_count,
        }
        return meta, info.name
    except CollectorError as exc:
        raise HTTPException(400, str(exc))


@router.post("/sources", response_model=RadarSourceOut, status_code=201)
async def create_source(
    body: RadarSourceCreate,
    account_id: int = Depends(require_account),
    db: AsyncSession = Depends(get_db),
):
    value = body.value.strip()
    meta, default_label = await _resolve(body.kind, value)
    src = RadarSource(
        account_id=account_id,
        kind=body.kind,
        label=(body.label or default_label or value)[:200],
        value=value,
        meta=meta,
        enabled=True,
        created_at=_now(),
    )
    db.add(src)
    await db.commit()
    await db.refresh(src)
    return _source_out(src, 0)


async def _get_source(db: AsyncSession, account_id: int, source_id: int) -> RadarSource:
    src = (
        await db.execute(
            select(RadarSource).where(
                RadarSource.id == source_id, RadarSource.account_id == account_id
            )
        )
    ).scalar_one_or_none()
    if src is None:
        raise HTTPException(404, "Sursa nu a fost gasita.")
    return src


@router.put("/sources/{source_id}", response_model=RadarSourceOut)
async def update_source(
    source_id: int,
    body: RadarSourceUpdate,
    account_id: int = Depends(require_account),
    db: AsyncSession = Depends(get_db),
):
    src = await _get_source(db, account_id, source_id)
    patch = body.model_dump(exclude_unset=True)
    if patch.get("label") is not None:
        src.label = patch["label"][:200]
    if patch.get("enabled") is not None:
        src.enabled = patch["enabled"]
    await db.commit()
    await db.refresh(src)
    counts = await _snapshot_counts(db, account_id)
    return _source_out(src, counts.get(src.id, 0))


@router.delete("/sources/{source_id}", status_code=204)
async def delete_source(
    source_id: int,
    account_id: int = Depends(require_account),
    db: AsyncSession = Depends(get_db),
):
    src = await _get_source(db, account_id, source_id)
    await db.execute(delete(RadarSnapshot).where(RadarSnapshot.source_id == src.id))
    await db.delete(src)
    await db.commit()
    return Response(status_code=204)


@router.get("/sources/{source_id}/snapshots", response_model=list[RadarSnapshotOut])
async def list_snapshots(
    source_id: int,
    limit: int = Query(20, ge=1, le=200),
    account_id: int = Depends(require_account),
    db: AsyncSession = Depends(get_db),
):
    await _get_source(db, account_id, source_id)
    rows = (
        await db.execute(
            select(RadarSnapshot)
            .where(RadarSnapshot.source_id == source_id, RadarSnapshot.account_id == account_id)
            .order_by(RadarSnapshot.collected_at.desc(), RadarSnapshot.id.desc())
            .limit(limit)
        )
    ).scalars().all()
    return [
        RadarSnapshotOut(
            id=s.id,
            external_id=s.external_id,
            collected_at=s.collected_at,
            payload=s.payload,
            digest=s.digest,
        )
        for s in rows
    ]
