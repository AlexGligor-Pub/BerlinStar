from __future__ import annotations
from datetime import datetime, date
from decimal import Decimal
from sqlalchemy import Integer, String, Date, DateTime, Numeric, ForeignKey, Index, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column
from .base import Base
from .stock_movement import StockMovementType


class ReportStockMovementsDaily(Base):
    __tablename__ = "report_stock_movements_daily"
    __table_args__ = (
        Index("ix_report_stock_mov_daily_account_date", "account_id", "report_date"),
        Index("ix_report_stock_mov_daily_account_loc_date", "account_id", "location_id", "report_date"),
        Index("ix_report_stock_mov_daily_item_date", "item_id", "report_date"),
        Index("ix_report_stock_mov_daily_emp_date", "employee_id", "report_date"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    report_date: Mapped[date] = mapped_column(Date, nullable=False)
    account_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False
    )
    location_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("locations.id", ondelete="SET NULL"), nullable=True
    )
    item_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("items.id", ondelete="SET NULL"), nullable=True
    )
    item_name: Mapped[str] = mapped_column(String(200), nullable=False)
    employee_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("employees.id", ondelete="SET NULL"), nullable=True
    )
    movement_type: Mapped[StockMovementType] = mapped_column(
        SAEnum(StockMovementType, name="stock_movement_type", create_type=False),
        nullable=False,
    )
    qty_total: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    qty_delta_total: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    valoare_vanzare: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=Decimal("0"))
    valoare_cost: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=Decimal("0"))
    nr_movements: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
