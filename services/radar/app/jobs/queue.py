"""Coada de job-uri pe Postgres: enqueue idempotent, claim SKIP LOCKED, lease-uri."""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, text, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import IS_POSTGRES, AsyncSessionLocal
from app.models.jobs import ACTIVE_STATUSES, RadarJob, WorkerHeartbeat

log = logging.getLogger("radar.jobs")

LEASE_SECONDS = 300
MAX_ATTEMPTS = {"radar_run": 2, "discovery": 1, "discovery_prepare": 1}
TIMEOUTS = {"radar_run": 1200, "discovery": 900, "discovery_prepare": 300}

RESTART_MESSAGE = "Analiza a fost întreruptă de o repornire a serviciului. Încearcă din nou."
TIMEOUT_MESSAGE = "Analiza a depășit timpul maxim alocat și a fost oprită. Încearcă din nou."
ACTIVE_MESSAGE = {
    "radar_run": "Exista deja o analiza in curs. Asteapta sa se termine.",
    "discovery": "Exista deja o descoperire in curs. Asteapta sa se termine.",
    "discovery_prepare": "Pregatirea descoperirii este deja in curs. Asteapta sa se termine.",
}

HEAVY_KINDS = ("radar_run", "discovery")
LIGHT_KINDS = ("discovery_prepare",)
ALL_KINDS = HEAVY_KINDS + LIGHT_KINDS

_CLAIM_SQL = text(
    """
    UPDATE radar.radar_jobs SET status = 'running', attempts = attempts + 1,
           started_at = now(), lease_until = now() + make_interval(secs => :lease)
    WHERE id = (
        SELECT id FROM radar.radar_jobs
        WHERE status = 'queued' AND kind = ANY(:kinds)
          AND (scheduled_for IS NULL OR scheduled_for <= now())
        ORDER BY id
        FOR UPDATE SKIP LOCKED
        LIMIT 1
    )
    RETURNING id
    """
)


class ActiveJobExists(RuntimeError):
    """Contul are deja un job activ de acelasi tip; mesajul e afisabil utilizatorului."""

    def __init__(self, kind: str):
        super().__init__(ACTIVE_MESSAGE.get(kind, "Exista deja o operatie in curs."))
        self.kind = kind


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _lease() -> datetime:
    return _now() + timedelta(seconds=LEASE_SECONDS)


async def by_key(db: AsyncSession, idempotency_key: str) -> RadarJob | None:
    return (await db.execute(
        select(RadarJob).where(RadarJob.idempotency_key == idempotency_key)
    )).scalar_one_or_none()


async def enqueue(
    db: AsyncSession,
    kind: str,
    account_id: int,
    idempotency_key: str,
    target_id: int | None = None,
    payload: dict | None = None,
    max_attempts: int | None = None,
    scheduled_for: datetime | None = None,
) -> tuple[RadarJob, bool]:
    """`(job, creat)`. Aceeasi cheie de idempotenta intoarce job-ul existent, nu unul nou."""
    values = {
        "kind": kind,
        "account_id": account_id,
        "target_id": target_id,
        "idempotency_key": idempotency_key,
        "status": "queued",
        "attempts": 0,
        "max_attempts": max_attempts or MAX_ATTEMPTS.get(kind, 1),
        "payload": payload,
        "scheduled_for": scheduled_for,
        "created_at": _now(),
    }
    if IS_POSTGRES:
        from sqlalchemy.dialects.postgresql import insert as pg_insert

        statement = (
            pg_insert(RadarJob)
            .values(**values)
            .on_conflict_do_nothing(index_elements=["idempotency_key"])
            .returning(RadarJob.id)
        )
        try:
            job_id = (await db.execute(statement)).scalar_one_or_none()
            await db.commit()
        except IntegrityError as exc:
            await db.rollback()
            raise ActiveJobExists(kind) from exc
        if job_id is None:
            existing = await by_key(db, idempotency_key)
            if existing is None:
                raise ActiveJobExists(kind)
            return existing, False
        return await db.get(RadarJob, job_id), True

    job = RadarJob(**values)
    db.add(job)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        existing = await by_key(db, idempotency_key)
        if existing is not None:
            return existing, False
        raise ActiveJobExists(kind) from exc
    return job, True


