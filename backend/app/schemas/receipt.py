from __future__ import annotations
from datetime import datetime, date
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, Field
from app.models.receipt import PayMethod
from app.models.item import ItemType
from app.schemas.vehicol import VehicolRead


class CazareBasicRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    data_checkin: date
    data_checkout: date | None
    numar_masina: str | None


class ReceiptItemCreate(BaseModel):
    name: str = Field(..., max_length=200)
    price: Decimal = Field(..., decimal_places=2)
    qty: int = Field(..., ge=1)
    unit: str = Field(..., max_length=50)
    employee_id: int | None = None
    item_id: int | None = None
    item_type: ItemType | None = None


class ReceiptCreate(BaseModel):
    titlu: str = Field(..., max_length=200)
    descriere: str | None = None
    date_tehn: str | None = None
    items: list[ReceiptItemCreate]
    total: Decimal = Field(..., decimal_places=2)
    pay_method: PayMethod = PayMethod.NEPLATIT
    partial_pay: Decimal | None = Field(None, ge=0, decimal_places=2)
    client_id: int | None = None
    programare_id: int | None = None
    location_id: int | None = None
    deviz_serie: str = ""
    deviz_nr: int = 0
    factura_serie: str = ""
    factura_nr: int = 0
    chitanta_serie: str = ""
    chitanta_nr: int = 0


class ReceiptItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    account_id: int | None
    name: str
    price: Decimal
    qty: int
    unit: str
    employee_id: int | None
    employee_name: str | None = None
    employee_target_pct: float | None = None
    item_id: int | None = None
    item_type: ItemType | None = None

    @classmethod
    def from_orm_item(cls, item: object) -> "ReceiptItemRead":
        emp = getattr(item, "employee", None)
        pct: float | None = None
        if emp and emp.target and emp.target > 0:
            pct = round(float(emp.current_target_accumulation / emp.target * 100), 1)
        return cls.model_validate({
            "id": item.id,  # type: ignore[attr-defined]
            "account_id": item.account_id,  # type: ignore[attr-defined]
            "name": item.name,  # type: ignore[attr-defined]
            "price": item.price,  # type: ignore[attr-defined]
            "qty": item.qty,  # type: ignore[attr-defined]
            "unit": item.unit,  # type: ignore[attr-defined]
            "employee_id": item.employee_id,  # type: ignore[attr-defined]
            "employee_name": emp.name if emp else None,
            "employee_target_pct": pct,
            "item_id": getattr(item, "item_id", None),
            "item_type": getattr(item, "item_type", None),
        })


class ReceiptPatch(BaseModel):
    pay_method: PayMethod
    partial_pay: Decimal | None = Field(None, ge=0, decimal_places=2)


class ReceiptContentPatch(BaseModel):
    titlu: str = Field(..., max_length=200)
    descriere: str | None = None
    date_tehn: str | None = None
    items: list[ReceiptItemCreate]
    total: Decimal = Field(..., decimal_places=2)


class ReceiptClientPatch(BaseModel):
    client_id: int | None


class AssignNumberRequest(BaseModel):
    doc_type: str  # "deviz" | "factura" | "chitanta"
    location_id: int


class AssignNumberResponse(BaseModel):
    serie: str
    nr: int
    company: dict | None = None
    disclaimer: dict | None = None


class ReceiptRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    account_id: int
    titlu: str
    descriere: str | None
    date_tehn: str | None
    created_at: datetime
    updated_at: datetime | None
    total: Decimal
    pay_method: PayMethod
    partial_pay: Decimal | None
    client_id: int | None
    client_nume: str | None = None
    client_cui: str | None = None
    client_adresa: str | None = None
    client_telefon: str | None = None
    client_tip: str | None = None
    client_reprezentant: str | None = None
    client_numar_masina: str | None = None
    deviz_serie: str
    deviz_nr: int
    factura_serie: str
    factura_nr: int
    chitanta_serie: str
    chitanta_nr: int
    programare_id: int | None = None
    location_id: int | None = None
    is_deleted: bool
    deleted_at: datetime | None
    receipt_items: list[ReceiptItemRead]
    vehicol: VehicolRead | None = None
    cazari_anvelope: list[CazareBasicRead] = []
