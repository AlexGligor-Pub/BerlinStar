"""Programari online: configurarea per locatie, programul, serviciile si cheile
API cu care site-ul public al unui garaj vorbeste cu Berlin Star.

Programarile in sine raman randuri in `programari` (vezi `source` acolo) —
Berlin Star e singura sursa de adevar pentru calendar.
"""
from __future__ import annotations
from datetime import datetime, time, timezone
from sqlalchemy import (
    Boolean, DateTime, ForeignKey, Integer, SmallInteger, String, Time, UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base

# Numele afisat pe site-ul public cand garajul nu si-a configurat altul.
DEFAULT_SITE_NAME = "Vulcanizare Alex"


class BookingSettings(Base):
    __tablename__ = "booking_settings"
    __table_args__ = (UniqueConstraint("account_id", "location_id"),)

    id:          Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    account_id:  Mapped[int] = mapped_column(Integer, ForeignKey("accounts.id"), nullable=False)
    location_id: Mapped[int] = mapped_column(Integer, ForeignKey("locations.id", ondelete="CASCADE"), nullable=False)
    enabled:     Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    site_name:   Mapped[str] = mapped_column(String(120), nullable=False, default=DEFAULT_SITE_NAME)
    # Identificatorul public al garajului, in adresa serverului MCP
    # (/mcp/<public_slug>). Nu folosim codul contului: acela e parte din login.
    public_slug: Mapped[str | None] = mapped_column(String(60), nullable=True, unique=True)
    # Divizia in care intra programarile online (optional).
    department_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("departments.id", ondelete="SET NULL"), nullable=True
    )
    slot_minutes:  Mapped[int] = mapped_column(Integer, nullable=False, default=60)
    # Cate programari simultane accepta locatia (ex. numarul de elevatoare).
    capacity:      Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    # Cu cat timp inainte se mai poate rezerva un slot.
    lead_minutes:  Mapped[int] = mapped_column(Integer, nullable=False, default=120)
    horizon_days:  Mapped[int] = mapped_column(Integer, nullable=False, default=30)
    cancel_cutoff_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=120)
    closed_on_holidays:    Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    hours: Mapped[list[BookingHours]] = relationship(
        "BookingHours", cascade="all, delete-orphan", lazy="selectin",
        order_by="(BookingHours.weekday, BookingHours.open_time)",
    )


class BookingHours(Base):
    """Un interval de lucru intr-o zi a saptamanii. Mai multe intervale in
    aceeasi zi = pauza (ex. 08–12 si 13–17)."""
    __tablename__ = "booking_hours"

    id:         Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    booking_settings_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("booking_settings.id", ondelete="CASCADE"), nullable=False, index=True
    )
    weekday:    Mapped[int] = mapped_column(SmallInteger, nullable=False)  # 0 = luni … 6 = duminica
    open_time:  Mapped[time] = mapped_column(Time, nullable=False)
    close_time: Mapped[time] = mapped_column(Time, nullable=False)


class BookingService(Base):
    """Un tip de lucrare care se poate programa online, cu durata lui."""
    __tablename__ = "booking_services"

    id:          Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    booking_settings_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("booking_settings.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name:        Mapped[str] = mapped_column(String(120), nullable=False)
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    sort_order:  Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    active:      Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class PublicApiKey(Base):
    """Cheia cu care o instalare a site-ului public citeste si scrie calendarul
    unei locatii. Pastram doar hash-ul; cheia se arata o singura data."""
    __tablename__ = "public_api_keys"

    id:          Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    account_id:  Mapped[int] = mapped_column(Integer, ForeignKey("accounts.id"), nullable=False, index=True)
    location_id: Mapped[int] = mapped_column(Integer, ForeignKey("locations.id", ondelete="CASCADE"), nullable=False)
    name:        Mapped[str] = mapped_column(String(120), nullable=False)
    prefix:      Mapped[str] = mapped_column(String(16), nullable=False)
    key_hash:    Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    created_at:  Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked_at:   Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
