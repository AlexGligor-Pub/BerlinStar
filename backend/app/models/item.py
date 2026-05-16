from __future__ import annotations
import enum
from datetime import datetime, timezone
from decimal import Decimal
from sqlalchemy import (
    Integer, String, Text, Boolean, DateTime, Numeric,
    ForeignKey, Enum as SAEnum, Index,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base


class ItemType(str, enum.Enum):
    PRODUS = "Produs"
    SERVICE = "Service"


class Item(Base):
    __tablename__ = "items"
    __table_args__ = (
        Index("ix_items_account_id_is_deleted_id", "account_id", "is_deleted", "id"),
        Index("ix_items_category_id_is_deleted_id", "category_id", "is_deleted", "id"),
        Index("ix_items_is_deleted_id", "is_deleted", "id"),
        Index("ix_items_type_is_deleted_id", "type", "is_deleted", "id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    account_id: Mapped[int] = mapped_column(Integer, ForeignKey("accounts.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    cost_price: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    stoc_minim: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="RON")
    unit: Mapped[str] = mapped_column(String(50), nullable=False)
    image_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    type: Mapped[ItemType] = mapped_column(
        SAEnum(ItemType, name="item_type"), nullable=False, default=ItemType.PRODUS
    )
    category_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("categories.id", ondelete="CASCADE"), nullable=False
    )

    category: Mapped[Category] = relationship("Category", back_populates="items")
