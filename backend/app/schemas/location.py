from __future__ import annotations
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class LocationCreate(BaseModel):
    name: str = Field(..., max_length=200)
    description: str | None = None


class LocationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    description: str | None
    account_id: int
    created_at: datetime
    updated_at: datetime | None
    is_deleted: bool


class LocationDetail(LocationRead):
    department_ids: list[int] = []
    employee_ids: list[int] = []


class IdsBody(BaseModel):
    ids: list[int]
