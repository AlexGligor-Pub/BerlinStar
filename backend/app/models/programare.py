from __future__ import annotations
import enum
from datetime import datetime, timezone
from sqlalchemy import (
    Boolean, DateTime, Enum as SAEnum, ForeignKey, Index, Integer, SmallInteger, String, Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base


class ProgramareStatus(str, enum.Enum):
    PROGRAMAT = "Programat"
    IN_LUCRU  = "In lucru"
    EXECUTAT  = "Executat"
    ANULAT    = "Anulat"


class ProgramareSource(str, enum.Enum):
    """De unde a venit programarea. `intern` = introdusa in Berlin Star."""
    INTERN = "intern"
    WEB    = "web"
    MCP    = "mcp"


class Programare(Base):
    __tablename__ = "programari"
    __table_args__ = (
        Index("ix_programari_account_id_start_time", "account_id", "start_time"),
        Index("ix_programari_location_id", "location_id"),
        Index("ix_programari_client_id", "client_id"),
        Index("ix_programari_employee_id", "employee_id"),
        Index("ix_programari_account_id_telefon_normalizat", "account_id", "telefon_normalizat"),
        UniqueConstraint("account_id", "public_ref"),
    )

    id:           Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    account_id:   Mapped[int] = mapped_column(Integer, ForeignKey("accounts.id"), nullable=False)
    titlu:        Mapped[str] = mapped_column(String(200), nullable=False)
    notite:       Mapped[str | None] = mapped_column(Text, nullable=True)
    client_id:    Mapped[int | None] = mapped_column(Integer, ForeignKey("clienti.id", ondelete="SET NULL"), nullable=True)
    location_id:  Mapped[int] = mapped_column(Integer, ForeignKey("locations.id"), nullable=False)
    department_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("departments.id", ondelete="SET NULL"), nullable=True)
    employee_id:  Mapped[int | None] = mapped_column(Integer, ForeignKey("employees.id", ondelete="SET NULL"), nullable=True)
    start_time:   Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_time:     Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status:       Mapped[ProgramareStatus] = mapped_column(
        SAEnum(ProgramareStatus, name="programare_status", create_type=False,
               values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        default=ProgramareStatus.PROGRAMAT,
    )
    created_at:  Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    updated_at:  Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_deleted:  Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    deleted_at:  Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Programari online (site public / asistent AI). Pentru `intern` raman NULL.
    source:       Mapped[str] = mapped_column(String(10), nullable=False, default=ProgramareSource.INTERN.value)
    public_ref:   Mapped[str | None] = mapped_column(String(12), nullable=True)
    contact_nume:    Mapped[str | None] = mapped_column(String(100), nullable=True)
    contact_telefon: Mapped[str | None] = mapped_column(String(50), nullable=True)
    telefon_normalizat: Mapped[str | None] = mapped_column(String(20), nullable=True)
    vehicul_marca: Mapped[str | None] = mapped_column(String(60), nullable=True)
    vehicul_model: Mapped[str | None] = mapped_column(String(60), nullable=True)
    vehicul_an:    Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    # Doar pentru `web`; pe MCP IP-ul e al furnizorului AI, nu al clientului.
    client_ip:     Mapped[str | None] = mapped_column(String(45), nullable=True)
    booking_service_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("booking_services.id", ondelete="SET NULL"), nullable=True
    )

    client:     Mapped["Client | None"] = relationship("Client", foreign_keys=[client_id])
    location:   Mapped["Location"] = relationship("Location", foreign_keys=[location_id])
    department: Mapped["Department | None"] = relationship("Department", foreign_keys=[department_id])
    employee:   Mapped["Employee | None"] = relationship("Employee", foreign_keys=[employee_id])


from app.models.client import Client          # noqa: E402
from app.models.location import Location      # noqa: E402
from app.models.department import Department  # noqa: E402
from app.models.employee import Employee        # noqa: E402
