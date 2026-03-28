from __future__ import annotations
from datetime import datetime, date, timezone
from sqlalchemy import Integer, Text, Boolean, DateTime, Date, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base


class CazareAnvelope(Base):
    __tablename__ = "cazari_anvelope"
    __table_args__ = (
        Index("ix_cazari_anvelope_account_id_is_deleted_id", "account_id", "is_deleted", "id"),
        Index("ix_cazari_anvelope_account_id_data_checkin", "account_id", "data_checkin"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    account_id: Mapped[int] = mapped_column(Integer, ForeignKey("accounts.id"), nullable=False)
    client_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("clienti.id", ondelete="SET NULL"), nullable=True
    )
    employee_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("employees.id", ondelete="SET NULL"), nullable=True
    )
    loc_cazare_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("locuri_cazare.id", ondelete="SET NULL"), nullable=True
    )
    data_checkin: Mapped[date] = mapped_column(Date, nullable=False)
    data_checkout: Mapped[date | None] = mapped_column(Date, nullable=True)
    comments: Mapped[str | None] = mapped_column(Text, nullable=True)
    dep_anvelope: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    dep_capace: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    dep_roti_complete: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    dep_antifurturi: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    dep_prezoane: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    items: Mapped[list["CazareAnvelopaItem"]] = relationship(
        "CazareAnvelopaItem", back_populates="cazare", cascade="all, delete-orphan", lazy="selectin"
    )
    client: Mapped["Client | None"] = relationship("Client")  # type: ignore[name-defined]
    employee: Mapped["Employee | None"] = relationship("Employee")  # type: ignore[name-defined]
    loc_cazare: Mapped["LocCazare | None"] = relationship("LocCazare")  # type: ignore[name-defined]


class CazareAnvelopaItem(Base):
    __tablename__ = "cazare_anvelope_items"
    __table_args__ = (
        Index("ix_cazare_anvelope_items_cazare_id", "cazare_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    account_id: Mapped[int] = mapped_column(Integer, ForeignKey("accounts.id"), nullable=False)
    cazare_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("cazari_anvelope.id", ondelete="CASCADE"), nullable=False
    )
    anvelopa_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("anvelope.id", ondelete="SET NULL"), nullable=True
    )

    cazare: Mapped["CazareAnvelope"] = relationship("CazareAnvelope", back_populates="items")
    anvelopa: Mapped["Anvelopa | None"] = relationship("Anvelopa")  # type: ignore[name-defined]
