"""Izolare intre conturi in miscarile de stoc generate de bonuri.

`ReceiptItem.item_id` si `employee_id` vin din body-ul bonului. Serviciul de stoc
nu are voie sa copieze costul articolului altui cont, sa creeze stoc pentru el
sau sa lege miscarea de angajatul altui cont.

Rulabil cu pytest sau direct:  python -m tests.test_izolare_stock  (din backend/)
"""
from __future__ import annotations
from decimal import Decimal

from sqlalchemy import select

from app.models.item import ItemType
from app.models.location import Location
from app.models.stock import Stock
from app.models.stock_movement import StockMovement, StockMovementType
from app.services.stock import apply_sale_for_receipt, reverse_sale_for_receipt
from tests._harness import (
    add_line, make_account, make_employee, make_item, make_receipt, make_session, run,
)


async def _fixture():
    db = await make_session()
    acc = await make_account(db)
    other = await make_account(db, username="alta", code="alta")
    loc = Location(account_id=acc.id, name="Service")
    db.add(loc)
    own = await make_item(db, acc, "Ulei", "100.00")
    own.cost_price = Decimal("40.00")
    foreign = await make_item(db, other, "Filtru strain", "100.00")
    foreign.cost_price = Decimal("77.00")
    await db.flush()
    receipt = await make_receipt(db, acc, location_id=loc.id)
    return db, acc, other, loc, own, foreign, receipt


async def _line(db, acc, receipt, item, qty=1, employee=None):
    line = await add_line(db, receipt, item.name, "100.00", qty=qty, item_id=item.id)
    line.account_id = acc.id
    line.item_type = ItemType.PRODUS
    line.employee_id = employee.id if employee is not None else None
    await db.flush()
    return line


async def _stocks(db) -> dict[int, tuple[int, int]]:
    """item_id -> (account_id, qty) pentru toate randurile de stoc."""
    rows = (await db.execute(select(Stock.item_id, Stock.account_id, Stock.qty))).all()
    return {r.item_id: (r.account_id, r.qty) for r in rows}


async def _movements(db):
    return (await db.execute(
        select(
            StockMovement.item_id, StockMovement.movement_type, StockMovement.qty_delta,
            StockMovement.unit_cost, StockMovement.employee_id, StockMovement.account_id,
        ).order_by(StockMovement.id)
    )).all()


async def test_sale_own_item_moves_stock_and_logs_cost():
    db, acc, _, _, own, _, receipt = await _fixture()
    await _line(db, acc, receipt, own, qty=2)
    await apply_sale_for_receipt(db, acc.id, receipt)
    assert await _stocks(db) == {own.id: (acc.id, -2)}
    (mv,) = await _movements(db)
    assert (mv.item_id, mv.movement_type, mv.qty_delta) == (own.id, StockMovementType.SALE, -2)
    assert mv.unit_cost == Decimal("40.00") and mv.account_id == acc.id


async def test_sale_foreign_item_stores_nothing():
    db, acc, _, _, _, foreign, receipt = await _fixture()
    await _line(db, acc, receipt, foreign, qty=3)
    await apply_sale_for_receipt(db, acc.id, receipt)
    assert await _stocks(db) == {}
    assert await _movements(db) == []


async def test_sale_mixed_lines_keeps_only_own_item():
    db, acc, _, _, own, foreign, receipt = await _fixture()
    await _line(db, acc, receipt, own, qty=1)
    await _line(db, acc, receipt, foreign, qty=5)
    await apply_sale_for_receipt(db, acc.id, receipt)
    assert await _stocks(db) == {own.id: (acc.id, -1)}
    (mv,) = await _movements(db)
    assert mv.item_id == own.id and mv.unit_cost == Decimal("40.00")


async def test_reverse_own_item_restores_stock_and_logs_cost():
    db, acc, _, _, own, _, receipt = await _fixture()
    await _line(db, acc, receipt, own, qty=2)
    await apply_sale_for_receipt(db, acc.id, receipt)
    await reverse_sale_for_receipt(db, acc.id, receipt)
    assert await _stocks(db) == {own.id: (acc.id, 0)}
    sale, rev = await _movements(db)
    assert sale.movement_type == StockMovementType.SALE
    assert (rev.movement_type, rev.qty_delta) == (StockMovementType.SALE_REVERSE, 2)
    assert rev.unit_cost == Decimal("40.00")


async def test_reverse_foreign_item_stores_nothing():
    db, acc, _, _, _, foreign, receipt = await _fixture()
    await _line(db, acc, receipt, foreign, qty=3)
    await reverse_sale_for_receipt(db, acc.id, receipt)
    assert await _stocks(db) == {}
    assert await _movements(db) == []


async def test_foreign_employee_is_dropped_own_employee_is_kept():
    db, acc, other, _, own, _, receipt = await _fixture()
    emp = await make_employee(db, acc, "Ion")
    strain = await make_employee(db, other, "Strain")
    await _line(db, acc, receipt, own, qty=1, employee=emp)
    await _line(db, acc, receipt, own, qty=1, employee=strain)
    await apply_sale_for_receipt(db, acc.id, receipt)
    await reverse_sale_for_receipt(db, acc.id, receipt)
    mvs = await _movements(db)
    assert [m.employee_id for m in mvs] == [emp.id, None, emp.id, None]
    assert await _stocks(db) == {own.id: (acc.id, 0)}


async def test_legacy_deleted_item_and_employee_still_work():
    """Un bon vechi, cu articolul si angajatul sterse intre timp, se plateste si se storneaza ca inainte."""
    db, acc, _, _, own, _, receipt = await _fixture()
    emp = await make_employee(db, acc, "Ion")
    await _line(db, acc, receipt, own, qty=2, employee=emp)
    own.is_deleted = True
    emp.is_deleted = True
    await db.flush()
    await apply_sale_for_receipt(db, acc.id, receipt)
    await reverse_sale_for_receipt(db, acc.id, receipt)
    assert await _stocks(db) == {own.id: (acc.id, 0)}
    mvs = await _movements(db)
    assert [(m.qty_delta, m.unit_cost, m.employee_id) for m in mvs] == [
        (-2, Decimal("40.00"), emp.id), (2, Decimal("40.00"), emp.id),
    ]


TESTS = [v for k, v in sorted(globals().items()) if k.startswith("test_")]

if __name__ == "__main__":
    for t in TESTS:
        run(t())
    print(f"OK — {len(TESTS)} scenarii izolare stoc trecute.")
