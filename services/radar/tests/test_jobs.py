"""Coada de job-uri: idempotenta, unicitate pe job activ, lease-uri expirate,
plus garda de buget si reluarea digest-urilor din engine.

Rulabil direct: python -m tests.test_jobs
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import func, select

from app.database import IS_POSTGRES
from app.jobs import queue
from app.models.jobs import RadarJob
from app.models.radar import AiUsage, RadarRun, RadarSnapshot, RadarSource
from app.radar.engine import BUDGET_MESSAGE, run_radar
from tests._harness import make_session, run
from tests.test_radar_engine import CONTEXT, FakeAI, Patch, _fixture, _web_collector, _yt_collector

ACCOUNT_ID = 6


def _past() -> datetime:
    return datetime.now(timezone.utc) - timedelta(seconds=queue.LEASE_SECONDS + 60)


async def _count(db, model) -> int:
    return (await db.execute(select(func.count()).select_from(model))).scalar_one()


async def test_enqueue_is_idempotent():
    db = await make_session()
    job, created = await queue.enqueue(
        db, kind="radar_run", account_id=ACCOUNT_ID, idempotency_key="radar:6:2026-09-07",
        target_id=11, payload={"context": {}},
    )
    assert created is True and job.status == "queued" and job.max_attempts == 2

    same, created_again = await queue.enqueue(
        db, kind="radar_run", account_id=ACCOUNT_ID, idempotency_key="radar:6:2026-09-07",
        target_id=11,
    )
    assert created_again is False and same.id == job.id
    assert await _count(db, RadarJob) == 1


async def test_active_job_unique_guard():
    db = await make_session()
    await queue.enqueue(db, kind="discovery", account_id=ACCOUNT_ID,
                        idempotency_key="discovery:6:1", target_id=1)
    try:
        await queue.enqueue(db, kind="discovery", account_id=ACCOUNT_ID,
                            idempotency_key="discovery:6:2", target_id=2)
    except queue.ActiveJobExists as exc:
        assert "descoperire in curs" in str(exc)
        assert await _count(db, RadarJob) == 1
        return
    if IS_POSTGRES:
        raise AssertionError("indexul unic partial nu a blocat al doilea job activ")
    print("  (sarit — SQLite-ul acestei versiuni nu aplica indexul unic partial)")


async def test_stale_lease_requeues_then_fails():
    db = await make_session()
    run_row = RadarRun(account_id=ACCOUNT_ID, status="running", trigger="manual")
    db.add(run_row)
    await db.flush()
    job, _ = await queue.enqueue(db, kind="radar_run", account_id=ACCOUNT_ID,
                                 idempotency_key="radar:6:stale", target_id=run_row.id)

    claimed = await queue.claim(db)
    assert claimed is not None and claimed.id == job.id and claimed.attempts == 1
    claimed.lease_until = _past()
    await db.commit()

    assert await queue.recover_stale(db) == (1, 0)
    await db.refresh(job)
    assert job.status == "queued" and job.lease_until is None

    claimed = await queue.claim(db)
    assert claimed is not None and claimed.attempts == 2
    claimed.lease_until = _past()
    await db.commit()

    assert await queue.recover_stale(db) == (0, 1)
    await db.refresh(job)
    await db.refresh(run_row)
    assert job.status == "failed" and job.error == queue.RESTART_MESSAGE
    assert run_row.status == "error" and run_row.error == queue.RESTART_MESSAGE
    assert run_row.finished_at is not None


async def test_requeue_does_not_consume_attempt():
    db = await make_session()
    job, _ = await queue.enqueue(db, kind="radar_run", account_id=ACCOUNT_ID,
                                 idempotency_key="radar:6:sigterm", target_id=None)
    await queue.claim(db)
    await queue.requeue(db, job.id)
    await db.refresh(job)
    assert (job.status, job.attempts, job.started_at) == ("queued", 0, None)


async def test_budget_guard_stops_before_ai_calls():
    db = await make_session()
    _account_id, radar_run = await _fixture(db)
    radar_run.cost_usd = Decimal("5.000000")
    await db.commit()

    ai = FakeAI()
    with Patch(db, ai, {"youtube": _yt_collector(), "website": _web_collector()}):
        await run_radar(radar_run.id, {"context": CONTEXT})

    await db.refresh(radar_run)
    assert radar_run.status == "done", radar_run.error
    assert radar_run.progress["partial"] is True
    assert any(BUDGET_MESSAGE in line for line in radar_run.progress["log"])
    assert radar_run.report is None
    assert ai.calls == [], "AI-ul nu trebuie apelat peste buget"
    assert await _count(db, RadarSnapshot) == 0
    assert await _count(db, AiUsage) == 0


async def test_retry_redigests_snapshots_without_digest():
    db = await make_session()
    account_id, radar_run = await _fixture(db, kinds=("youtube",))
    source = (await db.execute(select(RadarSource))).scalars().one()
    snapshot = RadarSnapshot(
        account_id=account_id, source_id=source.id, run_id=radar_run.id, kind="youtube",
        external_id="v1", payload={"video_id": "v1", "title": "Video v1"}, digest=None,
    )
    db.add(snapshot)
    await db.commit()

    ai = FakeAI()
    with Patch(db, ai, {"youtube": _yt_collector()}):
        await run_radar(radar_run.id, {"context": CONTEXT})

    await db.refresh(snapshot)
    await db.refresh(radar_run)
    assert radar_run.status == "done", radar_run.error
    assert snapshot.digest and snapshot.digest["video_title"] == "Montaj lift nou"
    assert await _count(db, RadarSnapshot) == 1, "reluarea nu trebuie sa recolecteze"
    redigest = (await db.execute(
        select(AiUsage).where(AiUsage.feature == "radar.digest")
    )).scalars().all()
    assert len(redigest) == 1 and redigest[0].meta.get("redigest") is True


def main() -> None:
    run(test_enqueue_is_idempotent())
    run(test_active_job_unique_guard())
    run(test_stale_lease_requeues_then_fails())
    run(test_requeue_does_not_consume_attempt())
    run(test_budget_guard_stops_before_ai_calls())
    run(test_retry_redigests_snapshots_without_digest())
    print("OK test_jobs")


if __name__ == "__main__":
    main()
