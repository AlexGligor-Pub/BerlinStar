from __future__ import annotations
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class CategoryCreate(BaseModel):
    name: str = Field(..., max_length=100)
    theme_id: int
    image_path: str | None = Field(None, max_length=500)


class CategoryUpdate(BaseModel):
    name: str | None = Field(None, max_length=100)
    theme_id: int | None = None
    image_path: str | None = Field(None, max_length=500)


class CategoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    account_id: int
    name: str
    theme_id: int
    image_path: str | None
    created_at: datetime
    updated_at: datetime | None
    is_deleted: bool
    deleted_at: datetime | None
