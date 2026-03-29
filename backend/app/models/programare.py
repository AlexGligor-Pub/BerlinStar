from __future__ import annotations
import enum
from datetime import datetime, timezone
from sqlalchemy import Boolean, DateTime, Enum as SAEnum, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base


class ProgramareStatus(str, enum.Enum):
    PROGRAMAT = "Programat"
    IN_LUCRU  = "In lucru"
    EXECUTAT  = "Executat"
    ANULAT    = "Anulat"


class Programare(Base):
    __tablename__ = "programari"
    __table_args__ = (
        Index("ix_programari_account_id_start_time", "account_id", "start_time"),
        Index("ix_programari_location_id", "location_id"),
    )

    id:           Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    account_id:   Mapped[int] = mapped_column(Integer, ForeignKey("accounts.id"), nullable=False)
    titlu:        Mapped[str] = mapped_column(String(200), nullable=False)
    notite:       Mapped[str | None] = mapped_column(Text, nullable=True)
    client_id:    Mapped[int | None] = mapped_column(Integer, ForeignKey("clienti.id", ondelete="SET NULL"), nullable=True)
    location_id:  Mapped[int] = mapped_column(Integer, ForeignKey("locations.id"), nullable=False)
    department_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("departments.id", ondelete="SET NULL"), nullable=True)
    start_time:   Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_time:     Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status:       Mapped[ProgramareStatus] = mapped_column(
        SAEnum(ProgramareStatus, name="programare_status", create_type=False),
        nullable=False,
        default=ProgramareStatus.PROGRAMAT,
    )
    created_at:  Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    updated_at:  Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_deleted:  Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    deleted_at:  Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    client:     Mapped["Client | None"] = relationship("Client", foreign_keys=[client_id])
    location:   Mapped["Location"] = relationship("Location", foreign_keys=[location_id])
    department: Mapped["Department | None"] = relationship("Department", foreign_keys=[department_id])


from app.models.client import Client          # noqa: E402
from app.models.location import Location      # noqa: E402
from app.models.department import Department  # noqa: E402
