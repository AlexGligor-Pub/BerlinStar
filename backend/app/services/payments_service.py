"""Registrul de plati al unui bon: avans, plata, restituire.

Principiul: LINIILE bonului spun ce s-a vandut (baza de TVA), iar registrul de
aici spune cand si cum au circulat banii. Un avans nu micsoreaza valoarea
prestatiei, deci NU are ce cauta in linii — daca l-am pune ca linie negativa, ar
ajunge reducere in eFactura si am raporta TVA mai mic decat datorat.

`receipts.pay_method` si `receipts.partial_pay` rămân sursa de status pentru
restul aplicatiei (rapoarte, filtrul "neplatit", POS) si se RECALCULEAZA din
registru la fiecare modificare. Bonurile fara inregistrari se comporta exact ca
inainte de acest modul.
"""
from __future__ import annotations
from datetime import datetime, timezone
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.receipt import PayMethod, Receipt
from app.models.receipt_payment import PaymentKind, PaymentMethod, ReceiptPayment

# Toleranta la comparatia sumelor (rotunjiri de 1 ban).
EPS = Decimal("0.01")

# Metoda de plata din registru -> statusul de pe bon, cand bonul e achitat integral.
_METHOD_TO_PAY_METHOD = {
    PaymentMethod.CASH: PayMethod.CASH,
    PaymentMethod.CARD: PayMethod.CARD,
    PaymentMethod.OP: PayMethod.OP,
    PaymentMethod.ALTA: PayMethod.CASH,
}


# Statusul de pe bon -> metoda din registru (invers fata de _METHOD_TO_PAY_METHOD).
# "Platit Partial" nu spune prin ce mijloc s-a incasat, deci marcam "Alta".
_PAY_METHOD_TO_METHOD = {
    PayMethod.CASH: PaymentMethod.CASH,
    PayMethod.CARD: PaymentMethod.CARD,
    PayMethod.OP: PaymentMethod.OP,
    PayMethod.PARTIAL: PaymentMethod.ALTA,
    PayMethod.NEPLATIT: PaymentMethod.ALTA,
}


def _q2(v: Decimal | int | float | None) -> Decimal:
    return Decimal(str(v or 0)).quantize(Decimal("0.01"))


def signed_amount(p: ReceiptPayment) -> Decimal:
    """Suma cu semn: restituirea scade din incasari."""
    amt = _q2(p.amount)
    return -amt if p.kind == PaymentKind.RESTITUIRE else amt


async def get_receipt(db: AsyncSession, account_id: int, receipt_id: int) -> Receipt:
    receipt = (await db.execute(
        select(Receipt).where(
            Receipt.id == receipt_id,
            Receipt.account_id == account_id,
            Receipt.is_deleted == False,
        )
    )).scalar_one_or_none()
    if receipt is None:
        raise HTTPException(404, "Bonul nu a fost gasit.")
    return receipt


async def list_payments(db: AsyncSession, account_id: int, receipt_id: int) -> list[ReceiptPayment]:
    return list((await db.execute(
        select(ReceiptPayment)
        .options(selectinload(ReceiptPayment.employee))
        .where(
            ReceiptPayment.receipt_id == receipt_id,
            ReceiptPayment.account_id == account_id,
            ReceiptPayment.is_deleted == False,
        )
        .order_by(ReceiptPayment.paid_at, ReceiptPayment.id)
    )).scalars().all())


def summarize(payments: list[ReceiptPayment], receipt_total: Decimal | None) -> dict:
    """Sumar pentru UI/PDF: cat s-a incasat, cat s-a restituit, cat mai e de plata."""
    incasat_brut = _q2(sum((_q2(p.amount) for p in payments if p.kind != PaymentKind.RESTITUIRE), Decimal("0")))
    restituit = _q2(sum((_q2(p.amount) for p in payments if p.kind == PaymentKind.RESTITUIRE), Decimal("0")))
    avansuri = _q2(sum((_q2(p.amount) for p in payments if p.kind == PaymentKind.AVANS), Decimal("0")))
    net = _q2(incasat_brut - restituit)
    total = _q2(receipt_total)
    return {
        "total_bon": total,
        "avansuri": avansuri,
        "incasat_brut": incasat_brut,
        "restituit": restituit,
        # Cat a rămas efectiv in casa pentru acest bon.
        "incasat_net": net,
        "rest_de_plata": _q2(total - net),
    }


