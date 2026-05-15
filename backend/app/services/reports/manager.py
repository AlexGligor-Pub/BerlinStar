"""Orchestrare run / trigger / cooldown pentru rapoarte."""
from __future__ import annotations
import logging
import time
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from typing import Literal
from zoneinfo import ZoneInfo
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal
from app.models.report_run import ReportRun
from .builder import BUILDERS, BUCHAREST_TZ

log = logging.getLogger("berlinstar.reports")

COOLDOWN_SECONDS = 300  # 5 minute
SUPPORTED_REPORTS = (
    "receipts_daily",
    "employee_daily",
    "cazari_daily",
    "clients_daily",
    "programari_daily",
)
RunMode = Literal["incremental", "weekly_refresh"]

_BUCHAREST = ZoneInfo(BUCHAREST_TZ)


@dataclass
class ReportStatus:
    report_type: str
    status: str
    last_run_at: datetime | None
    last_period_start: date | None
    last_period_end: date | None
    last_triggered_at: datetime | None
    last_error: str | None
    last_duration_ms: int | None
    cooldown_remaining_s: int


def _bucharest_today() -> date:
    return datetime.now(_BUCHAREST).date()


def _compute_period(
    mode: RunMode,
    last_period_end: date | None,
    oldest_source_date: date | None,
) -> tuple[date, date] | None:
    """Returnează (period_start, period_end) sau None dacă nu e nimic de procesat."""
    today_buc = _bucharest_today()
    yesterday_buc = today_buc - timedelta(days=1)

    if mode == "weekly_refresh":
        first_of_this_month = today_buc.replace(day=1)
        last_of_prev_month = first_of_this_month - timedelta(days=1)
        first_of_prev_month = last_of_prev_month.replace(day=1)
        return first_of_prev_month, today_buc

    # incremental
    if last_period_end is None:
        if oldest_source_date is None:
            return None
        return oldest_source_date, yesterday_buc

    start = last_period_end + timedelta(days=1)
    if start > yesterday_buc:
        return None
    return start, yesterday_buc


async def _get_oldest_source_date(db: AsyncSession, report_type: str) -> date | None:
    """Cea mai veche dată de sursă pentru un report_type — folosită doar la
    primul run (când last_period_end e NULL) pentru a determina de unde
    începe backfill-ul.
    """
    if report_type in ("receipts_daily", "employee_daily", "clients_daily"):
        query = text(
            f"SELECT MIN((created_at AT TIME ZONE '{BUCHAREST_TZ}')::date) FROM receipts"
        )
    elif report_type == "cazari_daily":
        # Cea mai veche zi de eveniment (check-in sau check-out). data_checkin
        # e Date deja, fără timezone — nu necesită conversie.
        query = text(
            "SELECT LEAST(MIN(data_checkin), MIN(data_checkout)) FROM cazari_anvelope "
            "WHERE is_deleted = false"
        )
    elif report_type == "programari_daily":
        query = text(
            f"SELECT MIN((start_time AT TIME ZONE '{BUCHAREST_TZ}')::date) FROM programari "
            "WHERE is_deleted = false"
        )
    else:
        return None
    return (await db.execute(query)).scalar_one_or_none()


async def list_reports(db: AsyncSession) -> list[ReportStatus]:
    rows = (await db.execute(select(ReportRun).order_by(ReportRun.report_type))).scalars().all()
    now = datetime.now(timezone.utc)
    out: list[ReportStatus] = []
    for r in rows:
        cooldown = 0
        if r.last_triggered_at:
            delta = (now - r.last_triggered_at).total_seconds()
            if delta < COOLDOWN_SECONDS:
                cooldown = int(COOLDOWN_SECONDS - delta)
        out.append(ReportStatus(
            report_type=r.report_type,
            status=r.status,
            last_run_at=r.last_run_at,
            last_period_start=r.last_period_start,
            last_period_end=r.last_period_end,
            last_triggered_at=r.last_triggered_at,
            last_error=r.last_error,
            last_duration_ms=r.last_duration_ms,
            cooldown_remaining_s=cooldown,
        ))
    return out


