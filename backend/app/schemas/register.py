from __future__ import annotations
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class RegisterCreate(BaseModel):
    name: str
    deviz_serie: str = ""
    deviz_numar: int = 0
    factura_serie: str = ""
    factura_numar: int = 0
    chitanta_serie: str = ""
    chitanta_numar: int = 0
    aviz_serie: str = ""
    aviz_numar: int = 0


class RegisterUpdate(BaseModel):
    name: str | None = None
    deviz_serie: str | None = None
    deviz_numar: int | None = None
    factura_serie: str | None = None
    factura_numar: int | None = None
    chitanta_serie: str | None = None
    chitanta_numar: int | None = None
    aviz_serie: str | None = None
    aviz_numar: int | None = None


class RegisterRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    account_id: int
    name: str
    deviz_serie: str
    deviz_numar: int
    factura_serie: str
    factura_numar: int
    chitanta_serie: str
    chitanta_numar: int
    aviz_serie: str
    aviz_numar: int
    created_at: datetime
    updated_at: datetime | None
    is_deleted: bool
    deleted_at: datetime | None
