from __future__ import annotations
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field
from app.models.anvelopa import TipAnvelopa


class AnvelopaCreate(BaseModel):
    client_id: int | None = None
    marca_id: int | None = None
    dimensiune_id: int | None = None
    tip: TipAnvelopa = TipAnvelopa.VARA
    adancime: float | None = Field(default=None, ge=0)
    comments: str | None = None


class AnvelopaUpdate(BaseModel):
    marca_id: int | None = None
    dimensiune_id: int | None = None
    tip: TipAnvelopa | None = None
    adancime: float | None = Field(default=None, ge=0)
    comments: str | None = None


class AnvelopaRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    account_id: int
    client_id: int | None
    marca_id: int | None
    dimensiune_id: int | None
    tip: TipAnvelopa
    adancime: float | None
    comments: str | None
    # denormalizat pentru afișare
    marca_nume: str | None = None
    dimensiune_valoare: str | None = None
    created_at: datetime
    updated_at: datetime | None
    is_deleted: bool
