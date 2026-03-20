from __future__ import annotations
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, Field
from app.models.item import ItemType


class ItemCreate(BaseModel):
    name: str = Field(..., max_length=200)
    description: str | None = None
    price: Decimal = Field(..., ge=0, decimal_places=2)
    currency: str = Field(default="RON", max_length=3)
    unit: str = Field(..., max_length=50)
    image_path: str | None = Field(None, max_length=500)
    type: ItemType = ItemType.PRODUS
    category_id: int


class ItemUpdate(BaseModel):
    name: str | None = Field(None, max_length=200)
    description: str | None = None
    price: Decimal | None = Field(None, ge=0, decimal_places=2)
    currency: str | None = Field(None, max_length=3)
    unit: str | None = Field(None, max_length=50)
    image_path: str | None = Field(None, max_length=500)
    type: ItemType | None = None
    category_id: int | None = None


class ItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    account_id: int
    name: str
    description: str | None
    created_at: datetime
    updated_at: datetime | None
    deleted_at: datetime | None
    price: Decimal
    currency: str
    unit: str
    image_path: str | None
    is_deleted: bool
    type: ItemType
    category_id: int
    category_name: str | None = None
    theme_id: int | None = None
