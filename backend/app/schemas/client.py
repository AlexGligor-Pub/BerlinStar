from __future__ import annotations
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class ClientCreate(BaseModel):
    tip: str = Field(default="fizic", pattern="^(fizic|juridic)$")
    nume: str = Field(..., max_length=200)
    description: str | None = None
    cui: str | None = Field(default=None, max_length=50)
    reprezentant: str | None = Field(default=None, max_length=200)
    telefon: str | None = Field(default=None, max_length=50)
    email: str | None = Field(default=None, max_length=255)
    adresa: str | None = None
    comments: str | None = None


class ClientRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    account_id: int
    tip: str
    nume: str
    description: str | None
    cui: str | None
    reprezentant: str | None
    telefon: str | None
    email: str | None
    adresa: str | None
    comments: str | None
    created_at: datetime
    updated_at: datetime | None
    is_deleted: bool
