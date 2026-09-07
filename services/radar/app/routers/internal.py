"""Endpointuri pentru monolit/AdminV2: consum pe conturi si coada de job-uri.

Mount: /v1/internal — cer doar X-Service-Token.
"""
from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import require_service_token
from app.database import get_db
from app.models.jobs import RadarJob
from app.models.radar import AiUsage, RadarRun
from app.routers.usage import window_start
from app.schemas.jobs import InternalAccountUsageOut, JobOut

router = APIRouter(dependencies=[Depends(require_service_token)])


@router.get("/internal/usage", response_model=list[InternalAccountUsageOut])
async def internal_usage(
    months: int = Query(6, ge=1, le=36),
    db: AsyncSession = Depends(get_db),
):
    """Consum agregat pe cont; numele conturilor le adauga monolitul."""
    start = datetime.combine(window_start(months), datetime.min.time(), tzinfo=timezone.utc)
    rows = (await db.execute(select(AiUsage).where(AiUsage.created_at >= start))).scalars().all()
    runs = dict(
        (
            await db.execute(
                select(RadarRun.account_id, func.count())
                .where(RadarRun.started_at >= start)
                .group_by(RadarRun.account_id)
            )
        ).all()
    )

    agg: dict[int, list] = {}
    for row in rows:
        acc = agg.setdefault(row.account_id, [0, 0, Decimal(0)])
        acc[0] += row.tokens_in or 0
        acc[1] += row.tokens_out or 0
        acc[2] += Decimal(str(row.cost_usd or 0))
    for account_id in runs:
        agg.setdefault(account_id, [0, 0, Decimal(0)])

    out = [
        InternalAccountUsageOut(
            account_id=account_id,
            tokens_in=v[0],
            tokens_out=v[1],
            cost_usd=float(v[2]),
            runs=runs.get(account_id, 0),
        )
        for account_id, v in agg.items()
    ]
    out.sort(key=lambda r: r.cost_usd, reverse=True)
    return out


@router.get("/internal/jobs", response_model=list[JobOut])
async def internal_jobs(
    status: str | None = Query(None),
    kind: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    query = select(RadarJob).order_by(RadarJob.id.desc()).limit(limit)
    if status:
        query = query.where(RadarJob.status == status)
    if kind:
        query = query.where(RadarJob.kind == kind)
    rows = (await db.execute(query)).scalars().all()
    return [
        JobOut(
            id=j.id,
            kind=j.kind,
            account_id=j.account_id,
            target_id=j.target_id,
            idempotency_key=j.idempotency_key,
            status=j.status,
            attempts=j.attempts or 0,
            max_attempts=j.max_attempts or 1,
            error=j.error,
            created_at=j.created_at,
            started_at=j.started_at,
            finished_at=j.finished_at,
        )
        for j in rows
    ]
