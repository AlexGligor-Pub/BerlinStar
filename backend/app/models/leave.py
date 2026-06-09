from __future__ import annotations
import enum
from datetime import date, datetime, time, timezone
from decimal import Decimal
from sqlalchemy import Boolean, Date, DateTime, Enum as SAEnum, ForeignKey, Index, Integer, Numeric, String, Text, Time
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base


class LeaveType(str, enum.Enum):
    VACATION            = "Concediu de odihna"
    SICK                = "Concediu medical"
    BUSINESS_TRIP       = "Business Trip"
    UNPAID              = "Concediu fara plata"
    # Tipuri masurate in ore (single-day), nu in zile lucratoare:
    PERMISSION          = "Invoire"                  # invoire — cateva ore liber
    OVERTIME            = "Overtime"                 # ore lucrate peste program
    PERMISSION_RECOVERY = "Recuperare Ore invoire"   # ore lucrate pentru a compensa invoirile


# Tipuri cuantificate in ore (au start_time/end_time/hours, working_days=0,
# fara flux legal: consimtamant / snapshot / PDF).
HOUR_BASED_TYPES = frozenset({
    LeaveType.PERMISSION,
    LeaveType.OVERTIME,
    LeaveType.PERMISSION_RECOVERY,
})


class LeaveStatus(str, enum.Enum):
    PENDING  = "Pending"
    APPROVED = "Approved"
    REJECTED = "Rejected"


class Leave(Base):
    __tablename__ = "leaves"
    __table_args__ = (
        Index("ix_leaves_account_id_start_date", "account_id", "start_date"),
        Index("ix_leaves_employee_id_start_date", "employee_id", "start_date"),
        Index("ix_leaves_location_id", "location_id"),
    )

    id:            Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    account_id:    Mapped[int] = mapped_column(Integer, ForeignKey("accounts.id"), nullable=False)
    employee_id:   Mapped[int] = mapped_column(Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    location_id:   Mapped[int | None] = mapped_column(Integer, ForeignKey("locations.id", ondelete="SET NULL"), nullable=True)
    type:          Mapped[LeaveType] = mapped_column(
        SAEnum(LeaveType, name="leave_type", create_type=False,
               values_callable=lambda x: [e.value for e in x]),
        nullable=False,
    )
    status:        Mapped[LeaveStatus] = mapped_column(
        SAEnum(LeaveStatus, name="leave_status", create_type=False,
               values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        default=LeaveStatus.PENDING,
    )
    start_date:    Mapped[date] = mapped_column(Date, nullable=False)
    end_date:      Mapped[date] = mapped_column(Date, nullable=False)
    working_days:  Mapped[int]  = mapped_column(Integer, nullable=False, default=0)
    # Pentru tipurile masurate in ore (HOUR_BASED_TYPES): interval orar + total ore.
    start_time:    Mapped[time | None] = mapped_column(Time, nullable=True)
    end_time:      Mapped[time | None] = mapped_column(Time, nullable=True)
    hours:         Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    notes:         Mapped[str | None] = mapped_column(Text, nullable=True)
    approved_by:   Mapped[int | None] = mapped_column(Integer, ForeignKey("accounts.id", ondelete="SET NULL"), nullable=True)
    approved_at:   Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # --- Date legale ale cererii (Codul Muncii) ---
    request_date:  Mapped[date | None] = mapped_column(Date, nullable=True)
    # Snapshot al datelor legale (angajat + firma + sold) la momentul cererii,
    # pentru ca PDF-ul si istoricul sa ramana corecte chiar daca datele se schimba ulterior.
    details_snapshot: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    # Acord digital al angajatului
    employee_consent:     Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    employee_consent_at:  Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Acord digital al aprobatorului (setat la /approve)
    approver_consent:        Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    approver_name_snapshot:  Mapped[str | None] = mapped_column(String(200), nullable=True)

    created_at:    Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    updated_at:    Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_deleted:    Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    deleted_at:    Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    employee: Mapped["Employee"] = relationship("Employee", foreign_keys=[employee_id])
    location: Mapped["Location | None"] = relationship("Location", foreign_keys=[location_id])
    approver: Mapped["Account | None"] = relationship("Account", foreign_keys=[approved_by])


from app.models.employee import Employee     # noqa: E402
from app.models.location import Location     # noqa: E402
from app.models.account import Account       # noqa: E402
