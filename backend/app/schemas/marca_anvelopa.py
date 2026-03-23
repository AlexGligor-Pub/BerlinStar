from __future__ import annotations
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class MarcaCreate(BaseModel):
    nume: str = Field(..., max_length=200)


class MarcaRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    account_id: int
    nume: str
    created_at: datetime
    updated_at: datetime | None
    is_deleted: bool
