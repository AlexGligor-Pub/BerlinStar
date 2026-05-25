from __future__ import annotations
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class MarcaCreate(BaseModel):
    nume: str = Field(..., min_length=1, max_length=200)


class MarcaRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    nume: str
    status: str
    proposed_by_account_id: int | None
    approved_at: datetime | None
    created_at: datetime
    updated_at: datetime | None
    is_deleted: bool


class MarcaAdminRead(MarcaRead):
    rejected_at: datetime | None
    proposed_by_account_name: str | None = None
