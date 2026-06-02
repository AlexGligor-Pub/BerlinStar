from __future__ import annotations
from datetime import datetime, date
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, Field, field_validator


class EmployeeDetailUpsert(BaseModel):
    """Payload pentru creare/actualizare dosar de personal (toate optionale)."""

    company_id: int | None = None

    # Identitate
    cnp: str | None = Field(None, max_length=13)
    nif: str | None = Field(None, max_length=20)
    nationality: str | None = Field(None, max_length=100)
    country_of_origin: str | None = Field(None, max_length=100)
    id_series: str | None = Field(None, max_length=10)
    id_number: str | None = Field(None, max_length=20)
    id_issuer: str | None = Field(None, max_length=200)
    id_issued_date: date | None = None
    birth_date: date | None = None
    birth_place: str | None = Field(None, max_length=200)

    # Contact & domiciliu
    phone: str | None = Field(None, max_length=50)
    personal_email: str | None = Field(None, max_length=255)
    address_domicile: str | None = None
    address_residence: str | None = None

    # Contract individual de munca (CIM)
    contract_number: str | None = Field(None, max_length=50)
    contract_date: date | None = None
    activity_start_date: date | None = None
    contract_type: str | None = Field(None, max_length=30)
    contract_duration_months: int | None = Field(None, ge=0)
    probation_end_date: date | None = None

    # Job
    job_title: str | None = Field(None, max_length=200)
    cor_code: str | None = Field(None, max_length=10)
    department: str | None = Field(None, max_length=200)
    work_norm: str | None = Field(None, max_length=30)
    hours_per_day: Decimal | None = Field(None, ge=0, le=24)
    base_salary_gross: Decimal | None = Field(None, ge=0)
    seniority_months: int | None = Field(None, ge=0)

    # Banca
    bank_name: str | None = Field(None, max_length=200)
    iban: str | None = Field(None, max_length=34)

    # Medical (medicina muncii)
    medical_check_date: date | None = None
    medical_check_expiry: date | None = None

    # Altele
    marital_status: str | None = Field(None, max_length=30)
    dependents_count: int | None = Field(None, ge=0)
    education: str | None = None
    emergency_contact_name: str | None = Field(None, max_length=200)
    emergency_contact_phone: str | None = Field(None, max_length=50)
    emergency_contact_relation: str | None = Field(None, max_length=100)

    @field_validator("cnp")
    @classmethod
    def _validate_cnp(cls, v: str | None) -> str | None:
        if v is None or v == "":
            return v
        v = v.strip()
        if not (v.isdigit() and len(v) == 13):
            raise ValueError("CNP-ul trebuie sa aiba exact 13 cifre.")
        return v

    @field_validator("iban")
    @classmethod
    def _validate_iban(cls, v: str | None) -> str | None:
        if v is None or v == "":
            return v
        v = v.replace(" ", "").upper()
        if len(v) < 15 or not v[:2].isalpha():
            raise ValueError("IBAN invalid.")
        return v


class EmployeeDetailRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    employee_id: int
    company_id: int | None

    cnp: str | None
    nif: str | None
    nationality: str | None
    country_of_origin: str | None
    id_series: str | None
    id_number: str | None
    id_issuer: str | None
    id_issued_date: date | None
    birth_date: date | None
    birth_place: str | None

    phone: str | None
    personal_email: str | None
    address_domicile: str | None
    address_residence: str | None

    contract_number: str | None
    contract_date: date | None
    activity_start_date: date | None
    contract_type: str | None
    contract_duration_months: int | None
    probation_end_date: date | None

    job_title: str | None
    cor_code: str | None
    department: str | None
    work_norm: str | None
    hours_per_day: Decimal | None
    base_salary_gross: Decimal | None
    seniority_months: int | None

    bank_name: str | None
    iban: str | None

    medical_check_date: date | None
    medical_check_expiry: date | None

    marital_status: str | None
    dependents_count: int | None
    education: str | None
    emergency_contact_name: str | None
    emergency_contact_phone: str | None
    emergency_contact_relation: str | None

    created_at: datetime
    updated_at: datetime | None
