"""Radar AI — surse urmarite, rulari, rapoarte si consum de tokeni (admin + manager).

Mount: /api/radar/*
"""
from __future__ import annotations

import asyncio
import logging
from datetime import date, datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_settings_account_id
from app.models.account import Account
from app.models.radar import AiUsage, RadarRun, RadarSettings, RadarSnapshot, RadarSource
from app.radar.settings import load_ai_settings
from app.radar.types import CollectorError
from app.schemas.radar import (
    RadarRunOut,
    RadarSettingsOut,
    RadarSettingsUpdate,
    RadarSnapshotOut,
    RadarSourceCreate,
    RadarSourceOut,
    RadarSourceUpdate,
    SuggestContextOut,
    UsageBucket,
    UsageFeatureBucket,
    UsageOut,
)

try:
    from app.radar.collectors import anaf, gplaces, website, youtube
except ImportError:  # colectorii pot lipsi intr-un deploy partial; rezolvarea da 503, restul API-ului merge
    anaf = gplaces = website = youtube = None  # type: ignore[assignment]

log = logging.getLogger("berlinstar.radar")

router = APIRouter()

ACTIVE_STATUSES = ("queued", "running")


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def _get_or_create_settings(db: AsyncSession, account_id: int) -> RadarSettings:
    row = (
        await db.execute(select(RadarSettings).where(RadarSettings.account_id == account_id))
    ).scalar_one_or_none()
    if row is None:
        row = RadarSettings(account_id=account_id, focus_prompt="", business_context="", schedule="off")
        db.add(row)
        await db.commit()
        await db.refresh(row)
    return row


async def _settings_out(db: AsyncSession, row: RadarSettings) -> RadarSettingsOut:
    ai = await load_ai_settings(db)
    return RadarSettingsOut(
        focus_prompt=row.focus_prompt or "",
        business_context=row.business_context or "",
        schedule=row.schedule or "off",
        ai_configured=ai.configured,
        places_configured=ai.places_configured,
        model=ai.model,
    )


def _run_out(run: RadarRun, with_report: bool = False) -> RadarRunOut:
    return RadarRunOut(
        id=run.id,
        status=run.status,
        trigger=run.trigger,
        started_at=run.started_at,
        finished_at=run.finished_at,
        error=run.error,
        progress=run.progress,
        tokens_in=run.tokens_in or 0,
        tokens_out=run.tokens_out or 0,
        cost_usd=float(run.cost_usd or 0),
        title=run.title,
        period_from=run.period_from,
        period_to=run.period_to,
        report=run.report if with_report else None,
    )


# ---------- Settings ----------


@router.get("/settings", response_model=RadarSettingsOut)
async def get_radar_settings(
    account_id: int = Depends(get_settings_account_id),
    db: AsyncSession = Depends(get_db),
):
    row = await _get_or_create_settings(db, account_id)
    return await _settings_out(db, row)


@router.put("/settings", response_model=RadarSettingsOut)
async def update_radar_settings(
    body: RadarSettingsUpdate,
    account_id: int = Depends(get_settings_account_id),
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
    account_id: int = Depends(get_settings_account_id),
    db: AsyncSession = Depends(get_db),
):
    """Genereaza cu AI descrierea afacerii, din companiile si produsele contului."""
    ai = await load_ai_settings(db)
    if not ai.configured:
        raise HTTPException(400, "Cheia Anthropic nu este configurata. Contacteaza administratorul platformei.")
    try:
        from app.radar.engine import build_business_context
    except ImportError:
        raise HTTPException(503, "Motorul Radar nu este disponibil pe acest server.")
    text = await build_business_context(db, account_id)
    row = await _get_or_create_settings(db, account_id)
    row.business_context = text
    row.updated_at = _now()
    await db.commit()
    return SuggestContextOut(business_context=text)


# ---------- Sources ----------


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
    account_id: int = Depends(get_settings_account_id),
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


async def _resolve(db: AsyncSession, kind: str, value: str) -> tuple[dict, str]:
    """Interogheaza colectorul si intoarce (meta, eticheta implicita)."""
    module = {"youtube": youtube, "company": anaf, "website": website, "gbusiness": gplaces}[kind]
    if module is None:
        raise HTTPException(503, "Colectorii Radar nu sunt disponibili pe acest server.")
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
        ai = await load_ai_settings(db)
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
    account_id: int = Depends(get_settings_account_id),
    db: AsyncSession = Depends(get_db),
):
    value = body.value.strip()
    meta, default_label = await _resolve(db, body.kind, value)
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
    account_id: int = Depends(get_settings_account_id),
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
    account_id: int = Depends(get_settings_account_id),
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
    account_id: int = Depends(get_settings_account_id),
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


# ---------- Runs ----------


@router.post("/runs", response_model=RadarRunOut, status_code=201)
async def create_run(
    account_id: int = Depends(get_settings_account_id),
    db: AsyncSession = Depends(get_db),
):
    ai = await load_ai_settings(db)
    if not ai.configured:
        raise HTTPException(400, "Cheia Anthropic nu este configurata. Contacteaza administratorul platformei.")
    active = (
        await db.execute(
            select(RadarRun.id).where(
                RadarRun.account_id == account_id, RadarRun.status.in_(ACTIVE_STATUSES)
            ).limit(1)
        )
    ).scalar_one_or_none()
    if active is not None:
        raise HTTPException(409, "Exista deja o analiza in curs. Asteapta sa se termine.")
    has_source = (
        await db.execute(
            select(RadarSource.id).where(
                RadarSource.account_id == account_id, RadarSource.enabled == True  # noqa: E712
            ).limit(1)
        )
    ).scalar_one_or_none()
    if has_source is None:
        raise HTTPException(400, "Nu ai nicio sursa activa. Adauga cel putin o sursa in tabul Surse.")

    run = RadarRun(
        account_id=account_id,
        status="queued",
        trigger="manual",
        started_at=_now(),
        progress={"step": "in asteptare", "done": 0, "total": 0, "log": []},
    )
    db.add(run)
    await db.commit()
    await db.refresh(run)

    try:
        from app.radar.engine import run_radar
    except ImportError:
        run.status = "error"
        run.error = "Motorul Radar nu este disponibil pe acest server."
        run.finished_at = _now()
        await db.commit()
        await db.refresh(run)
        return _run_out(run)
    asyncio.create_task(run_radar(run.id))
    return _run_out(run)


