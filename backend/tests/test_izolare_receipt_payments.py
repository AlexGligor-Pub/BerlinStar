"""Izolare intre conturi in registrul de plati: `employee_id` din body.

Regresia pe care o prinde: POST /receipts/{id}/payments salva orice employee_id,
iar raspunsul (si fiecare GET ulterior al registrului) intorcea `employee_name`
al angajatului — inclusiv al unui angajat din ALT cont.

Rulabil cu pytest sau direct:  python -m tests.test_izolare_receipt_payments  (din backend/)
"""
from __future__ import annotations
from decimal import Decimal

from sqlalchemy import select

from app.models.receipt import PayMethod
from app.models.receipt_payment import PaymentKind, ReceiptPayment
from app.routers.receipt_payments import add_payment, list_payments
from app.schemas.receipt_payment import PaymentCreate
from app.services import payments_service as svc
from tests._harness import make_account, make_employee, make_receipt, make_session, raises_http, run

# Handlerul e invelit de rate limiter (slowapi), care cere un Request real;
# testam functia de dedesubt, ca in restul testelor care apeleaza routerul direct.
_add_payment = getattr(add_payment, "__wrapped__", add_payment)


async def _fixture():
    db = await make_session()
    acc = await make_account(db)
    other = await make_account(db, username="alta", code="alta")
    emp = await make_employee(db, acc, "Ion")
    foreign = await make_employee(db, other, "Strain")
    receipt = await make_receipt(db, acc, "500.00")
    await db.commit()
    return db, acc, other, emp, foreign, receipt


def _body(**kw) -> PaymentCreate:
    base = dict(kind=PaymentKind.AVANS, amount=Decimal("100.00"))
    return PaymentCreate(**{**base, **kw})


async def _add(db, acc, receipt, **kw):
    import app.routers.receipt_payments as mod

    # Bonul nu are inregistrare eFactura in test, deci nu e blocat; evitam totusi
    # interogarea, ca sa nu depindem de tabela de eFactura.
    original = mod._assert_not_locked
    async def _noop(*_a, **_kw): return None
    mod._assert_not_locked = _noop
    try:
        return await _add_payment(
            request=None, receipt_id=receipt.id, body=_body(**kw), db=db, account_id=acc.id,
        )
    finally:
        mod._assert_not_locked = original


async def _stored(db, receipt) -> list[ReceiptPayment]:
    return list((await db.execute(
        select(ReceiptPayment).where(ReceiptPayment.receipt_id == receipt.id)
    )).scalars().all())


async def test_foreign_employee_is_rejected_and_nothing_is_stored():
    db, acc, _, _, foreign, receipt = await _fixture()
    await raises_http(400, _add(db, acc, receipt, employee_id=foreign.id))
    assert await _stored(db, receipt) == []
    assert receipt.pay_method == PayMethod.NEPLATIT and receipt.partial_pay is None
    res = await list_payments(receipt.id, db=db, account_id=acc.id)
    assert res["payments"] == []


async def test_missing_foreign_and_deleted_employee_get_the_same_answer():
    db, acc, _, emp, foreign, receipt = await _fixture()
    d_foreign = await raises_http(400, _add(db, acc, receipt, employee_id=foreign.id))
    d_missing = await raises_http(400, _add(db, acc, receipt, employee_id=99999))
    emp.is_deleted = True
    await db.commit()
    d_deleted = await raises_http(400, _add(db, acc, receipt, employee_id=emp.id))
    assert d_foreign == d_missing == d_deleted
    assert "Strain" not in d_foreign
    assert await _stored(db, receipt) == []


async def test_own_employee_is_stored_and_named():
    db, acc, _, emp, _, receipt = await _fixture()
    res = await _add(db, acc, receipt, employee_id=emp.id)
    assert [(p["employee_id"], p["employee_name"]) for p in res["payments"]] == [(emp.id, "Ion")]
    assert res["summary"].incasat_net == Decimal("100.00")
    assert receipt.pay_method == PayMethod.PARTIAL


async def test_payment_without_employee_still_works():
    db, acc, _, _, _, receipt = await _fixture()
    res = await _add(db, acc, receipt)
    assert [(p["employee_id"], p["employee_name"]) for p in res["payments"]] == [(None, None)]


async def test_foreign_receipt_stays_404_whatever_the_employee():
    db, acc, other, emp, foreign, receipt = await _fixture()
    # Bonul e al lui `acc`; `other` nu il vede, nici cu propriul angajat.
    await raises_http(404, _add(db, other, receipt, employee_id=foreign.id))
    await raises_http(404, _add(db, other, receipt, employee_id=emp.id))
    assert await _stored(db, receipt) == []


async def test_legacy_row_with_deleted_employee_keeps_the_ledger_usable():
    """Registrul nu are PATCH; echivalentul „id-ului vechi neschimbat" e o miscare
    deja salvata cu un angajat sters intre timp: lista si miscarile noi merg."""
    db, acc, _, emp, _, receipt = await _fixture()
    await _add(db, acc, receipt, employee_id=emp.id)
    emp.is_deleted = True
    await db.commit()

    res = await list_payments(receipt.id, db=db, account_id=acc.id)
    assert [p["employee_id"] for p in res["payments"]] == [emp.id]

    res = await _add(db, acc, receipt, kind=PaymentKind.PLATA, amount=Decimal("50.00"))
    assert len(res["payments"]) == 2
    assert res["summary"].incasat_net == Decimal("150.00")


async def test_service_still_accepts_payments_without_employee():
    # Verificarea sta in router; apelantii interni ai serviciului nu trimit employee_id.
    db, acc, _, _, _, receipt = await _fixture()
    payment, summary = await svc.add_payment(
        db, account_id=acc.id, receipt_id=receipt.id,
        kind=PaymentKind.AVANS, amount=Decimal("10.00"), method=svc.PaymentMethod.CASH,
    )
    assert payment.employee_id is None and summary["incasat_net"] == Decimal("10.00")


TESTS = [v for k, v in sorted(globals().items()) if k.startswith("test_")]

if __name__ == "__main__":
    for t in TESTS:
        run(t())
    print(f"OK — {len(TESTS)} scenarii de izolare in registrul de plati trecute.")
