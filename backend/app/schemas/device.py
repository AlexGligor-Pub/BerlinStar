from __future__ import annotations
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class DeviceCreate(BaseModel):
    name: str = Field(..., max_length=200)
    location_id: int | None = None


class DeviceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    account_id: int
    location_id: int | None
    created_at: datetime
