from __future__ import annotations
from datetime import datetime, date, timezone
from decimal import Decimal
from sqlalchemy import (
    Integer,
    String,
    Text,
    Date,
    DateTime,
    Numeric,
    ForeignKey,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base


class EmployeeDetail(Base):
    """Dosar de personal (date legale) al angajatului — 1:1 cu Employee.

    Tabel separat de `employees` (care ramane "quick view"). Contine datele
    legale necesare pentru REGES / CIM si pentru cererile de concediu.
    """

    __tablename__ = "employee_details"

    employee_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("employees.id", ondelete="CASCADE"),
        primary_key=True,
    )
    account_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("accounts.id"), nullable=False
    )
    company_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("companies.id", ondelete="SET NULL"), nullable=True
    )

    # --- Identitate ---
    cnp: Mapped[str | None] = mapped_column(String(13), nullable=True)
    nif: Mapped[str | None] = mapped_column(String(20), nullable=True)
    nationality: Mapped[str | None] = mapped_column(String(100), nullable=True)
    country_of_origin: Mapped[str | None] = mapped_column(String(100), nullable=True)
    id_series: Mapped[str | None] = mapped_column(String(10), nullable=True)
    id_number: Mapped[str | None] = mapped_column(String(20), nullable=True)
    id_issuer: Mapped[str | None] = mapped_column(String(200), nullable=True)
    id_issued_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    birth_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    birth_place: Mapped[str | None] = mapped_column(String(200), nullable=True)

    # --- Contact & domiciliu ---
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    personal_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    address_domicile: Mapped[str | None] = mapped_column(Text, nullable=True)
    address_residence: Mapped[str | None] = mapped_column(Text, nullable=True)

    # --- Contract individual de munca (CIM) ---
    contract_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    contract_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    activity_start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    contract_type: Mapped[str | None] = mapped_column(String(30), nullable=True)  # determinata / nedeterminata
    contract_duration_months: Mapped[int | None] = mapped_column(Integer, nullable=True)
    probation_end_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    # --- Job ---
    job_title: Mapped[str | None] = mapped_column(String(200), nullable=True)
    cor_code: Mapped[str | None] = mapped_column(String(10), nullable=True)
    department: Mapped[str | None] = mapped_column(String(200), nullable=True)
    work_norm: Mapped[str | None] = mapped_column(String(30), nullable=True)  # full-time / part-time
    hours_per_day: Mapped[Decimal | None] = mapped_column(Numeric(4, 2), nullable=True)
    base_salary_gross: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    seniority_months: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # --- Banca ---
    bank_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    iban: Mapped[str | None] = mapped_column(String(34), nullable=True)

    # --- Medical (medicina muncii) ---
    medical_check_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    medical_check_expiry: Mapped[date | None] = mapped_column(Date, nullable=True)

    # --- Altele ---
    marital_status: Mapped[str | None] = mapped_column(String(30), nullable=True)
    dependents_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    education: Mapped[str | None] = mapped_column(Text, nullable=True)
    emergency_contact_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    emergency_contact_phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    emergency_contact_relation: Mapped[str | None] = mapped_column(String(100), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    company: Mapped[Company | None] = relationship("Company")


from .company import Company  # noqa: E402
