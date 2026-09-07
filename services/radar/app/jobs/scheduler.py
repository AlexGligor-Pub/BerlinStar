"""Rularile programate: luni 06:00 Europe/Bucharest, doar ENQUEUE (fara executie inline)."""
from __future__ import annotations

import logging
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy import select, text

from app import monolith
from app.database import IS_POSTGRES, AsyncSessionLocal
from app.jobs import queue
from app.models.radar import RadarRun, RadarSettings

log = logging.getLogger("radar.scheduler")

BUCHAREST_TZ = "Europe/Bucharest"
RUN_HOUR = 6
CATCHUP_HOURS = 48

_scheduler: AsyncIOScheduler | None = None


def _is_due(schedule: str, today: date) -> bool:
    if schedule == "weekly":
        return True
    return schedule == "monthly" and today.day <= 7


def _last_slot(now: datetime) -> datetime:
    """Ultimul moment „luni 06:00" din trecut, in ora Bucurestiului."""
    slot = now.replace(hour=RUN_HOUR, minute=0, second=0, microsecond=0)
    slot -= timedelta(days=slot.weekday())
    if slot > now:
        slot -= timedelta(days=7)
    return slot


async def _advisory_lock(db) -> bool:
    """O singura replica de worker face tick-ul; lock-ul se elibereaza la commit."""
    if not IS_POSTGRES:
        return True
    return bool((await db.execute(
        text("SELECT pg_try_advisory_xact_lock(hashtext('radar_scheduler'))")
    )).scalar())


async def _tick(slot_date: date | None = None) -> int:
    today = slot_date or datetime.now(ZoneInfo(BUCHAREST_TZ)).date()
    started = 0
    async with AsyncSessionLocal() as db:
        if not await _advisory_lock(db):
            log.info("Tick programat sarit: alta replica il face.")
            return 0
        rows = (await db.execute(
            select(RadarSettings).where(RadarSettings.schedule.in_(("weekly", "monthly")))
        )).scalars().all()
        due = [s.account_id for s in rows if _is_due(s.schedule, today)]

    for account_id in due:
        try:
            context = await monolith.business_context(account_id)
        except monolith.MonolithUnavailable as exc:
            log.warning("account_id=%s context indisponibil: %s", account_id, exc)
            continue
        async with AsyncSessionLocal() as db:
            run = RadarRun(
                account_id=account_id,
                status="queued",
                trigger="scheduled",
                started_at=datetime.now(timezone.utc),
                progress={"step": "În așteptare", "done": 0, "total": 0, "log": []},
            )
            db.add(run)
            await db.flush()
            try:
                _, created = await queue.enqueue(
                    db,
                    kind="radar_run",
                    account_id=account_id,
                    idempotency_key=f"radar:{account_id}:{today.isoformat()}",
                    target_id=run.id,
                    payload={"context": context},
                )
            except queue.ActiveJobExists:
                await db.rollback()
                continue
            if not created:
                await db.rollback()
                continue
        started += 1
    if started:
        log.info("Programat: %d rulari puse in coada pentru %s.", started, today.isoformat())
    return started


async def start_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        return
    _scheduler = AsyncIOScheduler(timezone=BUCHAREST_TZ)
    _scheduler.add_job(
        _tick,
        CronTrigger(day_of_week="mon", hour=RUN_HOUR, minute=0, timezone=BUCHAREST_TZ),
        id="radar_weekly_runs",
        replace_existing=True,
        misfire_grace_time=3600,
        coalesce=True,
    )
    _scheduler.start()
    log.info("Scheduler Radar pornit: luni %02d:00 %s.", RUN_HOUR, BUCHAREST_TZ)
    await _catchup()


async def _catchup() -> None:
    """Slotul saptamanii curente, ratat pentru ca serviciul era jos (max 48 h)."""
    now = datetime.now(ZoneInfo(BUCHAREST_TZ))
    slot = _last_slot(now)
    if (now - slot) > timedelta(hours=CATCHUP_HOURS):
        return
    try:
        await _tick(slot.date())
    except Exception:  # noqa: BLE001
        log.exception("Recuperarea slotului programat %s a esuat.", slot.date())


async def stop_scheduler() -> None:
    global _scheduler
    if _scheduler is None:
        return
    _scheduler.shutdown(wait=False)
    _scheduler = None
    log.info("Scheduler Radar oprit.")
