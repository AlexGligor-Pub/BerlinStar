from __future__ import annotations
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, Field
from app.models.receipt import PayMethod


class ReceiptItemCreate(BaseModel):
    name: str = Field(..., max_length=200)
    price: Decimal = Field(..., ge=0, decimal_places=2)
    qty: int = Field(..., ge=1)
    unit: str = Field(..., max_length=50)


class ReceiptCreate(BaseModel):
    casier: str = Field(..., max_length=200)
    titlu: str = Field(..., max_length=200)
    descriere: str | None = None
    date_tehn: str | None = None
    items: list[ReceiptItemCreate]
    total: Decimal = Field(..., ge=0, decimal_places=2)
    pay_method: PayMethod = PayMethod.NEPLATIT
    partial_pay: Decimal | None = Field(None, ge=0, decimal_places=2)


class ReceiptItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    price: Decimal
    qty: int
    unit: str


class ReceiptRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    account_id: int
    casier: str
    titlu: str
    descriere: str | None
    date_tehn: str | None
    created_at: datetime
    updated_at: datetime | None
    total: Decimal
    pay_method: PayMethod
    partial_pay: Decimal | None
    is_deleted: bool
    deleted_at: datetime | None
    receipt_items: list[ReceiptItemRead]
