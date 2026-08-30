from __future__ import annotations
import asyncio
import logging
from datetime import date, datetime
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.routers.admin import _require_super_admin
from app.rate_limit import limiter
from app.services.reports import (
    run_report,
    list_reports,
    can_trigger,
    COOLDOWN_SECONDS,
)
from app.services.reports.manager import SUPPORTED_REPORTS, mark_triggered, run_all

log = logging.getLogger("berlinstar.reports")

# Rapoartele agregate se recalculeaza global, pentru toate conturile, deci
# declansarea lor e treaba platformei — nu a unui utilizator oarecare. Gate-ul
# sta pe router, ca o ruta noua sa fie protejata din start.
router = APIRouter(dependencies=[Depends(_require_super_admin)])


class ReportStatusOut(BaseModel):
    report_type: str
    status: str
    last_run_at: datetime | None
    last_period_start: date | None
    last_period_end: date | None
    last_triggered_at: datetime | None
    last_error: str | None
    last_duration_ms: int | None
    cooldown_remaining_s: int


class TriggerResponse(BaseModel):
    accepted: bool
    report_type: str
    cooldown_remaining_s: int


@router.get("", response_model=list[ReportStatusOut])
async def list_all_reports(
    db: AsyncSession = Depends(get_db),
):
    rows = await list_reports(db)
    return [ReportStatusOut(**row.__dict__) for row in rows]


@router.post("/{report_type}/trigger", response_model=TriggerResponse, status_code=202)
@limiter.limit("3/minute")
async def trigger_report(
    request: Request,
    report_type: str,
    mode: str = "incremental",
    db: AsyncSession = Depends(get_db),
):
    if report_type not in SUPPORTED_REPORTS:
        raise HTTPException(404, "Raport necunoscut.")
    if mode not in ("incremental", "weekly_refresh"):
        raise HTTPException(400, "Mod invalid.")

    ok, remaining = await can_trigger(db, report_type)
    if not ok:
        raise HTTPException(
            status_code=429,
            detail=f"Raportul a fost rulat recent. Disponibil în {remaining}s.",
            headers={"Retry-After": str(remaining)},
        )

    await mark_triggered(db, report_type)

    # Pornește jobul în background — nu blocăm răspunsul HTTP
    asyncio.create_task(_safe_run(report_type, mode))

    return TriggerResponse(
        accepted=True,
        report_type=report_type,
        cooldown_remaining_s=COOLDOWN_SECONDS,
    )


async def _safe_run(report_type: str, mode: str) -> None:
    try:
        await run_report(report_type, mode)  # type: ignore[arg-type]
    except Exception:
        log.exception("Background run pentru raportul %s a eșuat.", report_type)


class RunAllResponse(BaseModel):
    accepted: bool
    count: int
    mode: str
    period_start: date | None
    period_end: date | None
    stagger_seconds: int


@router.post("/run-all", response_model=RunAllResponse, status_code=202)
@limiter.limit("3/minute")
async def trigger_run_all(
    request: Request,
    mode: str = "incremental",
    period_start: date | None = None,
    period_end: date | None = None,
    stagger_seconds: int = 0,
    db: AsyncSession = Depends(get_db),
):
    """Rulează toate rapoartele secvențial.

    - fără `period_start`/`period_end`: foloseste `mode` (incremental sau weekly_refresh)
    - cu `period_start` + `period_end`: rebuild pe interval custom (override pe toate)

    Bypass cooldown per-raport: e o operație explicit declanșată de admin.
    """
    if mode not in ("incremental", "weekly_refresh"):
        raise HTTPException(400, "Mod invalid.")
    has_start = period_start is not None
    has_end = period_end is not None
    if has_start != has_end:
        raise HTTPException(400, "period_start și period_end trebuie furnizate împreună.")

    period_override: tuple[date, date] | None = None
    if has_start and has_end:
        assert period_start is not None and period_end is not None
        if period_start > period_end:
            raise HTTPException(400, "period_start trebuie ≤ period_end.")
        period_override = (period_start, period_end)

    if stagger_seconds < 0 or stagger_seconds > 600:
        raise HTTPException(400, "stagger_seconds trebuie între 0 și 600.")

    # Marcheaza toate rapoartele ca triggered (cooldown UI) — bypass-am verificarea de cooldown.
    for rt in SUPPORTED_REPORTS:
        await mark_triggered(db, rt)

    asyncio.create_task(_safe_run_all(mode, stagger_seconds, period_override))

    return RunAllResponse(
        accepted=True,
        count=len(SUPPORTED_REPORTS),
        mode=mode,
        period_start=period_start,
        period_end=period_end,
        stagger_seconds=stagger_seconds,
    )


async def _safe_run_all(
    mode: str,
    stagger_seconds: int,
    period_override: tuple[date, date] | None,
) -> None:
    try:
        await run_all(mode, stagger_seconds=stagger_seconds, period_override=period_override)  # type: ignore[arg-type]
    except Exception:
        log.exception("Background run-all a eșuat.")
