"""Job APScheduler pentru rularile Radar programate (luni 06:00 Europe/Bucharest)."""
from __future__ import annotations

import logging
from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models.radar import RadarRun, RadarSettings
from app.services.reports.builder import BUCHAREST_TZ

from .engine import run_radar

log = logging.getLogger("berlinstar.radar.scheduler")

RUN_HOUR = 6
ACTIVE_STATUSES = ("queued", "running")

_scheduler: AsyncIOScheduler | None = None


def get_radar_scheduler() -> AsyncIOScheduler | None:
    return _scheduler


def _is_due(schedule: str, today: date) -> bool:
    if schedule == "weekly":
        return True
    return schedule == "monthly" and today.day <= 7


async def _scheduled_tick() -> None:
    """Creeaza si ruleaza secvential run-urile programate pentru conturile eligibile."""
    today = datetime.now(ZoneInfo(BUCHAREST_TZ)).date()
    async with AsyncSessionLocal() as db:
        rows = (await db.execute(
            select(RadarSettings).where(RadarSettings.schedule.in_(("weekly", "monthly")))
        )).scalars().all()
        due = [s.account_id for s in rows if _is_due(s.schedule, today)]

        pending = []
        for account_id in due:
            active = (await db.execute(
                select(RadarRun.id).where(
                    RadarRun.account_id == account_id,
                    RadarRun.status.in_(ACTIVE_STATUSES),
                ).limit(1)
            )).scalars().first()
            if active is not None:
                continue
            run = RadarRun(
                account_id=account_id,
                status="queued",
                trigger="scheduled",
                started_at=datetime.now(timezone.utc),
                progress={"step": "În așteptare", "done": 0, "total": 1, "log": []},
            )
            db.add(run)
            await db.flush()
            pending.append(run.id)
        await db.commit()

    for run_id in pending:
        try:
            await run_radar(run_id)
        except Exception:  # noqa: BLE001
            log.exception("Run Radar programat %s a esuat.", run_id)
    if pending:
        log.info("Radar: %d rulari programate procesate.", len(pending))


async def start_radar_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        log.warning("Scheduler-ul Radar este deja pornit.")
        return
    _scheduler = AsyncIOScheduler(timezone=BUCHAREST_TZ)
    _scheduler.add_job(
        _scheduled_tick,
        CronTrigger(day_of_week="mon", hour=RUN_HOUR, minute=0, timezone=BUCHAREST_TZ),
        id="radar_weekly_runs",
        replace_existing=True,
        misfire_grace_time=3600,
        coalesce=True,
    )
    _scheduler.start()
    log.info("Scheduler Radar pornit: luni %02d:00 %s.", RUN_HOUR, BUCHAREST_TZ)


async def stop_radar_scheduler() -> None:
    global _scheduler
    if _scheduler is None:
        return
    _scheduler.shutdown(wait=False)
    _scheduler = None
    log.info("Scheduler Radar oprit.")
