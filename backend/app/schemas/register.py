from __future__ import annotations
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class RegisterCreate(BaseModel):
    type: str
    serie: str
    numar: int = 0


class RegisterUpdate(BaseModel):
    type: str | None = None
    serie: str | None = None
    numar: int | None = None


class RegisterRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    account_id: int
    type: str
    serie: str
    numar: int
    created_at: datetime
    updated_at: datetime | None
    is_deleted: bool
    deleted_at: datetime | None
