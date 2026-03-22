from __future__ import annotations
from datetime import datetime, timezone
from sqlalchemy import Integer, String, Boolean, DateTime, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column
from .base import Base


REGISTER_TYPES = ("Deviz", "Factura", "Chitanta", "Aviz")


class Register(Base):
    __tablename__ = "registers"
    __table_args__ = (
        Index("ix_registers_account_id_is_deleted_id", "account_id", "is_deleted", "id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    account_id: Mapped[int] = mapped_column(Integer, ForeignKey("accounts.id"), nullable=False)
    type: Mapped[str] = mapped_column(String(50), nullable=False)
    serie: Mapped[str] = mapped_column(String(50), nullable=False)
    numar: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
