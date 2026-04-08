from __future__ import annotations
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class ProfilCreate(BaseModel):
    valoare: str = Field(..., max_length=200)


class ProfilRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    account_id: int
    valoare: str
    created_at: datetime
    updated_at: datetime | None
    is_deleted: bool
