"""Consumul de tokeni al contului.

Mount: /v1/usage
"""
from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import require_account
from app.database import get_db
from app.models.radar import AiUsage
from app.schemas.radar import UsageBucket, UsageFeatureBucket, UsageOut

router = APIRouter()


def _month_key(dt: datetime) -> str:
    return f"{dt.year:04d}-{dt.month:02d}"


def window_start(months: int, today: date | None = None) -> date:
    """Prima zi a lunii de la care se numara consumul (fereastra inclusiva)."""
    today = today or date.today()
    total = today.year * 12 + (today.month - 1) - (months - 1)
    return date(total // 12, total % 12 + 1, 1)


def aggregate_usage(rows: list[AiUsage], months: int, today: date | None = None) -> UsageOut:
    """Agregare in Python: `strftime` pe SQL ar fi doar-SQLite, `date_trunc` doar-Postgres."""
    by_month: dict[str, list[int | Decimal]] = {}
    by_feature: dict[str, list[int | Decimal]] = {}
    total_in = total_out = 0
    total_cost = Decimal(0)
    for row in rows:
        cost = Decimal(str(row.cost_usd or 0))
        tin, tout = row.tokens_in or 0, row.tokens_out or 0
        total_in += tin
        total_out += tout
        total_cost += cost
        for bucket, key in ((by_month, _month_key(row.created_at)), (by_feature, row.feature)):
            acc = bucket.setdefault(key, [0, 0, Decimal(0)])
            acc[0] += tin
            acc[1] += tout
            acc[2] += cost

    start = window_start(months, today)
    labels: list[str] = []
    year, month = start.year, start.month
    for _ in range(months):
        labels.append(f"{year:04d}-{month:02d}")
        year, month = (year + 1, 1) if month == 12 else (year, month + 1)

    return UsageOut(
        total_in=total_in,
        total_out=total_out,
        total_cost_usd=float(total_cost),
        by_month=[
            UsageBucket(
                month=m,
                tokens_in=by_month.get(m, [0, 0, Decimal(0)])[0],
                tokens_out=by_month.get(m, [0, 0, Decimal(0)])[1],
                cost_usd=float(by_month.get(m, [0, 0, Decimal(0)])[2]),
            )
            for m in labels
        ],
        by_feature=[
            UsageFeatureBucket(feature=f, tokens_in=v[0], tokens_out=v[1], cost_usd=float(v[2]))
            for f, v in sorted(by_feature.items())
        ],
    )


@router.get("/usage", response_model=UsageOut)
async def get_usage(
    months: int = Query(6, ge=1, le=36),
    account_id: int = Depends(require_account),
    db: AsyncSession = Depends(get_db),
):
    start = datetime.combine(window_start(months), datetime.min.time(), tzinfo=timezone.utc)
    rows = (
        await db.execute(
            select(AiUsage).where(AiUsage.account_id == account_id, AiUsage.created_at >= start)
        )
    ).scalars().all()
    return aggregate_usage(list(rows), months)
