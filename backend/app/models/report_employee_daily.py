from __future__ import annotations
from datetime import datetime, date
from decimal import Decimal
from sqlalchemy import Integer, String, Date, DateTime, Numeric, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column
from .base import Base


class ReportEmployeeDaily(Base):
    __tablename__ = "report_employee_daily"
    __table_args__ = (
        Index("ix_report_employee_daily_account_date", "account_id", "report_date"),
        Index("ix_report_employee_daily_employee_date", "employee_id", "report_date"),
        Index("ix_report_employee_daily_employee_location", "employee_id", "location_id"),
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
    item_type: Mapped[str | None] = mapped_column(String(20), nullable=True)  # PRODUS | SERVICE
    category_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("categories.id", ondelete="SET NULL"), nullable=True
    )
    category_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    department_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("departments.id", ondelete="SET NULL"), nullable=True
    )
    department_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    sum_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=Decimal("0"))
    count_items: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