async def claim(db: AsyncSession, kinds: tuple[str, ...] = ALL_KINDS) -> RadarJob | None:
    """Ia un job din coada. Pe Postgres, `FOR UPDATE SKIP LOCKED`; pe SQLite, un worker."""
    if IS_POSTGRES:
        params = {"lease": LEASE_SECONDS, "kinds": list(kinds)}
        job_id = (await db.execute(_CLAIM_SQL, params)).scalar_one_or_none()
        await db.commit()
        return await db.get(RadarJob, job_id) if job_id is not None else None

    now = _now()
    job = (await db.execute(
        select(RadarJob)
        .where(RadarJob.status == "queued", RadarJob.kind.in_(kinds))
        .where((RadarJob.scheduled_for.is_(None)) | (RadarJob.scheduled_for <= now))
        .order_by(RadarJob.id)
        .limit(1)
    )).scalars().first()
    if job is None:
        return None
    job.status = "running"
    job.attempts = (job.attempts or 0) + 1
    job.started_at = now
    job.lease_until = _lease()
    await db.commit()
    return job


async def heartbeat(job_id: int) -> None:
    """Prelungeste lease-ul job-ului in curs (tranzactie proprie, scurta)."""
    async with AsyncSessionLocal() as db:
        await db.execute(
            update(RadarJob).where(RadarJob.id == job_id).values(lease_until=_lease())
        )
        await db.commit()


async def touch_worker() -> None:
    """Bataia de inima a worker-ului, citita de `/ready`."""
    async with AsyncSessionLocal() as db:
        row = await db.get(WorkerHeartbeat, 1)
        if row is None:
            db.add(WorkerHeartbeat(id=1, heartbeat_at=_now()))
        else:
            row.heartbeat_at = _now()
        try:
            await db.commit()
        except IntegrityError:
            await db.rollback()


async def worker_heartbeat_age(db: AsyncSession) -> float | None:
    """Vechimea in secunde a bataii de inima, sau None daca worker-ul n-a pornit niciodata."""
    row = await db.get(WorkerHeartbeat, 1)
    if row is None or row.heartbeat_at is None:
        return None
    beat = row.heartbeat_at
    if beat.tzinfo is None:
        beat = beat.replace(tzinfo=timezone.utc)
    return (_now() - beat).total_seconds()


async def recover_stale(db: AsyncSession) -> tuple[int, int]:
    """Job-urile cu lease expirat: reluate daca mai au incercari, altfel `failed`."""
    now = _now()
    rows = (await db.execute(
        select(RadarJob).where(
            RadarJob.status == "running",
            RadarJob.lease_until.isnot(None),
            RadarJob.lease_until < now,
        )
    )).scalars().all()
    requeued = failed = 0
    for job in rows:
        if (job.attempts or 0) < (job.max_attempts or 1):
            job.status = "queued"
            job.lease_until = None
            requeued += 1
        else:
            job.status = "failed"
            job.error = RESTART_MESSAGE
            job.finished_at = now
            job.lease_until = None
            failed += 1
            await _fail_target(db, job, RESTART_MESSAGE)
    if rows:
        await db.commit()
        log.info("Recuperare job-uri: %d reluate, %d eșuate.", requeued, failed)
    return requeued, failed


async def complete(db: AsyncSession, job_id: int, result: dict | None = None) -> None:
    job = await db.get(RadarJob, job_id)
    if job is None:
        return
    job.status = "done"
    job.result = result
    job.error = None
    job.finished_at = _now()
    job.lease_until = None
    await db.commit()


async def fail(db: AsyncSession, job_id: int, message: str, retry: bool = True) -> None:
    """Marcheaza job-ul ca eșuat sau il pune la coada daca mai are incercari."""
    job = await db.get(RadarJob, job_id)
    if job is None:
        return
    if retry and (job.attempts or 0) < (job.max_attempts or 1):
        job.status = "queued"
        job.error = message
        job.lease_until = None
    else:
        job.status = "failed"
        job.error = message
        job.finished_at = _now()
        job.lease_until = None
        await _fail_target(db, job, message)
    await db.commit()


async def requeue(db: AsyncSession, job_id: int) -> None:
    """Repornire planificata (SIGTERM): job-ul revine in coada fara sa consume o incercare."""
    job = await db.get(RadarJob, job_id)
    if job is None:
        return
    job.status = "queued"
    job.attempts = max(0, (job.attempts or 1) - 1)
    job.lease_until = None
    job.started_at = None
    await db.commit()


async def _fail_target(db: AsyncSession, job: RadarJob, message: str) -> None:
    """Rularea/descoperirea nu trebuie sa rămână „in curs" cand job-ul ei a murit."""
    if job.target_id is None:
        return
    from app.models.radar import RadarDiscovery, RadarRun

    model = {"radar_run": RadarRun, "discovery": RadarDiscovery}.get(job.kind)
    if model is None:
        return
    row = await db.get(model, job.target_id)
    if row is None or row.status not in ACTIVE_STATUSES:
        return
    row.status = "error"
    row.error = message
    row.finished_at = _now()
