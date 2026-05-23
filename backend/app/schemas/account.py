from __future__ import annotations
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


USERNAME_PATTERN = r"^[a-z0-9]+$"


class AccountCreate(BaseModel):
    name: str = Field(..., max_length=200)
    description: str | None = None
    username: str = Field(..., min_length=1, max_length=100, pattern=USERNAME_PATTERN)
    password: str = Field(..., max_length=255)
    email: str | None = Field(None, max_length=255)
    image_url: str | None = Field(None, max_length=500)


class AccountUpdate(BaseModel):
    name: str | None = Field(None, max_length=200)
    description: str | None = None
    username: str | None = Field(None, min_length=1, max_length=100, pattern=USERNAME_PATTERN)
    password: str | None = Field(None, max_length=255)
    email: str | None = Field(None, max_length=255)
    image_url: str | None = Field(None, max_length=500)
    is_locked: bool | None = None
    locked_at: datetime | None = None


class AccountRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None
    created_at: datetime
    updated_at: datetime | None
    is_deleted: bool
    username: str
    email: str | None
    image_url: str | None
    is_locked: bool
    locked_at: datetime | None