async def _sync_receipt_status(db: AsyncSession, receipt: Receipt, payments: list[ReceiptPayment]) -> None:
    """Recalculeaza pay_method/partial_pay din registru.

    - fara incasari nete            -> Neplatit
    - incasat >= total              -> achitat, cu metoda ultimei incasari pozitive
    - incasat intre 0 si total      -> Platit Partial, partial_pay = incasat net
      (partial_pay e si sursa pentru PrepaidAmount/BT-113 in eFactura, deci un
       avans nerestituit apare corect ca avans pe factura)
    """
    s = summarize(payments, receipt.total)
    net, total = s["incasat_net"], s["total_bon"]

    if net <= Decimal("0"):
        receipt.pay_method = PayMethod.NEPLATIT
        receipt.partial_pay = None
    elif total > 0 and net + EPS >= total:
        last_positive = next(
            (p for p in reversed(payments) if p.kind != PaymentKind.RESTITUIRE), None
        )
        receipt.pay_method = _METHOD_TO_PAY_METHOD.get(
            last_positive.method if last_positive else PaymentMethod.CASH, PayMethod.CASH
        )
        receipt.partial_pay = None
    else:
        receipt.pay_method = PayMethod.PARTIAL
        receipt.partial_pay = net

    receipt.updated_at = datetime.now(timezone.utc)


async def _seed_legacy_partial(db: AsyncSession, receipt: Receipt) -> None:
    """Bon vechi cu `partial_pay` dar fara registru: transformam suma existenta in
    prima inregistrare, ca istoricul sa rămână coerent cand se adauga plati noi."""
    if not receipt.partial_pay or _q2(receipt.partial_pay) <= 0:
        return
    db.add(ReceiptPayment(
        receipt_id=receipt.id,
        account_id=receipt.account_id,
        kind=PaymentKind.PLATA,
        amount=_q2(receipt.partial_pay),
        method=PaymentMethod.ALTA,
        paid_at=receipt.created_at or datetime.now(timezone.utc),
        note="Preluat din plata partiala inregistrata anterior",
    ))
    await db.flush()


async def add_payment(
    db: AsyncSession,
    account_id: int,
    receipt_id: int,
    kind: PaymentKind,
    amount: Decimal,
    method: PaymentMethod,
    paid_at: datetime | None = None,
    employee_id: int | None = None,
    note: str | None = None,
) -> tuple[ReceiptPayment, dict]:
    receipt = await get_receipt(db, account_id, receipt_id)
    amount = _q2(amount)
    if amount <= 0:
        raise HTTPException(400, "Suma trebuie sa fie mai mare decat zero.")

    existing = await list_payments(db, account_id, receipt_id)
    if not existing:
        await _seed_legacy_partial(db, receipt)
        existing = await list_payments(db, account_id, receipt_id)

    if kind == PaymentKind.RESTITUIRE:
        # Nu poti restitui mai mult decat ai in casa pe bonul asta.
        net = summarize(existing, receipt.total)["incasat_net"]
        if amount > net + EPS:
            raise HTTPException(
                400,
                f"Nu poti restitui {amount} lei: pe acest bon s-au incasat net {net} lei.",
            )

    payment = ReceiptPayment(
        receipt_id=receipt.id,
        account_id=account_id,
        kind=kind,
        amount=amount,
        method=method,
        paid_at=paid_at or datetime.now(timezone.utc),
        employee_id=employee_id,
        note=note,
    )
    db.add(payment)
    await db.flush()

    payments = await list_payments(db, account_id, receipt_id)
    await _sync_receipt_status(db, receipt, payments)
    await db.commit()
    await db.refresh(payment)
    return payment, summarize(payments, receipt.total)


