from __future__ import annotations
from datetime import datetime, date
from decimal import Decimal
from sqlalchemy import Integer, String, Date, DateTime, Numeric, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column
from .base import Base


class ReportReceiptsBreakdownDaily(Base):
    __tablename__ = "report_receipts_breakdown_daily"
    __table_args__ = (
        Index("ix_report_receipts_breakdown_daily_account_date", "account_id", "report_date"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    report_date: Mapped[date] = mapped_column(Date, nullable=False)
    account_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False
    )
    location_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("locations.id", ondelete="SET NULL"), nullable=True
    )
    dimension_type: Mapped[str] = mapped_column(String(20), nullable=False)  # item_type | category | department
    dimension_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    dimension_value: Mapped[str | None] = mapped_column(String(50), nullable=True)
    sum_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=Decimal("0"))
    count_items: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
