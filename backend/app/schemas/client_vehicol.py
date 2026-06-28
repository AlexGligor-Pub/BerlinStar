from __future__ import annotations
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class ClientVehicolCreate(BaseModel):
    numar_masina: str = Field(..., max_length=50)
    marca: str | None = Field(None, max_length=100)
    model: str | None = Field(None, max_length=100)
    numar_kilometrii: int | None = Field(None, ge=0)
    an_fabricatie: int | None = Field(None, ge=1900, le=2100)
    vin: str | None = Field(None, max_length=17)
    observatii: str | None = None


class ClientVehicolRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    client_id: int
    account_id: int
    numar_masina: str
    marca: str | None
    model: str | None
    numar_kilometrii: int | None
    an_fabricatie: int | None
    vin: str | None
    observatii: str | None
    created_at: datetime
    updated_at: datetime | None
    is_deleted: bool


class ClientShort(BaseModel):
    id: int
    nume: str
    tip: str
    cui: str | None
    numar_masina: str | None


class ClientVehicolWithClientRead(BaseModel):
    vehicol: ClientVehicolRead
    client: ClientShort
