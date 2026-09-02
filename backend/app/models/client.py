from __future__ import annotations
from datetime import datetime, timezone
from sqlalchemy import Integer, String, Text, Boolean, DateTime, ForeignKey, Index, text
from sqlalchemy.orm import Mapped, mapped_column
from .base import Base


class Client(Base):
    __tablename__ = "clienti"
    __table_args__ = (
        Index("ix_clienti_account_id_is_deleted_id", "account_id", "is_deleted", "id"),
        Index("ix_clienti_account_id_nume_id", "account_id", "nume", "id", postgresql_where=text("is_deleted = false")),
        Index("ix_clienti_nume_trgm", "nume", postgresql_using="gin", postgresql_ops={"nume": "gin_trgm_ops"}),
        Index("ix_clienti_cui_trgm", "cui", postgresql_using="gin", postgresql_ops={"cui": "gin_trgm_ops"}),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    account_id: Mapped[int] = mapped_column(Integer, ForeignKey("accounts.id"), nullable=False)
    tip: Mapped[str] = mapped_column(String(10), nullable=False, default="fizic")  # "fizic" | "juridic"
    nume: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    cui: Mapped[str | None] = mapped_column(String(50), nullable=True)
    reprezentant: Mapped[str | None] = mapped_column(String(200), nullable=True)
    telefon: Mapped[str | None] = mapped_column(String(50), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    adresa: Mapped[str | None] = mapped_column(Text, nullable=True)
    street: Mapped[str | None] = mapped_column(String(255), nullable=True)
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    county_code: Mapped[str | None] = mapped_column(String(5), nullable=True)
    country_code: Mapped[str] = mapped_column(String(2), nullable=False, default="RO")
    postal_code: Mapped[str | None] = mapped_column(String(20), nullable=True)
    numar_masina: Mapped[str | None] = mapped_column(String(50), nullable=True)
    comments: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
