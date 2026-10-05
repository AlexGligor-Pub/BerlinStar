"""Rapoartele top-produse si per-angajat sunt nete de stornari.

Un bon platit si apoi anulat (sau replatit / editat) lasa in jurnal o pereche
SALE + SALE_REVERSE; rapoartele trebuie sa numere doar ce a ramas vandut.

Miscarile sunt scrise direct, cu aceleasi semne ca `services/stock.py`
(SALE: qty_delta negativ, SALE_REVERSE: pozitiv, acelasi bon): serviciul
foloseste INSERT ... ON CONFLICT si FOR UPDATE, specifice Postgres.

Rulabil cu pytest sau direct:  python -m tests.test_stocuri_rapoarte_stornari  (din backend/)
"""
from __future__ import annotations
from decimal import Decimal

from app.models.stock_movement import StockMovement, StockMovementType
from app.routers.stocuri import report_per_angajat, report_top_produse
from tests._harness import make_account, make_employee, make_item, make_receipt, make_session, run

SALE = StockMovementType.SALE
REVERSE = StockMovementType.SALE_REVERSE


async def _fixture():
    db = await make_session()
    acc = await make_account(db)
    emp = await make_employee(db, acc, "Ion")
    item = await make_item(db, acc, "Ulei 5W30", "25.00")
    receipt = await make_receipt(db, acc)
    return db, acc, emp, item, receipt


async def _move(db, acc, item, kind, qty_delta, *, emp=None, receipt=None):
    db.add(StockMovement(
        account_id=acc.id, item_id=item.id, item_name=item.name,
        employee_id=emp.id if emp is not None else None,
        receipt_id=receipt.id if receipt is not None else None,
        movement_type=kind, qty_delta=qty_delta,
        unit_price=Decimal("25.00"), unit_cost=Decimal("10.00"),
    ))
    await db.commit()


async def _top(db, acc):
    return await report_top_produse(location_ids=[], limit=20, db=db, account_id=acc.id)


async def _per(db, acc):
    return await report_per_angajat(location_ids=[], db=db, account_id=acc.id)


def _close(a: float, b: float) -> bool:
    return abs(a - b) < 1e-6


async def test_sale_alone_is_counted():
    db, acc, emp, item, receipt = await _fixture()
    await _move(db, acc, item, SALE, -2, emp=emp, receipt=receipt)

    (top,) = await _top(db, acc)
    assert (top["item_id"], top["qty_total"]) == (item.id, 2)
    assert _close(top["valoare_vanzare"], 50.0) and _close(top["valoare_cost"], 20.0)
    assert _close(top["marja"], 30.0)

    (per,) = await _per(db, acc)
    assert (per["employee_id"], per["employee_name"], per["qty_total"]) == (emp.id, "Ion", 2)
    assert _close(per["valoare"], 50.0)


async def test_sale_then_reversal_contributes_zero():
    db, acc, emp, item, receipt = await _fixture()
    await _move(db, acc, item, SALE, -2, emp=emp, receipt=receipt)
    await _move(db, acc, item, REVERSE, 2, emp=emp, receipt=receipt)

    assert await _top(db, acc) == []
    assert await _per(db, acc) == []


async def test_repaid_receipt_is_counted_once():
    # Platit → neplatit → platit din nou: SALE, SALE_REVERSE, SALE.
    db, acc, emp, item, receipt = await _fixture()
    await _move(db, acc, item, SALE, -2, emp=emp, receipt=receipt)
    await _move(db, acc, item, REVERSE, 2, emp=emp, receipt=receipt)
    await _move(db, acc, item, SALE, -2, emp=emp, receipt=receipt)

    (top,) = await _top(db, acc)
    assert top["qty_total"] == 2
    assert _close(top["valoare_vanzare"], 50.0) and _close(top["valoare_cost"], 20.0)

    (per,) = await _per(db, acc)
    assert per["qty_total"] == 2 and _close(per["valoare"], 50.0)


async def test_edited_paid_receipt_keeps_only_new_quantity():
    # Editarea unui bon platit: reverse pe liniile vechi (3), apply pe cele noi (1).
    db, acc, emp, item, receipt = await _fixture()
    await _move(db, acc, item, SALE, -3, emp=emp, receipt=receipt)
    await _move(db, acc, item, REVERSE, 3, emp=emp, receipt=receipt)
    await _move(db, acc, item, SALE, -1, emp=emp, receipt=receipt)

    (top,) = await _top(db, acc)
    assert top["qty_total"] == 1
    assert _close(top["valoare_vanzare"], 25.0) and _close(top["marja"], 15.0)

    (per,) = await _per(db, acc)
    assert per["qty_total"] == 1 and _close(per["valoare"], 25.0)


async def test_purchase_and_adjustment_are_not_sales():
    db, acc, emp, item, receipt = await _fixture()
    await _move(db, acc, item, StockMovementType.PURCHASE, 10)
    await _move(db, acc, item, StockMovementType.ADJUSTMENT, -4)

    assert await _top(db, acc) == []
    assert await _per(db, acc) == []


async def test_other_account_reversal_does_not_cancel_own_sale():
    db, acc, emp, item, receipt = await _fixture()
    other = await make_account(db, username="alta", code="alta")
    other_item = await make_item(db, other, "Ulei 5W30", "25.00")
    await _move(db, acc, item, SALE, -2, emp=emp, receipt=receipt)
    await _move(db, other, other_item, REVERSE, 2)

    (top,) = await _top(db, acc)
    assert top["qty_total"] == 2
    (per,) = await _per(db, acc)
    assert per["qty_total"] == 2


TESTS = [v for k, v in sorted(globals().items()) if k.startswith("test_")]

if __name__ == "__main__":
    for t in TESTS:
        run(t())
    print(f"OK — {len(TESTS)} scenarii rapoarte stoc (stornari) trecute.")
