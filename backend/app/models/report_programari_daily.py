from __future__ import annotations
from datetime import datetime, date
from sqlalchemy import Integer, Date, DateTime, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column
from .base import Base


class ReportProgramariDaily(Base):
    __tablename__ = "report_programari_daily"
    __table_args__ = (
        Index("ix_report_programari_daily_account_date", "account_id", "report_date"),
        Index("ix_report_programari_daily_location_date", "location_id", "report_date"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    report_date: Mapped[date] = mapped_column(Date, nullable=False)
    account_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False
    )
    location_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("locations.id", ondelete="SET NULL"), nullable=True
    )
    hour_slot: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    count_total: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    count_programat: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    count_in_lucru: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    count_executat: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    count_anulat: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    count_with_receipt: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    sum_lead_time_days: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
