from __future__ import annotations
from datetime import datetime, date
from decimal import Decimal
from sqlalchemy import Integer, Date, DateTime, Numeric, Boolean, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column
from .base import Base


class ReportClientsDaily(Base):
    __tablename__ = "report_clients_daily"
    __table_args__ = (
        Index("ix_report_clients_daily_account_date", "account_id", "report_date"),
        Index("ix_report_clients_daily_client_date", "client_id", "report_date"),
        Index("ix_report_clients_daily_location_date", "location_id", "report_date"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    report_date: Mapped[date] = mapped_column(Date, nullable=False)
    account_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False
    )
    location_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("locations.id", ondelete="SET NULL"), nullable=True
    )
    client_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("clienti.id", ondelete="SET NULL"), nullable=True
    )

    sum_paid: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=Decimal("0"))
    sum_total: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=Decimal("0"))
    count_receipts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_first_visit: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
