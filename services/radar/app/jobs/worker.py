"""Procesul worker: claim -> executie cu timeout -> heartbeat, cu SIGTERM curat."""
from __future__ import annotations

import asyncio
import logging
import signal

from app import monolith
from app.database import AsyncSessionLocal
from app.jobs import queue
from app.logging_config import setup_logging

log = logging.getLogger("radar.worker")

IDLE_SLEEP = 2.0
RECOVERY_EVERY = 60.0
HEARTBEAT_EVERY = 30.0
SHUTDOWN_GRACE = 25.0

_stop = asyncio.Event()


async def _dispatch(kind: str, target_id: int | None, account_id: int, payload: dict):
    if kind == "radar_run":
        from app.radar.engine import run_radar

        await run_radar(int(target_id), payload)
        return None
    if kind == "discovery":
        from app.radar.discovery import run_discovery

        await run_discovery(int(target_id), payload)
        return None
    if kind == "discovery_prepare":
        from app.radar.discovery import prepare

        async with AsyncSessionLocal() as db:
            return await prepare(db, account_id, payload)
    raise RuntimeError(f"Tip de job necunoscut: {kind}")


async def _heartbeat_loop(job_id: int) -> None:
    while True:
        await asyncio.sleep(HEARTBEAT_EVERY)
        try:
            await queue.heartbeat(job_id)
            await queue.touch_worker()
        except Exception as exc:  # noqa: BLE001
            log.warning("job_id=%s heartbeat eșuat: %s", job_id, exc)


async def _run_job(job) -> None:
    job_id, kind, account_id = job.id, job.kind, job.account_id
    target_id, payload = job.target_id, dict(job.payload or {})
    log.info("job_id=%s kind=%s account_id=%s pornit", job_id, kind, account_id)

    beat = asyncio.create_task(_heartbeat_loop(job_id))
    task = asyncio.create_task(_dispatch(kind, target_id, account_id, payload))
    try:
        done, _ = await asyncio.wait(
            [task, asyncio.create_task(_stop.wait())],
            timeout=queue.TIMEOUTS.get(kind, 900),
            return_when=asyncio.FIRST_COMPLETED,
        )
        if task not in done and _stop.is_set():
            _, pending = await asyncio.wait([task], timeout=SHUTDOWN_GRACE)
            if pending:
                task.cancel()
                async with AsyncSessionLocal() as db:
                    await queue.requeue(db, job_id)
                log.info("job_id=%s repus in coada la oprire", job_id)
                return
        if not task.done():
            task.cancel()
            async with AsyncSessionLocal() as db:
                await queue.fail(db, job_id, queue.TIMEOUT_MESSAGE, retry=False)
            log.warning("job_id=%s kind=%s a depasit timeoutul", job_id, kind)
            return
        result = task.result()
        async with AsyncSessionLocal() as db:
            await queue.complete(db, job_id, result)
        log.info("job_id=%s kind=%s gata", job_id, kind)
    except Exception as exc:  # noqa: BLE001
        log.exception("job_id=%s kind=%s a esuat", job_id, kind)
        async with AsyncSessionLocal() as db:
            await queue.fail(db, job_id, str(exc) or "Eroare necunoscută.")
    finally:
        beat.cancel()
        for pending_task in (beat, task):
            try:
                await pending_task
            except (asyncio.CancelledError, Exception):  # noqa: BLE001
                pass


async def _recover() -> None:
    async with AsyncSessionLocal() as db:
        await queue.recover_stale(db)


async def _lane(kinds: tuple[str, ...]) -> None:
    """O banda ia doar anumite tipuri: pregatirea (scurta) nu asteapta dupa o analiza de minute."""
    while not _stop.is_set():
        try:
            async with AsyncSessionLocal() as db:
                job = await queue.claim(db, kinds)
        except Exception as exc:  # noqa: BLE001
            log.warning("Claim eșuat (%s): %s", ",".join(kinds), exc)
            job = None
        if job is None:
            try:
                await asyncio.wait_for(_stop.wait(), timeout=IDLE_SLEEP)
            except asyncio.TimeoutError:
                pass
            continue
        await _run_job(job)


async def run_worker() -> None:
    setup_logging()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGTERM, signal.SIGINT):
        try:
            loop.add_signal_handler(sig, _stop.set)
        except NotImplementedError:  # pragma: no cover — Windows
            signal.signal(sig, lambda *_: _stop.set())

    from app.jobs.scheduler import start_scheduler, stop_scheduler

    log.info("Worker Radar pornit.")
    await queue.touch_worker()
    await _recover()
    await start_scheduler()
    lanes = [asyncio.create_task(_lane(queue.HEAVY_KINDS)), asyncio.create_task(_lane(queue.LIGHT_KINDS))]
    last_recovery = loop.time()
    try:
        while not _stop.is_set():
            if loop.time() - last_recovery >= RECOVERY_EVERY:
                await _recover()
                last_recovery = loop.time()
            await queue.touch_worker()
            try:
                await asyncio.wait_for(_stop.wait(), timeout=IDLE_SLEEP)
            except asyncio.TimeoutError:
                pass
        await asyncio.gather(*lanes, return_exceptions=True)
    finally:
        await stop_scheduler()
        await monolith.close()
        log.info("Worker Radar oprit.")


def main() -> None:
    asyncio.run(run_worker())
