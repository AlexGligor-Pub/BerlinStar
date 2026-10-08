"""Registrul de plati al unui bon: avans / plata / restituire.

Acces: toate rolurile (Resource.OPERATIONS) — cine ia banii la tejghea trebuie sa
poata inregistra incasarea. Stergerea unei inregistrari e permisa tot operational,
dar e logica (audit): randul rămâne in baza cu is_deleted=true.

Registrul e DESCHIS cat timp statusul bonului e Neplatit sau Platit partial —
atunci se mai pot adauga avansuri si se mai poate sterge o suma tastata gresit.
Dupa incasarea integrala (cash/card/OP) si dupa trimiterea la ANAF se inchide.
Statusul se recalculeaza din registru dupa fiecare miscare, iar readucerea lui
pe Neplatit din ecranul bonului redeschide registrul.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.broadcaster import broadcaster
from app.database import get_db
from app.dependencies import get_account_id, get_actor_username
from app.rate_limit import limiter
from app.models.employee import Employee
from app.models.receipt import PayMethod, Receipt, ReceiptItem
from app.routers.receipts import _assert_not_locked, _refresh_accumulations
from app.schemas.receipt_payment import (
    PaymentCreate,
    PaymentRead,
    PaymentsResponse,
    PaymentSummary,
)
from app.services import payments_service as svc
from app.utils.ownership import assert_owned

router = APIRouter()


_LEDGER_OPEN_STATUSES = (PayMethod.NEPLATIT, PayMethod.PARTIAL)


def _assert_status_open(receipt: Receipt) -> None:
    # Fișa de Lucru e o estimare, fara registru de plati: Recepția nici nu il
    # afiseaza, deci o incasare pusa aici ar ramane invizibila.
    if receipt.source == "fdl":
        raise HTTPException(
            409,
            "Fișa de Lucru este o estimare și nu are registru de plăți. "
            "Transform-o întâi în deviz.",
        )
    if receipt.pay_method not in _LEDGER_OPEN_STATUSES:
        raise HTTPException(
            409,
            "Bonul este incasat. Registrul de plati se poate modifica doar cat timp "
            "statusul este Neplatit sau Platit partial.",
        )


async def _assert_open(db: AsyncSession, account_id: int, receipt_id: int) -> Receipt:
    """Raspuns rapid, fara lock: bonul exista, e al contului si nu e incasat
    integral. Verificarea care conteaza e `_guard_open`, sub lock."""
    receipt = await svc.get_receipt(db, account_id, receipt_id)
    _assert_status_open(receipt)
    return receipt


async def _guard_open(db: AsyncSession, receipt: Receipt) -> None:
    """Rulat de serviciu dupa ce randul bonului e blocat, pe bonul recitit: o
    cerere simultana poate sa fi incasat bonul sau sa-l fi trimis la ANAF intre
    verificarea de mai sus si lock.

    Lock-ul ANAF se citeste DOAR aici: citita si inainte de lock, inregistrarea
    de eFactura ar ramane in sesiune cu statusul vechi.
    """
    _assert_status_open(receipt)
    await _assert_not_locked(db, receipt.id)


async def _refresh_receipt_accumulations(db: AsyncSession, receipt: Receipt) -> None:
    """Bonul a trecut intre Neplatit si platit: acumularile angajatilor de pe
    liniile lui se recalculeaza, ca la schimbarea statusului din ecranul bonului."""
    emp_id_rows = (await db.execute(
        select(ReceiptItem.employee_id).where(ReceiptItem.receipt_id == receipt.id)
    )).scalars().all()
    await _refresh_accumulations(db, receipt.account_id, {eid for eid in emp_id_rows if eid})


def _serialize(p) -> dict:
    # O miscare salvata inainte de verificarea de apartenenta poate arata spre
    # angajatul altui cont: id-ul ramane, numele nu se afiseaza.
    emp = getattr(p, "employee", None)
    if emp is not None and emp.account_id != p.account_id:
        emp = None
    return {
        "id": p.id,
        "receipt_id": p.receipt_id,
        "kind": p.kind,
        "amount": p.amount,
        "method": p.method,
        "paid_at": p.paid_at,
        "employee_id": p.employee_id,
        "employee_name": emp.name if emp else None,
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
    # Cine face actiunea — pentru jurnalul de stoc (SALE / SALE_REVERSE).
    actor: str = Depends(get_actor_username),
):
    await _assert_open(db, account_id, receipt_id)
    # employee_id vine din body: fara verificare s-ar putea lega (si citi, prin
    # employee_name) un angajat al altui cont.
    await assert_owned(db, Employee, body.employee_id, account_id, what="Angajatul")
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
        actor=actor,
        on_paid_change=_refresh_receipt_accumulations,
        guard=_guard_open,
    )
    # Statusul si avansul bonului s-au schimbat: Recepția deschisa pe alte
    # dispozitive trebuie sa reciteasca bonul (un avans pus din POS altfel aparea
    # acolo abia dupa reincarcarea paginii). Anuntul pleaca dupa commit-ul din
    # serviciu, deci cine reincarca imediat vede deja starea noua.
    broadcaster.notify(account_id)
    return await _response(db, account_id, receipt_id)


@router.delete("/{receipt_id}/payments/{payment_id}", response_model=PaymentsResponse)
async def delete_payment(
    receipt_id: int,
    payment_id: int,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
    # Cine face actiunea — pentru jurnalul de stoc (SALE / SALE_REVERSE).
    actor: str = Depends(get_actor_username),
):
    """Sterge (logic) o miscare gresita si recalculeaza statusul bonului.

    `receipt_id` NU e decorativ: fara el s-ar putea trimite in path un bon
    deblocat si in query o plata de pe alt bon, ocolind verificarea de lock.
    """
    await _assert_open(db, account_id, receipt_id)
    await svc.delete_payment(
        db, account_id, receipt_id, payment_id,
        actor=actor, on_paid_change=_refresh_receipt_accumulations,
        guard=_guard_open,
    )
    broadcaster.notify(account_id)
    return await _response(db, account_id, receipt_id)
