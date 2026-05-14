from __future__ import annotations
from datetime import datetime, date
from sqlalchemy import Integer, String, Date, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column
from .base import Base


class ReportRun(Base):
    __tablename__ = "report_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    report_type: Mapped[str] = mapped_column(String(40), nullable=False, unique=True)
    last_run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_period_start: Mapped[date | None] = mapped_column(Date, nullable=True)
    last_period_end: Mapped[date | None] = mapped_column(Date, nullable=True)
    last_triggered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="idle")
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
