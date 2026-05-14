"""APScheduler setup pentru job-urile de rapoarte."""
from __future__ import annotations
import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from .builder import BUCHAREST_TZ
from .manager import run_all

log = logging.getLogger("berlinstar.reports")

_scheduler: AsyncIOScheduler | None = None


def get_scheduler() -> AsyncIOScheduler | None:
    return _scheduler


async def start_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        log.warning("Scheduler-ul de rapoarte este deja pornit.")
        return

    _scheduler = AsyncIOScheduler(timezone=BUCHAREST_TZ)

    # Daily la 02:00 — rulează incremental (de la ultima rulare până ieri)
    _scheduler.add_job(
        run_all,
        CronTrigger(hour=2, minute=0, timezone=BUCHAREST_TZ),
        kwargs={"mode": "incremental"},
        id="reports_daily_incremental",
        replace_existing=True,
        misfire_grace_time=3600,
        coalesce=True,
    )

    # Duminică la 04:00 — refresh pentru luna trecută + luna curentă
    _scheduler.add_job(
        run_all,
        CronTrigger(day_of_week="sun", hour=4, minute=0, timezone=BUCHAREST_TZ),
        kwargs={"mode": "weekly_refresh"},
        id="reports_weekly_refresh",
        replace_existing=True,
        misfire_grace_time=3600,
        coalesce=True,
    )

    _scheduler.start()
    log.info(
        "Scheduler rapoarte pornit (timezone=%s). Job-uri: daily@02:00 + sunday@04:00.",
        BUCHAREST_TZ,
    )


async def stop_scheduler() -> None:
    global _scheduler
    if _scheduler is None:
        return
    _scheduler.shutdown(wait=False)
    _scheduler = None
    log.info("Scheduler rapoarte oprit.")
