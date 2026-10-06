"""Rapoartele top-produse si per-angajat sunt nete de stornari.

Un bon platit si apoi anulat (sau replatit / editat) lasa in jurnal o pereche
SALE + SALE_REVERSE; rapoartele trebuie sa numere doar ce a ramas vandut.

Miscarile sunt scrise direct, cu aceleasi semne ca `services/stock.py`
(SALE: qty_delta negativ, SALE_REVERSE: pozitiv, acelasi bon): serviciul
foloseste INSERT ... ON CONFLICT si FOR UPDATE, specifice Postgres.

Rulabil cu pytest sau direct:  python -m tests.test_stocuri_rapoarte_stornari  (din backend/)
"""
from __future__ import annotations
from datetime import datetime, timezone
from decimal import Decimal

from app.models.item import Item, ItemType
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


async def _move(db, acc, item, kind, qty_delta, *, emp=None, receipt=None, at=None):
    extra = {"created_at": at} if at is not None else {}
    db.add(StockMovement(
        account_id=acc.id, item_id=item.id, item_name=item.name,
        employee_id=emp.id if emp is not None else None,
        receipt_id=receipt.id if receipt is not None else None,
        movement_type=kind, qty_delta=qty_delta,
        unit_price=Decimal("25.00"), unit_cost=Decimal("10.00"),
        **extra,
    ))
    await db.commit()


async def _top(db, acc, **period):
    return await report_top_produse(**period, location_ids=[], limit=20, db=db, account_id=acc.id)


async def _per(db, acc, **period):
    return await report_per_angajat(**period, location_ids=[], db=db, account_id=acc.id)


# Miezul zilei, UTC: departe de capetele de luna in ora Romaniei.
SEPT_SALE = datetime(2026, 9, 20, 12, 0, tzinfo=timezone.utc)
OCT_SALE = datetime(2026, 10, 3, 12, 0, tzinfo=timezone.utc)
OCT_REVERSE = datetime(2026, 10, 5, 12, 0, tzinfo=timezone.utc)
SEPTEMBER = dict(date_from=datetime(2026, 9, 1), date_to=datetime(2026, 9, 30, 23, 59, 59))
OCTOBER = dict(date_from=datetime(2026, 10, 1), date_to=datetime(2026, 10, 31, 23, 59, 59))


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


async def test_reversal_of_earlier_period_sale_shows_no_negative_row():
    # Vandut in septembrie, anulat in octombrie: octombrie contine doar stornarea.
    db, acc, emp, item, receipt = await _fixture()
    await _move(db, acc, item, SALE, -2, emp=emp, receipt=receipt, at=SEPT_SALE)
    await _move(db, acc, item, REVERSE, 2, emp=emp, receipt=receipt, at=OCT_REVERSE)

    assert await _top(db, acc, **OCTOBER) == []
    assert await _per(db, acc, **OCTOBER) == []

    # Septembrie ramane cum a fost inchis: vanzarea se vede.
    (top,) = await _top(db, acc, **SEPTEMBER)
    assert top["qty_total"] == 2 and _close(top["valoare_vanzare"], 50.0)
    (per,) = await _per(db, acc, **SEPTEMBER)
    assert per["qty_total"] == 2 and _close(per["valoare"], 50.0)

    # Pe tot istoricul perechea se anuleaza.
    assert await _top(db, acc) == []
    assert await _per(db, acc) == []


async def test_orphan_reversal_is_not_a_negative_sale():
    # Stornare fara nicio vanzare (jurnal vechi / dublata): nu apare ca vanzare negativa.
    db, acc, emp, item, receipt = await _fixture()
    await _move(db, acc, item, REVERSE, 3, emp=emp, receipt=receipt)

    assert await _top(db, acc) == []
    assert await _per(db, acc) == []


async def test_negative_net_item_is_dropped_without_touching_other_rows():
    db, acc, emp, item, receipt = await _fixture()
    # Direct, nu prin make_item: acela ar crea a doua oara departamentul „Auto",
    # unic pe cont.
    other_item = Item(
        account_id=acc.id, name="Filtru ulei", price=Decimal("25.00"), unit="buc",
        type=ItemType.PRODUS, category_id=item.category_id,
    )
    db.add(other_item)
    await db.flush()
    other_emp = await make_employee(db, acc, "Ana")
    # `item`: doar stornarea cade in octombrie. `other_item`: vanzare curata in octombrie.
    await _move(db, acc, item, SALE, -2, emp=emp, receipt=receipt, at=SEPT_SALE)
    await _move(db, acc, item, REVERSE, 2, emp=emp, receipt=receipt, at=OCT_REVERSE)
    await _move(db, acc, other_item, SALE, -3, emp=other_emp, at=OCT_SALE)

    top = await _top(db, acc, **OCTOBER)
    assert [(r["item_id"], r["qty_total"]) for r in top] == [(other_item.id, 3)]
    assert _close(top[0]["valoare_vanzare"], 75.0) and _close(top[0]["marja"], 45.0)

    per = await _per(db, acc, **OCTOBER)
    assert [(r["employee_id"], r["item_id"], r["qty_total"]) for r in per] == [(other_emp.id, other_item.id, 3)]
    assert _close(per[0]["valoare"], 75.0)


async def test_partial_reversal_in_period_keeps_positive_net():
    # Doua bonuri in octombrie, unul anulat tot in octombrie: ramane net pozitiv.
    db, acc, emp, item, receipt = await _fixture()
    second = await make_receipt(db, acc)
    await _move(db, acc, item, SALE, -2, emp=emp, receipt=receipt, at=OCT_SALE)
    await _move(db, acc, item, SALE, -3, emp=emp, receipt=second, at=OCT_SALE)
    await _move(db, acc, item, REVERSE, 2, emp=emp, receipt=receipt, at=OCT_REVERSE)

    (top,) = await _top(db, acc, **OCTOBER)
    assert top["qty_total"] == 3
    assert _close(top["valoare_vanzare"], 75.0) and _close(top["valoare_cost"], 30.0)
    (per,) = await _per(db, acc, **OCTOBER)
    assert per["qty_total"] == 3 and _close(per["valoare"], 75.0)


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