@router.get("/runs", response_model=list[RadarRunOut])
async def list_runs(
    limit: int = Query(20, ge=1, le=100),
    account_id: int = Depends(get_settings_account_id),
    db: AsyncSession = Depends(get_db),
):
    rows = (
        await db.execute(
            select(RadarRun)
            .where(RadarRun.account_id == account_id)
            .order_by(RadarRun.started_at.desc(), RadarRun.id.desc())
            .limit(limit)
        )
    ).scalars().all()
    return [_run_out(r) for r in rows]


async def _get_run(db: AsyncSession, account_id: int, run_id: int) -> RadarRun:
    run = (
        await db.execute(
            select(RadarRun).where(RadarRun.id == run_id, RadarRun.account_id == account_id)
        )
    ).scalar_one_or_none()
    if run is None:
        raise HTTPException(404, "Raportul nu a fost gasit.")
    return run


@router.get("/runs/{run_id}", response_model=RadarRunOut)
async def get_run(
    run_id: int,
    account_id: int = Depends(get_settings_account_id),
    db: AsyncSession = Depends(get_db),
):
    run = await _get_run(db, account_id, run_id)
    return _run_out(run, with_report=True)


@router.get("/runs/{run_id}/pdf")
async def get_run_pdf(
    run_id: int,
    account_id: int = Depends(get_settings_account_id),
    db: AsyncSession = Depends(get_db),
):
    run = await _get_run(db, account_id, run_id)
    if not run.report:
        raise HTTPException(400, "Raportul nu este gata inca.")
    try:
        from app.radar.pdf import build_report_pdf
    except ImportError:
        raise HTTPException(503, "Generarea PDF nu este disponibila pe acest server.")
    account = await db.get(Account, account_id)
    pdf = await asyncio.to_thread(build_report_pdf, run, account.name if account else "")
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=radar-{run_id}.pdf"},
    )


@router.delete("/runs/{run_id}", status_code=204)
async def delete_run(
    run_id: int,
    account_id: int = Depends(get_settings_account_id),
    db: AsyncSession = Depends(get_db),
):
    run = await _get_run(db, account_id, run_id)
    if run.status in ACTIVE_STATUSES:
        raise HTTPException(409, "Analiza este in curs; nu poate fi stearsa.")
    await db.delete(run)
    await db.commit()
    return Response(status_code=204)


# ---------- Usage ----------


def _month_key(dt: datetime) -> str:
    return f"{dt.year:04d}-{dt.month:02d}"


def window_start(months: int, today: date | None = None) -> date:
    """Prima zi a lunii de la care se numara consumul (fereastra inclusiva)."""
    today = today or date.today()
    total = today.year * 12 + (today.month - 1) - (months - 1)
    return date(total // 12, total % 12 + 1, 1)


def aggregate_usage(rows: list[AiUsage], months: int, today: date | None = None) -> UsageOut:
    """Agregare in Python: `strftime` pe SQL ar fi doar-SQLite, `date_trunc` doar-Postgres."""
    by_month: dict[str, list[int | Decimal]] = {}
    by_feature: dict[str, list[int | Decimal]] = {}
    total_in = total_out = 0
    total_cost = Decimal(0)
    for row in rows:
        cost = Decimal(str(row.cost_usd or 0))
        tin, tout = row.tokens_in or 0, row.tokens_out or 0
        total_in += tin
        total_out += tout
        total_cost += cost
        for bucket, key in ((by_month, _month_key(row.created_at)), (by_feature, row.feature)):
            acc = bucket.setdefault(key, [0, 0, Decimal(0)])
            acc[0] += tin
            acc[1] += tout
            acc[2] += cost

    start = window_start(months, today)
    labels: list[str] = []
    year, month = start.year, start.month
    for _ in range(months):
        labels.append(f"{year:04d}-{month:02d}")
        year, month = (year + 1, 1) if month == 12 else (year, month + 1)

    return UsageOut(
        total_in=total_in,
        total_out=total_out,
        total_cost_usd=float(total_cost),
        by_month=[
            UsageBucket(
                month=m,
                tokens_in=by_month.get(m, [0, 0, Decimal(0)])[0],
                tokens_out=by_month.get(m, [0, 0, Decimal(0)])[1],
                cost_usd=float(by_month.get(m, [0, 0, Decimal(0)])[2]),
            )
            for m in labels
        ],
        by_feature=[
            UsageFeatureBucket(feature=f, tokens_in=v[0], tokens_out=v[1], cost_usd=float(v[2]))
            for f, v in sorted(by_feature.items())
        ],
    )


@router.get("/usage", response_model=UsageOut)
async def get_usage(
    months: int = Query(6, ge=1, le=36),
    account_id: int = Depends(get_settings_account_id),
    db: AsyncSession = Depends(get_db),
):
    start = datetime.combine(window_start(months), datetime.min.time(), tzinfo=timezone.utc)
    rows = (
        await db.execute(
            select(AiUsage).where(AiUsage.account_id == account_id, AiUsage.created_at >= start)
        )
    ).scalars().all()
    return aggregate_usage(list(rows), months)
