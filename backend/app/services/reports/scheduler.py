"""APScheduler setup pentru job-urile de rapoarte."""
from __future__ import annotations
import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy import text

from app.database import AsyncSessionLocal
from .builder import BUCHAREST_TZ
from .manager import run_all

log = logging.getLogger("berlinstar.reports")

_scheduler: AsyncIOScheduler | None = None

# Pauza intre rapoarte la o rulare batch (in secunde), ca sa nu loveasca DB-ul
# cu toate query-urile odata.
STAGGER_SECONDS = 180  # 3 minute


def get_scheduler() -> AsyncIOScheduler | None:
    return _scheduler


async def _recover_stale_running() -> None:
    """La pornire, marcam orice raport cu status='running' ca 'failed'.

    Why: cand workerul gunicorn e reciclat (max-requests) sau containerul restartat
    in timp ce un raport rula, statusul ramane 'running' in DB si urmatoarele
    rulari planificate sunt sarite. Curatam la fiecare start.
    """
    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                text(
                    "UPDATE report_runs SET status = 'failed', "
                    "last_error = 'stale_running_recovered_on_startup', updated_at = NOW() "
                    "WHERE status = 'running' RETURNING report_type"
                )
            )
            rows = result.fetchall()
            await db.commit()
            if rows:
                log.warning(
                    "Recovered %d rapoarte blocate in status='running' la startup: %s",
                    len(rows), [r[0] for r in rows],
                )
    except Exception:
        log.exception("Recovery stale 'running' la startup a esuat.")


async def start_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        log.warning("Scheduler-ul de rapoarte este deja pornit.")
        return

    await _recover_stale_running()

    _scheduler = AsyncIOScheduler(timezone=BUCHAREST_TZ)

    # Luni - sambata, la fiecare 2 ore intre 08:00 si 20:00 (08, 10, 12, 14, 16, 18, 20).
    # In fiecare slot ruleaza toate rapoartele secvential cu pauza de 3 minute intre ele,
    # pentru a nu suprasolicita DB-ul. Rapoartele individuale au cooldown intern de 5min,
    # asa ca daca un job nu se termina pana la urmatoarea ora-par se va sari peste.
    _scheduler.add_job(
        run_all,
        CronTrigger(
            day_of_week="mon-sat",
            hour="8-20/2",
            minute=0,
            timezone=BUCHAREST_TZ,
        ),
        kwargs={"mode": "incremental", "stagger_seconds": STAGGER_SECONDS},
        id="reports_business_hours_incremental",
        replace_existing=True,
        misfire_grace_time=600,
        coalesce=True,
    )

    _scheduler.start()
    log.info(
        "Scheduler rapoarte pornit (timezone=%s). Job: luni-sambata 08:00-20:00 / 2h, "
        "stagger %ds intre rapoarte.",
        BUCHAREST_TZ, STAGGER_SECONDS,
    )


async def stop_scheduler() -> None:
    global _scheduler
    if _scheduler is None:
        return
    _scheduler.shutdown(wait=False)
    _scheduler = None
    log.info("Scheduler rapoarte oprit.")