async def delete_payment(
    db: AsyncSession, account_id: int, receipt_id: int, payment_id: int
) -> dict:
    """Sterge logic o miscare de pe un bon anume.

    `receipt_id` face parte din cheia de cautare, nu doar din URL: altfel un
    payment_id de pe alt bon ar fi acceptat, iar verificarile facute de router pe
    bonul din path (proprietate, lock ANAF) ar fi ocolite.
    """
    payment = (await db.execute(
        select(ReceiptPayment).where(
            ReceiptPayment.id == payment_id,
            ReceiptPayment.receipt_id == receipt_id,
            ReceiptPayment.account_id == account_id,
            ReceiptPayment.is_deleted == False,
        )
    )).scalar_one_or_none()
    if payment is None:
        raise HTTPException(404, "Inregistrarea de plata nu a fost gasita.")

    receipt = await get_receipt(db, account_id, receipt_id)
    payment.is_deleted = True
    payment.deleted_at = datetime.now(timezone.utc)
    await db.flush()

    payments = await list_payments(db, account_id, receipt.id)
    await _sync_receipt_status(db, receipt, payments)
    await db.commit()
    return summarize(payments, receipt.total)


async def sync_from_status(
    db: AsyncSession,
    account_id: int,
    receipt: Receipt,
    legacy_partial: Decimal | None = None,
) -> None:
    """Completeaza registrul dupa o schimbare de status din selectorul "Status plata".

    Directia normala e registru -> status (`_sync_receipt_status`). Aici acoperim
    directia inversa: cand utilizatorul mută statusul (ex. Neplatit -> Platit cash),
    inregistram automat DIFERENTA de bani, ca "Situatie plati" sa rămână completa
    si sa arate exact cat s-a incasat si cat a mai rămas.

    `legacy_partial` = valoarea `partial_pay` de INAINTE de modificare, pentru
    bonurile vechi care aveau plata partiala dar nu au inca inregistrari; altfel
    am inregistra din nou banii deja incasati.
    """
    payments = await list_payments(db, account_id, receipt.id)
    if not payments and legacy_partial and _q2(legacy_partial) > 0:
        db.add(ReceiptPayment(
            receipt_id=receipt.id,
            account_id=account_id,
            kind=PaymentKind.PLATA,
            amount=_q2(legacy_partial),
            method=PaymentMethod.ALTA,
            paid_at=receipt.created_at or datetime.now(timezone.utc),
            note="Preluat din plata partiala inregistrata anterior",
        ))
        await db.flush()
        payments = await list_payments(db, account_id, receipt.id)

    net = summarize(payments, receipt.total)["incasat_net"]
    total = _q2(receipt.total)

    if receipt.pay_method == PayMethod.NEPLATIT:
        target = Decimal("0.00")
    elif receipt.pay_method == PayMethod.PARTIAL:
        target = _q2(receipt.partial_pay or 0)
    else:
        target = total

    delta = _q2(target - net)
    if abs(delta) < EPS:
        return  # registrul deja reflecta statusul

    method = _PAY_METHOD_TO_METHOD.get(receipt.pay_method, PaymentMethod.ALTA)
    if delta > 0:
        kind, amount = PaymentKind.PLATA, delta
        note = "Inregistrat din status plata"
    else:
        # Statusul a scazut (ex. revenire la Neplatit sau avans micsorat):
        # banii au ieusit din casa pentru acest bon.
        kind, amount, method = PaymentKind.RESTITUIRE, -delta, PaymentMethod.ALTA
        note = "Corectie din status plata"

    db.add(ReceiptPayment(
        receipt_id=receipt.id,
        account_id=account_id,
        kind=kind,
        amount=amount,
        method=method,
        paid_at=datetime.now(timezone.utc),
        note=note,
    ))
    await db.flush()


async def resync_after_total_change(db: AsyncSession, account_id: int, receipt: Receipt) -> None:
    """Realiniaza statusul de plata dupa ce s-a schimbat TOTALUL bonului.

    Cazul tipic: bon incasat partial, apoi se aplica o reducere. Restul de plata
    se recalculeaza oricum din registru la afisare, dar statusul stocat pe bon ar
    ramane „Platit Partial" chiar daca reducerea a acoperit tot restul. Nu
    inregistram nicio miscare de bani — doar recitim ce inseamna incasarile
    existente fata de noul total.
    """
    payments = await list_payments(db, account_id, receipt.id)
    if not payments:
        # Bon fara registru: pastram statusul manual asa cum l-a pus operatorul.
        # Corectam doar avansul care depaseste noul total, altfel „partial" ar
        # afisa un rest negativ.
        if receipt.pay_method == PayMethod.PARTIAL and receipt.partial_pay is not None:
            if _q2(receipt.partial_pay) > _q2(receipt.total):
                receipt.partial_pay = _q2(receipt.total)
        return
    await _sync_receipt_status(db, receipt, payments)
