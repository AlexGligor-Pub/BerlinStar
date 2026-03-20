from __future__ import annotations
from datetime import datetime, timezone
from decimal import Decimal
from sqlalchemy import Integer, String, Text, Boolean, DateTime, Numeric, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base


class Employee(Base):
    __tablename__ = "employees"
    __table_args__ = (
        Index("ix_employees_account_id_is_deleted_id", "account_id", "is_deleted", "id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    account_id: Mapped[int] = mapped_column(Integer, ForeignKey("accounts.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    image_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    target: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False, default=Decimal("25000.00")
    )
    current_target_accumulation: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False, default=Decimal("0.00")
    )

    locations: Mapped[list[Location]] = relationship(
        "Location", secondary="employee_locations", back_populates="employees"
    )

    receipt_items: Mapped[list[ReceiptItem]] = relationship(
        "ReceiptItem", back_populates="employee"
    )


from .location import Location  # noqa: E402
from app.models.receipt import ReceiptItem  # noqa: E402
