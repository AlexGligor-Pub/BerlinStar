from __future__ import annotations
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class LocCazareCreate(BaseModel):
    nume: str = Field(..., max_length=200)
    description: str | None = None


class LocCazareRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    account_id: int
    nume: str
    description: str | None
    created_at: datetime
    updated_at: datetime | None
    is_deleted: bool
