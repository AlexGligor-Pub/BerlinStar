from __future__ import annotations
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, Field


class EmployeeCreate(BaseModel):
    name: str = Field(..., max_length=200)
    description: str | None = None
    target: Decimal = Field(Decimal("0.00"), ge=0)


class EmployeeUpdate(BaseModel):
    name: str | None = Field(None, max_length=200)
    description: str | None = None
    target: Decimal | None = Field(None, ge=0)


class EmployeeRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    description: str | None
    image_path: str | None
    target: Decimal
    current_target_accumulation: Decimal
    created_at: datetime
    updated_at: datetime | None
    is_deleted: bool
