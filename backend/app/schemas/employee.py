from __future__ import annotations
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, ConfigDict


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
