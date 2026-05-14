from __future__ import annotations
from datetime import datetime, date
from decimal import Decimal
from sqlalchemy import Integer, Date, DateTime, Numeric, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column
from .base import Base


class ReportReceiptsDaily(Base):
    __tablename__ = "report_receipts_daily"
    __table_args__ = (
        Index("ix_report_receipts_daily_account_date", "account_id", "report_date"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    report_date: Mapped[date] = mapped_column(Date, nullable=False)
    account_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False
    )
    location_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("locations.id", ondelete="SET NULL"), nullable=True
    )

    count_total: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    count_card: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    count_cash: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    count_op: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    count_partial: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    count_neplatit: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    sum_total: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=Decimal("0"))
    sum_card: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=Decimal("0"))
    sum_cash: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=Decimal("0"))
    sum_op: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=Decimal("0"))
    sum_partial: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=Decimal("0"))
    sum_neplatit: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=Decimal("0"))
    sum_paid: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=Decimal("0"))
    sum_unpaid: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=Decimal("0"))

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
