"""Rularile Radar: pornire (job in coada), listare, raport, PDF, stergere.

Mount: /v1/runs
"""
from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import monolith
from app.auth import require_account
from app.database import get_db
from app.jobs import queue
from app.models.radar import RadarRun, RadarSource
from app.schemas.radar import RadarRunOut

log = logging.getLogger("radar.runs")

router = APIRouter()

ACTIVE_STATUSES = ("queued", "running")


def _now() -> datetime:
    return datetime.now(timezone.utc)


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


@router.post("/runs", response_model=RadarRunOut, status_code=201)
async def create_run(
    response: Response,
    account_id: int = Depends(require_account),
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    db: AsyncSession = Depends(get_db),
):
    """Creeaza rularea in `queued` si pune job-ul in coada; worker-ul o executa."""
    ai = await monolith.ai_config()
    if not ai.configured:
        raise HTTPException(400, "Cheia Anthropic nu este configurata. Contacteaza administratorul platformei.")

    key = (idempotency_key or "").strip() or f"radar:{account_id}:manual:{uuid.uuid4()}"
    existing_job = await queue.by_key(db, key)
    if existing_job is not None and existing_job.target_id:
        existing = await db.get(RadarRun, existing_job.target_id)
        if existing is not None:
            response.status_code = 200
            return _run_out(existing)

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

    context = await monolith.business_context(account_id)
    run = RadarRun(
        account_id=account_id,
        status="queued",
        trigger="manual",
        started_at=_now(),
        progress={"step": "in asteptare", "done": 0, "total": 0, "log": []},
    )
    db.add(run)
    await db.flush()
    try:
        job, created = await queue.enqueue(
            db,
            kind="radar_run",
            account_id=account_id,
            idempotency_key=key,
            target_id=run.id,
            payload={"context": context},
        )
    except queue.ActiveJobExists as exc:
        raise HTTPException(409, str(exc))
    if not created:
        await db.delete(run)
        await db.commit()
        existing = await db.get(RadarRun, job.target_id) if job.target_id else None
        response.status_code = 200
        return _run_out(existing) if existing is not None else _run_out(run)
    log.info("job_id=%s account_id=%s rulare %s pusa in coada", job.id, account_id, run.id)
    await db.refresh(run)
    return _run_out(run)


@router.get("/runs", response_model=list[RadarRunOut])
async def list_runs(
    limit: int = Query(20, ge=1, le=100),
    account_id: int = Depends(require_account),
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
    account_id: int = Depends(require_account),
    db: AsyncSession = Depends(get_db),
):
    run = await _get_run(db, account_id, run_id)
    return _run_out(run, with_report=True)


@router.get("/runs/{run_id}/pdf")
async def get_run_pdf(
    run_id: int,
    account_id: int = Depends(require_account),
    db: AsyncSession = Depends(get_db),
):
    from app.radar.pdf import build_report_pdf

    run = await _get_run(db, account_id, run_id)
    if not run.report:
        raise HTTPException(400, "Raportul nu este gata inca.")
    try:
        account_name = (await monolith.business_context(account_id)).get("account_name") or ""
    except monolith.MonolithUnavailable:
        account_name = ""
    pdf = await asyncio.to_thread(build_report_pdf, run, account_name)
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=radar-{run_id}.pdf"},
    )


@router.delete("/runs/{run_id}", status_code=204)
async def delete_run(
    run_id: int,
    account_id: int = Depends(require_account),
    db: AsyncSession = Depends(get_db),
):
    run = await _get_run(db, account_id, run_id)
    if run.status in ACTIVE_STATUSES:
        raise HTTPException(409, "Analiza este in curs; nu poate fi stearsa.")
    await db.delete(run)
    await db.commit()
    return Response(status_code=204)
