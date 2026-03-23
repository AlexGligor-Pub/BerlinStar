from __future__ import annotations
from datetime import datetime, date
from pydantic import BaseModel, ConfigDict
from app.schemas.anvelopa import AnvelopaRead


class CazareCreate(BaseModel):
    client_id: int | None = None
    employee_id: int | None = None
    loc_cazare_id: int | None = None
    data_checkin: date
    comments: str | None = None
    anvelopa_ids: list[int] = []


class CazareCheckoutBody(BaseModel):
    data_checkout: date
    comments: str | None = None


class CazareUpdateBody(BaseModel):
    employee_id: int | None = None
    loc_cazare_id: int | None = None
    data_checkin: date | None = None
    comments: str | None = None
    anvelopa_ids: list[int] | None = None  # dacă prezent, înlocuiește toate itemele


class CazareItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    anvelopa_id: int | None
    anvelopa: AnvelopaRead | None = None


class CazareRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    account_id: int
    client_id: int | None
    employee_id: int | None
    loc_cazare_id: int | None
    data_checkin: date
    data_checkout: date | None
    comments: str | None
    created_at: datetime
    updated_at: datetime | None
    is_deleted: bool
    # denormalizat
    client_nume: str | None = None
    client_cui: str | None = None
    client_telefon: str | None = None
    client_adresa: str | None = None
    client_reprezentant: str | None = None
    employee_name: str | None = None
    loc_cazare_nume: str | None = None
    items: list[CazareItemRead] = []
