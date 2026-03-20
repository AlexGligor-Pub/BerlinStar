from __future__ import annotations
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class ThemeCreate(BaseModel):
    name: str = Field(..., max_length=100)
    description: str | None = None
    image_path: str | None = Field(None, max_length=500)


class ThemeUpdate(BaseModel):
    name: str | None = Field(None, max_length=100)
    description: str | None = None
    image_path: str | None = Field(None, max_length=500)


class ThemeRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    account_id: int
    name: str
    description: str | None
    image_path: str | None
    created_at: datetime
    updated_at: datetime | None
    is_deleted: bool
    deleted_at: datetime | None
