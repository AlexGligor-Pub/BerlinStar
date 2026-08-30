from __future__ import annotations
from datetime import datetime, timezone
from sqlalchemy import Integer, String, Text, Boolean, DateTime, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base


class Vehicol(Base):
    __tablename__ = "vehicole"
    __table_args__ = (
        Index("ix_vehicole_account_id", "account_id"),
        Index("ix_vehicole_client_vehicol_id", "client_vehicol_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    account_id: Mapped[int] = mapped_column(Integer, ForeignKey("accounts.id"), nullable=False)
    receipt_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("receipts.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    # Masina din garajul clientului pe care o reprezinta acest snapshot.
    # Legatura e explicita tocmai ca sa supravietuiasca editarii numarului de
    # inmatriculare: cat timp potrivirea se facea pe text, o corectura de tipar
    # crea o masina noua in loc sa o actualizeze pe cea existenta (migrarea veh02).
    # Ramane NULL cat bonul nu are client.
    client_vehicol_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("client_vehicole.id", ondelete="SET NULL"), nullable=True
    )
    numar_masina: Mapped[str] = mapped_column(String(50), nullable=False)
    marca: Mapped[str | None] = mapped_column(String(100), nullable=True)
    model: Mapped[str | None] = mapped_column(String(100), nullable=True)
    numar_kilometrii: Mapped[int | None] = mapped_column(Integer, nullable=True)
    an_fabricatie: Mapped[int | None] = mapped_column(Integer, nullable=True)
    vin: Mapped[str | None] = mapped_column(String(17), nullable=True)
    observatii: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    receipt: Mapped["Receipt"] = relationship("Receipt", back_populates="vehicol")


from app.models.receipt import Receipt  # noqa: E402
