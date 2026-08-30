"""Registrul de plati al unui bon: avans / plata / restituire.

Acces: toate rolurile (Resource.OPERATIONS) — cine ia banii la tejghea trebuie sa
poata inregistra incasarea. Stergerea unei inregistrari e permisa tot operational,
dar e logica (audit): randul rămâne in baza cu is_deleted=true.

Registrul rămâne DESCHIS cat timp bonul nu e trimis la ANAF. Statusul de plata
al bonului (`pay_method` / `partial_pay`) se recalculeaza din registru dupa
fiecare miscare, deci un avans nu inchide registrul — altfel s-ar putea
inregistra o singura miscare per bon si o suma tastata gresit ar rămâne acolo
pentru totdeauna. Singurul lucru care il inchide definitiv e factura trimisa la
ANAF, unde incasarea a fost deja raportata.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_account_id
from app.rate_limit import limiter
from app.models.receipt import Receipt
from app.routers.receipts import _assert_not_locked
from app.schemas.receipt_payment import (
    PaymentCreate,
    PaymentRead,
    PaymentsResponse,
    PaymentSummary,
)
from app.services import payments_service as svc

router = APIRouter()


async def _assert_open(db: AsyncSession, account_id: int, receipt_id: int) -> Receipt:
    """Bonul exista, e al contului si nu a fost raportat la ANAF."""
    receipt = await svc.get_receipt(db, account_id, receipt_id)
    await _assert_not_locked(db, receipt_id)
    return receipt


def _serialize(p) -> dict:
    return {
        "id": p.id,
        "receipt_id": p.receipt_id,
        "kind": p.kind,
        "amount": p.amount,
        "method": p.method,
        "paid_at": p.paid_at,
        "employee_id": p.employee_id,
        "employee_name": p.employee.name if getattr(p, "employee", None) else None,
        "note": p.note,
    }


async def _response(db: AsyncSession, account_id: int, receipt_id: int) -> dict:
    receipt = await svc.get_receipt(db, account_id, receipt_id)
    payments = await svc.list_payments(db, account_id, receipt_id)
    return {
        "payments": [_serialize(p) for p in payments],
        "summary": PaymentSummary(**svc.summarize(payments, receipt.total)),
    }


@router.get("/{receipt_id}/payments", response_model=PaymentsResponse)
async def list_payments(
    receipt_id: int,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    return await _response(db, account_id, receipt_id)


@router.post("/{receipt_id}/payments", response_model=PaymentsResponse, status_code=201)
@limiter.limit("60/minute")
async def add_payment(
    request: Request,
    receipt_id: int,
    body: PaymentCreate,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    await _assert_open(db, account_id, receipt_id)
    await svc.add_payment(
        db,
        account_id=account_id,
        receipt_id=receipt_id,
        kind=body.kind,
        amount=body.amount,
        method=body.method,
        paid_at=body.paid_at,
        employee_id=body.employee_id,
        note=body.note,
    )
    return await _response(db, account_id, receipt_id)


@router.delete("/{receipt_id}/payments/{payment_id}", response_model=PaymentsResponse)
async def delete_payment(
    receipt_id: int,
    payment_id: int,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    """Sterge (logic) o miscare gresita si recalculeaza statusul bonului.

    `receipt_id` NU e decorativ: fara el s-ar putea trimite in path un bon
    deblocat si in query o plata de pe alt bon, ocolind verificarea de lock.
    """
    await _assert_open(db, account_id, receipt_id)
    await svc.delete_payment(db, account_id, receipt_id, payment_id)
    return await _response(db, account_id, receipt_id)
