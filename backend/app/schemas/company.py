from __future__ import annotations
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class CompanyCreate(BaseModel):
    cui: int = Field(..., gt=0)
    name: str = Field(..., max_length=300)
    address: str | None = None
    nr_reg_com: str | None = Field(None, max_length=50)
    phone: str | None = Field(None, max_length=50)
    postal_code: str | None = Field(None, max_length=20)
    is_vat_payer: bool | None = None
    tva_percentage: float | None = None
    registration_status: str | None = Field(None, max_length=200)
    description: str | None = None
    comments: str | None = None
    website: str | None = Field(None, max_length=500)
    bank_name: str | None = Field(None, max_length=200)
    iban: str | None = Field(None, max_length=50)
    capital_social: float | None = 200.0


class CompanyUpdate(BaseModel):
    cui: int | None = Field(None, gt=0)
    name: str | None = Field(None, max_length=300)
    address: str | None = None
    nr_reg_com: str | None = Field(None, max_length=50)
    phone: str | None = Field(None, max_length=50)
    postal_code: str | None = Field(None, max_length=20)
    is_vat_payer: bool | None = None
    tva_percentage: float | None = None
    registration_status: str | None = Field(None, max_length=200)
    description: str | None = None
    comments: str | None = None
    website: str | None = Field(None, max_length=500)
    logo_path: str | None = Field(None, max_length=500)
    background_path: str | None = Field(None, max_length=500)
    bank_name: str | None = Field(None, max_length=200)
    iban: str | None = Field(None, max_length=50)
    capital_social: float | None = None


class CompanyRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    account_id: int
    cui: int
    name: str
    address: str | None
    nr_reg_com: str | None
    phone: str | None
    postal_code: str | None
    is_vat_payer: bool | None
    tva_percentage: float | None
    registration_status: str | None
    description: str | None
    comments: str | None
    logo_path: str | None
    background_path: str | None
    website: str | None
    bank_name: str | None
    iban: str | None
    capital_social: float | None
    created_at: datetime
    updated_at: datetime | None
    is_deleted: bool
