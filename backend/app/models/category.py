from __future__ import annotations
from datetime import datetime, timezone
from sqlalchemy import Integer, String, Boolean, DateTime, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base


class Category(Base):
    __tablename__ = "categories"
    __table_args__ = (
        Index("ix_categories_theme_id_is_deleted_id", "theme_id", "is_deleted", "id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    account_id: Mapped[int] = mapped_column(Integer, ForeignKey("accounts.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    image_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    theme_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("themes.id", ondelete="CASCADE"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    theme: Mapped[Theme] = relationship("Theme", back_populates="categories")
    items: Mapped[list[Item]] = relationship(
        "Item", back_populates="category", lazy="select"
    )
