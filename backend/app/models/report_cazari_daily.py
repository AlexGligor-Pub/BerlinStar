from __future__ import annotations
from datetime import datetime, date
from sqlalchemy import Integer, Date, DateTime, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column
from .base import Base


class ReportCazariDaily(Base):
    __tablename__ = "report_cazari_daily"
    __table_args__ = (
        Index("ix_report_cazari_daily_account_date", "account_id", "report_date"),
        Index("ix_report_cazari_daily_employee_date", "employee_id", "report_date"),
        Index("ix_report_cazari_daily_location_date", "location_id", "report_date"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    report_date: Mapped[date] = mapped_column(Date, nullable=False)
    account_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False
    )
    location_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("locations.id", ondelete="SET NULL"), nullable=True
    )
    employee_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("employees.id", ondelete="SET NULL"), nullable=True
    )

    count_checkins: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    count_checkouts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    count_checkouts_montate: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    count_anvelope_in: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    count_anvelope_out: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
