from __future__ import annotations
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, Field

from app.models.stock_movement import StockMovementType


class StocRow(BaseModel):
    """Un produs cu stocul lui la locatia ceruta."""
    model_config = ConfigDict(from_attributes=True)

    item_id: int
    name: str
    unit: str
    price: Decimal
    cost_price: Decimal | None
    stoc_minim: int
    qty: int
    department_id: int
    department_name: str
    category_id: int
    category_name: str


class ItemStocPatch(BaseModel):
    cost_price: Decimal | None = Field(None, ge=0, decimal_places=2)
    stoc_minim: int | None = Field(None, ge=0)


class IntrareStocCreate(BaseModel):
    item_id: int
    location_id: int
    qty: int = Field(..., gt=0)
    unit_cost: Decimal | None = Field(None, ge=0, decimal_places=2)
    note: str | None = Field(None, max_length=500)


class AjustareStocCreate(BaseModel):
    item_id: int
    location_id: int
    new_qty: int = Field(..., ge=0)
    note: str | None = Field(None, max_length=500)


class MiscareStocRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    movement_type: StockMovementType
    item_id: int | None
    item_name: str
    location_id: int | None
    employee_id: int | None
    employee_name: str | None = None
    receipt_id: int | None
    qty_delta: int
    unit_cost: Decimal | None
    unit_price: Decimal | None
    note: str | None
    created_by_user: str | None


class StocSnapshot(BaseModel):
    location_id: int
    location_name: str
    nr_produse: int
    qty_total: int
    valoare_cost: Decimal
    valoare_vanzare: Decimal
    sub_stoc_minim: int
