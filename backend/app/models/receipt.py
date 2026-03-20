from __future__ import annotations
import enum
from datetime import datetime, timezone
from decimal import Decimal
from sqlalchemy import Integer, String, Text, Boolean, DateTime, Numeric, ForeignKey, Index, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base


class PayMethod(str, enum.Enum):
    NEPLATIT = "Neplatit"
    CARD = "Platit cu cardul"
    CASH = "Platit cash"
    OP = "Platit prin OP"
    PARTIAL = "Platit Partial"


class Receipt(Base):
    __tablename__ = "receipts"
    __table_args__ = (
        Index("ix_receipts_account_id_is_deleted_id", "account_id", "is_deleted", "id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    account_id: Mapped[int] = mapped_column(Integer, ForeignKey("accounts.id"), nullable=False)
    casier: Mapped[str] = mapped_column(String(200), nullable=False)
    titlu: Mapped[str] = mapped_column(String(200), nullable=False)
    descriere: Mapped[str | None] = mapped_column(Text, nullable=True)
    date_tehn: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    total: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    pay_method: Mapped[PayMethod] = mapped_column(
        SAEnum(PayMethod, name="pay_method"), nullable=False, default=PayMethod.NEPLATIT
    )
    partial_pay: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    receipt_items: Mapped[list[ReceiptItem]] = relationship(
        "ReceiptItem", back_populates="receipt", cascade="all, delete-orphan", lazy="selectin"
    )


class ReceiptItem(Base):
    __tablename__ = "receipt_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    receipt_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("receipts.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    qty: Mapped[int] = mapped_column(Integer, nullable=False)
    unit: Mapped[str] = mapped_column(String(50), nullable=False)

    receipt: Mapped[Receipt] = relationship("Receipt", back_populates="receipt_items")
