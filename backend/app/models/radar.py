from __future__ import annotations
from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    JSON,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base

_JSON = JSON().with_variant(JSONB, "postgresql")


def _now() -> datetime:
    return datetime.now(timezone.utc)


class RadarSource(Base):
    """O sursa urmarita de Radar AI (canal YouTube, CUI, site, business Google)."""

    __tablename__ = "radar_sources"
    __table_args__ = (Index("ix_radar_sources_account_kind", "account_id", "kind"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    account_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False
    )
    kind: Mapped[str] = mapped_column(String(20), nullable=False)
    label: Mapped[str] = mapped_column(String(200), nullable=False, server_default="")
    value: Mapped[str] = mapped_column(String(500), nullable=False)
    meta: Mapped[dict | None] = mapped_column(_JSON, nullable=True)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="1")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_now
    )
    last_collected_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)


class RadarSettings(Base):
    """Configurarea Radar a unui cont: focus, context de business, frecventa."""

    __tablename__ = "radar_settings"

    account_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("accounts.id", ondelete="CASCADE"), primary_key=True
    )
    focus_prompt: Mapped[str] = mapped_column(Text, nullable=False, server_default="")
    business_context: Mapped[str] = mapped_column(Text, nullable=False, server_default="")
    schedule: Mapped[str] = mapped_column(String(10), nullable=False, server_default="off")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_now
    )


class RadarSnapshot(Base):
    """Un element colectat dintr-o sursa, plus analiza AI (digest) a lui.

    UNIQUE (source_id, external_id): acelasi element nu se re-analizeaza si nu
    se re-factureaza niciodata.
    """

    __tablename__ = "radar_snapshots"
    __table_args__ = (
        UniqueConstraint("source_id", "external_id", name="uq_radar_snapshot_source_external"),
        Index("ix_radar_snapshots_account", "account_id"),
        Index("ix_radar_snapshots_run", "run_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    account_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False
    )
    source_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("radar_sources.id", ondelete="CASCADE"), nullable=False
    )
    run_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("radar_runs.id", ondelete="SET NULL"), nullable=True
    )
    kind: Mapped[str] = mapped_column(String(20), nullable=False)
    external_id: Mapped[str] = mapped_column(String(300), nullable=False)
    collected_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_now
    )
    payload: Mapped[dict | None] = mapped_column(_JSON, nullable=True)
    digest: Mapped[dict | None] = mapped_column(_JSON, nullable=True)


class RadarRun(Base):
    """O rulare Radar: colectare + digest-uri + sinteza, cu raportul rezultat."""

    __tablename__ = "radar_runs"
    __table_args__ = (Index("ix_radar_runs_account_status", "account_id", "status"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    account_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False
    )
    status: Mapped[str] = mapped_column(String(10), nullable=False, server_default="queued")
    trigger: Mapped[str] = mapped_column(String(10), nullable=False, server_default="manual")
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_now
    )
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    progress: Mapped[dict | None] = mapped_column(_JSON, nullable=True)
    tokens_in: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    tokens_out: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    cost_usd: Mapped[Decimal] = mapped_column(Numeric(12, 6), nullable=False, server_default="0")
    title: Mapped[str | None] = mapped_column(String(300), nullable=True)
    period_from: Mapped[date | None] = mapped_column(Date, nullable=True)
    period_to: Mapped[date | None] = mapped_column(Date, nullable=True)
    report: Mapped[dict | None] = mapped_column(_JSON, nullable=True)


class AiUsage(Base):
    """Consum de tokeni per cont, pentru facturare si rapoarte de platforma."""

    __tablename__ = "ai_usage"
    __table_args__ = (Index("ix_ai_usage_account_created", "account_id", "created_at"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    account_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_now
    )
    feature: Mapped[str] = mapped_column(String(50), nullable=False)
    model: Mapped[str] = mapped_column(String(80), nullable=False)
    tokens_in: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    tokens_out: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    cost_usd: Mapped[Decimal] = mapped_column(Numeric(12, 6), nullable=False, server_default="0")
    run_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("radar_runs.id", ondelete="SET NULL"), nullable=True
    )
    meta: Mapped[dict | None] = mapped_column(_JSON, nullable=True)


class RadarDiscovery(Base):
    """O sesiune de descoperire de concurenti pentru o firma a contului."""

    __tablename__ = "radar_discoveries"
    __table_args__ = (
        Index("ix_radar_discoveries_account_created", "account_id", "created_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    account_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False
    )
    company_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False
    )
    status: Mapped[str] = mapped_column(String(10), nullable=False, server_default="queued")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_now
    )
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    progress: Mapped[dict | None] = mapped_column(_JSON, nullable=True)
    answers: Mapped[dict | None] = mapped_column(_JSON, nullable=True)
    profile: Mapped[dict | None] = mapped_column(_JSON, nullable=True)
    result: Mapped[dict | None] = mapped_column(_JSON, nullable=True)
    tokens_in: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    tokens_out: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    cost_usd: Mapped[Decimal] = mapped_column(Numeric(12, 6), nullable=False, server_default="0")
