"""Schemele proprii serviciului: job-uri si consum agregat pentru AdminV2."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel

from .radar import PrepareOut


class JobOut(BaseModel):
    id: int
    kind: str
    account_id: int
    target_id: int | None
    idempotency_key: str
    status: str
    attempts: int
    max_attempts: int
    error: str | None
    created_at: datetime
    started_at: datetime | None
    finished_at: datetime | None


class PrepareJobOut(BaseModel):
    job_id: int
    status: str


class PrepareStatusOut(BaseModel):
    job_id: int
    status: str
    error: str | None = None
    result: PrepareOut | None = None


class InternalAccountUsageOut(BaseModel):
    account_id: int
    tokens_in: int
    tokens_out: int
    cost_usd: float
    runs: int
