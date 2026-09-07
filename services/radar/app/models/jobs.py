"""Coada de job-uri a serviciului Radar (Postgres, FOR UPDATE SKIP LOCKED)."""
from __future__ import annotations
from datetime import datetime, timezone

from sqlalchemy import DateTime, Index, Integer, JSON, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base
from .radar import SCHEMA

# Why: `none_as_null` face din valoarea lipsa un NULL de SQL, nu un `null` JSON,
# ca interogarile de tip „digest IS NULL" (reluarea unei rulari) sa functioneze.
_JSON = JSON(none_as_null=True).with_variant(JSONB(none_as_null=True), "postgresql")

KINDS = ("radar_run", "discovery", "discovery_prepare")
ACTIVE_STATUSES = ("queued", "running")
_ACTIVE_SQL = "status IN ('queued', 'running')"


def _now() -> datetime:
    return datetime.now(timezone.utc)


class RadarJob(Base):
    """Un job asincron. Indexul unic partial inchide cursa a doua POST-uri simultane."""

    __tablename__ = "radar_jobs"
    __table_args__ = (
        Index("ix_radar_jobs_status_id", "status", "id"),
        Index("ix_radar_jobs_account_kind", "account_id", "kind"),
        Index(
            "uq_radar_jobs_active",
            "account_id",
            "kind",
            unique=True,
            postgresql_where=text(_ACTIVE_SQL),
            sqlite_where=text(_ACTIVE_SQL),
        ),
        {"schema": SCHEMA},
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    kind: Mapped[str] = mapped_column(String(30), nullable=False)
    account_id: Mapped[int] = mapped_column(Integer, nullable=False)
    target_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    idempotency_key: Mapped[str] = mapped_column(String(200), nullable=False, unique=True)
    status: Mapped[str] = mapped_column(String(10), nullable=False, server_default="queued")
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    max_attempts: Mapped[int] = mapped_column(Integer, nullable=False, server_default="1")
    payload: Mapped[dict | None] = mapped_column(_JSON, nullable=True)
    result: Mapped[dict | None] = mapped_column(_JSON, nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    lease_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    scheduled_for: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_now
    )
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class WorkerHeartbeat(Base):
    """Un singur rand (id=1) pe care worker-ul il atinge periodic, pentru /ready."""

    __tablename__ = "radar_worker_heartbeat"
    __table_args__ = ({"schema": SCHEMA},)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    heartbeat_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_now
    )
