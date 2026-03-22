from __future__ import annotations
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class DisclaimerCreate(BaseModel):
    title: str
    text: str


class DisclaimerUpdate(BaseModel):
    title: str | None = None
    text: str | None = None


class DisclaimerRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    account_id: int
    title: str
    text: str
    created_at: datetime
    updated_at: datetime | None
    is_deleted: bool
    deleted_at: datetime | None
