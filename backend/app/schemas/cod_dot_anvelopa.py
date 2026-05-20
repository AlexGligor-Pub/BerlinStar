from __future__ import annotations
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class CodDotCreate(BaseModel):
    valoare: str = Field(..., max_length=50)


class CodDotRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    account_id: int
    valoare: str
    created_at: datetime
    updated_at: datetime | None
    is_deleted: bool
