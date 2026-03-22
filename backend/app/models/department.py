from __future__ import annotations
from datetime import datetime, timezone
from sqlalchemy import Integer, String, Text, Boolean, DateTime, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base


class Department(Base):
    __tablename__ = "departments"
    __table_args__ = (
        Index("ix_departments_account_id_is_deleted_id", "account_id", "is_deleted", "id"),
        Index("ix_departments_is_deleted_id", "is_deleted", "id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    account_id: Mapped[int] = mapped_column(Integer, ForeignKey("accounts.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    image_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    categories: Mapped[list[Category]] = relationship(
        "Category", back_populates="department", lazy="select"
    )
    locations: Mapped[list[Location]] = relationship(
        "Location", secondary="location_departments", back_populates="departments"
    )


from .location import Location  # noqa: E402