async def can_trigger(db: AsyncSession, report_type: str) -> tuple[bool, int]:
    """Returnează (poate_rula, secunde_ramase_cooldown)."""
    if report_type not in SUPPORTED_REPORTS:
        return False, 0
    r = (await db.execute(
        select(ReportRun).where(ReportRun.report_type == report_type)
    )).scalar_one_or_none()
    if r is None:
        return True, 0
    if r.last_triggered_at is None:
        return True, 0
    delta = (datetime.now(timezone.utc) - r.last_triggered_at).total_seconds()
    if delta >= COOLDOWN_SECONDS:
        return True, 0
    return False, int(COOLDOWN_SECONDS - delta)


async def mark_triggered(db: AsyncSession, report_type: str) -> None:
    """Setează last_triggered_at=NOW() pentru a porni cooldown-ul imediat."""
    await db.execute(
        text(
            "UPDATE report_runs SET last_triggered_at = NOW(), updated_at = NOW() "
            "WHERE report_type = :rt"
        ),
        {"rt": report_type},
    )
    await db.commit()


async def run_report(report_type: str, mode: RunMode = "incremental") -> dict:
    """Rulează un raport într-o sesiune nouă. Folosit din scheduler și ca task din endpoint."""
    if report_type not in BUILDERS:
        raise ValueError(f"Raport necunoscut: {report_type}")

    start_ts = time.monotonic()
    async with AsyncSessionLocal() as db:
        # Lock advisory pe rândul din report_runs — previne rulări concurente
        run = (await db.execute(
            select(ReportRun).where(ReportRun.report_type == report_type).with_for_update()
        )).scalar_one_or_none()
        if run is None:
            run = ReportRun(report_type=report_type, status="idle", updated_at=datetime.now(timezone.utc))
            db.add(run)
            await db.flush()

        if run.status == "running":
            log.warning("Raportul %s e deja în rulare — skip.", report_type)
            return {"skipped": True, "reason": "already_running"}

        oldest = await _get_oldest_source_date(db, report_type)
        period = _compute_period(mode, run.last_period_end, oldest)
        if period is None:
            log.info("Raportul %s nu are perioadă de procesat (mode=%s).", report_type, mode)
            run.status = "idle"
            run.updated_at = datetime.now(timezone.utc)
            await db.commit()
            return {"skipped": True, "reason": "nothing_to_do"}

        period_start, period_end = period

        run.status = "running"
        run.last_period_start = period_start
        run.last_triggered_at = datetime.now(timezone.utc)
        run.last_error = None
        run.updated_at = datetime.now(timezone.utc)
        await db.commit()

    # Rulează builder-ul într-o sesiune separată (commit explicit la sfârșit)
    try:
        async with AsyncSessionLocal() as build_db:
            inserted = await BUILDERS[report_type](build_db, period_start, period_end)
            await build_db.commit()

        duration_ms = int((time.monotonic() - start_ts) * 1000)
        async with AsyncSessionLocal() as upd:
            await upd.execute(
                text(
                    "UPDATE report_runs SET status = 'idle', last_run_at = NOW(), "
                    "last_period_end = :pe, last_duration_ms = :dur, "
                    "last_error = NULL, updated_at = NOW() "
                    "WHERE report_type = :rt"
                ),
                {"pe": period_end, "dur": duration_ms, "rt": report_type},
            )
            await upd.commit()

        log.info(
            "Raport %s finalizat în %dms (%s..%s, %d rânduri).",
            report_type, duration_ms, period_start, period_end, inserted,
        )
        return {
            "ok": True,
            "report_type": report_type,
            "period_start": period_start.isoformat(),
            "period_end": period_end.isoformat(),
            "rows": inserted,
            "duration_ms": duration_ms,
        }
    except Exception as exc:
        log.exception("Eroare la rularea raportului %s", report_type)
        duration_ms = int((time.monotonic() - start_ts) * 1000)
        try:
            async with AsyncSessionLocal() as upd:
                await upd.execute(
                    text(
                        "UPDATE report_runs SET status = 'failed', last_error = :err, "
                        "last_duration_ms = :dur, updated_at = NOW() "
                        "WHERE report_type = :rt"
                    ),
                    {"err": str(exc)[:2000], "dur": duration_ms, "rt": report_type},
                )
                await upd.commit()
        except Exception:
            log.exception("Nu am putut actualiza statusul report_runs după eșec.")
        raise


async def run_all(mode: RunMode = "incremental") -> None:
    """Rulează toate rapoartele suportate, secvențial."""
    for rt in SUPPORTED_REPORTS:
        try:
            await run_report(rt, mode)
        except Exception:
            log.exception("Raportul %s a eșuat, continuăm cu următorul.", rt)
