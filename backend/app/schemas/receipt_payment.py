from __future__ import annotations
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.models.receipt_payment import PaymentKind, PaymentMethod


class PaymentCreate(BaseModel):
    kind: PaymentKind
    # Suma e mereu pozitiva; semnul rezulta din `kind` (restituire scade).
    amount: Decimal = Field(..., gt=0, decimal_places=2)
    method: PaymentMethod = PaymentMethod.CASH
    paid_at: datetime | None = None
    employee_id: int | None = None
    note: str | None = Field(None, max_length=500)


class PaymentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    receipt_id: int
    kind: PaymentKind
    amount: Decimal
    method: PaymentMethod
    paid_at: datetime
    employee_id: int | None = None
    employee_name: str | None = None
    note: str | None = None


class PaymentSummary(BaseModel):
    """Sumarul afisat in Receptie si pe PDF-ul devizului."""
    total_bon: Decimal
    avansuri: Decimal
    incasat_brut: Decimal
    restituit: Decimal
    incasat_net: Decimal
    rest_de_plata: Decimal


class PaymentsResponse(BaseModel):
    payments: list[PaymentRead]
    summary: PaymentSummary
