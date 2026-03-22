from __future__ import annotations
from datetime import datetime, timezone
import sqlalchemy as sa
from sqlalchemy import BigInteger, Boolean, DateTime, Integer, String, Text, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column
from .base import Base


class Company(Base):
    __tablename__ = "companies"
    __table_args__ = (
        Index("ix_companies_account_id_is_deleted_id", "account_id", "is_deleted", "id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    account_id: Mapped[int] = mapped_column(Integer, ForeignKey("accounts.id"), nullable=False)

    cui: Mapped[int] = mapped_column(BigInteger, nullable=False)
    name: Mapped[str] = mapped_column(String(300), nullable=False)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    nr_reg_com: Mapped[str | None] = mapped_column(String(50), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    postal_code: Mapped[str | None] = mapped_column(String(20), nullable=True)
    is_vat_payer: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    tva_percentage: Mapped[float | None] = mapped_column(sa.Float, nullable=True)
    registration_status: Mapped[str | None] = mapped_column(String(200), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    comments: Mapped[str | None] = mapped_column(Text, nullable=True)
    logo_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    background_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    website: Mapped[str | None] = mapped_column(String(500), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
