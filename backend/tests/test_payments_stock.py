"""Registrul de plati si stocul: incasarea prin registru misca stocul la fel ca
schimbarea statusului din ecranul bonului.

Regresia pe care o prinde: `add_payment` / `delete_payment` schimbau doar
`pay_method`. Bonul ajungea platit fara nicio miscare SALE, iar readucerea lui
pe Neplatit (sau stergerea) scria SALE_REVERSE — stocul crestea cu cantitatea de
pe bon la fiecare ciclu, fara sa se fi vandut nimic.

Rulabil cu pytest sau direct:  python -m tests.test_payments_stock  (din backend/)
"""
from __future__ import annotations
from decimal import Decimal

from sqlalchemy import select

import app.routers.receipt_payments as router_mod
from app.models.employee import Employee
from app.models.item import ItemType
from app.models.location import Location
from app.models.receipt import PayMethod
from app.models.receipt_payment import PaymentKind, PaymentMethod, ReceiptPayment
from app.models.stock import Stock
from app.models.stock_movement import StockMovement, StockMovementType
from app.schemas.receipt_payment import PaymentCreate
from app.services import payments_service as svc
from app.services.stock import apply_sale_for_receipt, reverse_sale_for_receipt
from tests._harness import (
    add_line, make_account, make_employee, make_item, make_receipt, make_session, run,
)

SALE, REVERSE = StockMovementType.SALE, StockMovementType.SALE_REVERSE

# Handlerul e invelit de rate limiter (slowapi), care cere un Request real;
# testam functia de dedesubt.
_route_add_payment = getattr(router_mod.add_payment, "__wrapped__", router_mod.add_payment)


async def _fixture(**receipt_kw):
    """Bon de 300 lei cu 3 bucati dintr-un produs aflat in stoc (10 buc)."""
    db = await make_session()
    acc = await make_account(db)
    loc = Location(account_id=acc.id, name="Service")
    db.add(loc)
    item = await make_item(db, acc, "Ulei", "100.00")
    emp = await make_employee(db, acc, "Ion")
    db.add(Stock(account_id=acc.id, item_id=item.id, location_id=loc.id, qty=10))
    receipt = await make_receipt(db, acc, "300.00", location_id=loc.id, **receipt_kw)
    line = await add_line(db, receipt, item.name, "100.00", qty=3, item_id=item.id)
    line.account_id = acc.id
    line.item_type = ItemType.PRODUS
    line.employee_id = emp.id
    await db.commit()
    return db, acc, item, emp, receipt


async def _add(db, acc, receipt, kind, amount, method=PaymentMethod.CASH, **kw):
    return await svc.add_payment(
        db, account_id=acc.id, receipt_id=receipt.id,
        kind=kind, amount=Decimal(amount), method=method, **kw,
    )


async def _qty(db, item) -> int:
    return (await db.execute(select(Stock.qty).where(Stock.item_id == item.id))).scalar_one()


async def _movs(db, receipt) -> list[tuple]:
    rows = (await db.execute(
        select(StockMovement.movement_type, StockMovement.qty_delta)
        .where(StockMovement.receipt_id == receipt.id)
        .order_by(StockMovement.id)
    )).all()
    return [(r.movement_type, r.qty_delta) for r in rows]


async def _accumulation(db, emp) -> Decimal:
    value = (await db.execute(
        select(Employee.current_target_accumulation).where(Employee.id == emp.id)
    )).scalar_one()
    return Decimal(str(value or 0))


async def _unlocked(call):
    """Ruleaza un handler de router fara interogarea de eFactura (bonul din test
    nu are inregistrare, deci oricum nu ar fi blocat)."""
    original = router_mod._assert_not_locked

    async def _noop(*_a, **_kw):
        return None

    router_mod._assert_not_locked = _noop
    try:
        return await call()
    finally:
        router_mod._assert_not_locked = original


# ─── Ciclul complet prin registru ─────────────────────────────────────────────

async def test_ledger_cycle_moves_stock_like_the_status_cycle():
    # Referinta: ce face `patch_receipt` pe acelasi drum
    # Neplatit -> Partial -> Platit -> Partial -> Neplatit: scade o data la
    # iesirea din Neplatit si readuce o data la intoarcere.
    rdb, racc, ritem, _, rreceipt = await _fixture()
    await apply_sale_for_receipt(rdb, racc.id, rreceipt)
    await reverse_sale_for_receipt(rdb, racc.id, rreceipt)
    expected_qty, expected_movs = await _qty(rdb, ritem), await _movs(rdb, rreceipt)

    db, acc, item, _, receipt = await _fixture()
    avans, _ = await _add(db, acc, receipt, PaymentKind.AVANS, "100.00")
    assert receipt.pay_method == PayMethod.PARTIAL
    assert await _qty(db, item) == 7, "plata partiala scade deja stocul, ca in patch_receipt"

    plata, _ = await _add(db, acc, receipt, PaymentKind.PLATA, "200.00", PaymentMethod.CARD)
    assert receipt.pay_method == PayMethod.CARD
    assert await _qty(db, item) == 7

    await svc.delete_payment(db, acc.id, receipt.id, plata.id)
    assert receipt.pay_method == PayMethod.PARTIAL
    assert await _qty(db, item) == 7

    await svc.delete_payment(db, acc.id, receipt.id, avans.id)
    assert receipt.pay_method == PayMethod.NEPLATIT
    assert await _qty(db, item) == expected_qty == 10
    assert await _movs(db, receipt) == expected_movs == [(SALE, -3), (REVERSE, 3)]


async def test_repeated_payments_deduct_only_once():
    db, acc, item, _, receipt = await _fixture()
    await _add(db, acc, receipt, PaymentKind.AVANS, "50.00")
    await _add(db, acc, receipt, PaymentKind.AVANS, "50.00")
    await _add(db, acc, receipt, PaymentKind.PLATA, "200.00")
    assert receipt.pay_method == PayMethod.CASH
    assert await _qty(db, item) == 7
    assert await _movs(db, receipt) == [(SALE, -3)]


async def test_reversal_after_ledger_payment_nets_to_zero():
    """Scenariul raportat: incasat integral prin registru, apoi status readus pe
    Neplatit (sau bon sters) — ambele apeleaza `reverse_sale_for_receipt`."""
    db, acc, item, _, receipt = await _fixture()
    await _add(db, acc, receipt, PaymentKind.PLATA, "300.00", PaymentMethod.CARD)
    assert await _qty(db, item) == 7
    await reverse_sale_for_receipt(db, acc.id, receipt)
    assert await _qty(db, item) == 10, "inainte ramanea 13: stornare fara vanzare"


async def test_two_full_cycles_leave_stock_untouched():
    db, acc, item, _, receipt = await _fixture()
    for _ in range(2):
        payment, _s = await _add(db, acc, receipt, PaymentKind.PLATA, "300.00")
        assert await _qty(db, item) == 7
        await svc.delete_payment(db, acc.id, receipt.id, payment.id)
        assert await _qty(db, item) == 10
    assert await _movs(db, receipt) == [(SALE, -3), (REVERSE, 3), (SALE, -3), (REVERSE, 3)]


async def test_full_refund_returns_the_stock():
    db, acc, item, _, receipt = await _fixture()
    await _add(db, acc, receipt, PaymentKind.AVANS, "100.00")
    await _add(db, acc, receipt, PaymentKind.RESTITUIRE, "100.00")
    assert receipt.pay_method == PayMethod.NEPLATIT
    assert await _qty(db, item) == 10
    assert await _movs(db, receipt) == [(SALE, -3), (REVERSE, 3)]


# ─── Date existente ───────────────────────────────────────────────────────────

async def test_legacy_paid_receipt_without_sale_is_not_reversed():
    """Bon ajuns „Platit Partial" inainte de corectie: nu are SALE in jurnal, deci
    intoarcerea pe Neplatit prin registru nu are ce readuce in stoc."""
    db, acc, item, _, receipt = await _fixture(
        pay_method=PayMethod.PARTIAL, partial_pay=Decimal("100.00"),
    )
    await _add(db, acc, receipt, PaymentKind.RESTITUIRE, "100.00")
    assert receipt.pay_method == PayMethod.NEPLATIT
    assert await _qty(db, item) == 10
    assert await _movs(db, receipt) == []


async def test_unpaid_receipt_with_sale_still_applied_is_not_deducted_again():
    """Bon ramas cu SALE dupa ce plata i-a fost stearsa din registru inainte de
    corectie (statusul a revenit pe Neplatit fara stornare)."""
    db, acc, item, _, receipt = await _fixture()
    await apply_sale_for_receipt(db, acc.id, receipt)
    await db.commit()
    assert await _qty(db, item) == 7

    payment, _ = await _add(db, acc, receipt, PaymentKind.AVANS, "100.00")
    assert await _qty(db, item) == 7
    await svc.delete_payment(db, acc.id, receipt.id, payment.id)
    assert await _qty(db, item) == 10
    assert await _movs(db, receipt) == [(SALE, -3), (REVERSE, 3)]


async def test_receipt_without_location_changes_status_and_no_stock():
    db, acc, item, _, receipt = await _fixture()
    receipt.location_id = None
    await db.commit()
    await _add(db, acc, receipt, PaymentKind.PLATA, "300.00")
    assert receipt.pay_method == PayMethod.CASH
    assert await _qty(db, item) == 10
    assert await _movs(db, receipt) == []


# ─── Realinierea dupa schimbarea totalului ────────────────────────────────────

async def test_resync_that_drops_to_unpaid_returns_the_stock():
    db, acc, item, _, receipt = await _fixture()
    await _add(db, acc, receipt, PaymentKind.AVANS, "100.00")
    assert await _qty(db, item) == 7
    # Restituire ajunsa in registru fara recalcularea statusului.
    db.add(ReceiptPayment(
        receipt_id=receipt.id, account_id=acc.id, kind=PaymentKind.RESTITUIRE,
        amount=Decimal("100.00"), method=PaymentMethod.ALTA,
    ))
    await db.flush()
    await svc.resync_after_total_change(db, acc.id, receipt)
    assert receipt.pay_method == PayMethod.NEPLATIT
    assert await _qty(db, item) == 10


# ─── Acumulari si autorul miscarii ────────────────────────────────────────────

async def test_hook_runs_only_when_the_paid_boundary_is_crossed():
    db, acc, _, _, receipt = await _fixture()
    seen: list[PayMethod] = []

    async def hook(_db, r):
        seen.append(r.pay_method)

    first, _ = await _add(db, acc, receipt, PaymentKind.AVANS, "100.00", on_paid_change=hook)
    second, _ = await _add(db, acc, receipt, PaymentKind.PLATA, "200.00", on_paid_change=hook)
    assert seen == [PayMethod.PARTIAL]
    await svc.delete_payment(db, acc.id, receipt.id, second.id, on_paid_change=hook)
    assert seen == [PayMethod.PARTIAL]
    await svc.delete_payment(db, acc.id, receipt.id, first.id, on_paid_change=hook)
    assert seen == [PayMethod.PARTIAL, PayMethod.NEPLATIT]


async def test_router_refreshes_accumulations_and_records_the_actor():
    db, acc, item, emp, receipt = await _fixture()
    assert await _accumulation(db, emp) == Decimal("0")

    body = PaymentCreate(kind=PaymentKind.AVANS, amount=Decimal("100.00"))
    res = await _unlocked(lambda: _route_add_payment(
        request=None, receipt_id=receipt.id, body=body, db=db, account_id=acc.id, actor="casier",
    ))
    assert receipt.pay_method == PayMethod.PARTIAL
    assert await _qty(db, item) == 7
    # Acumularea numara liniile bonului (3 x 100), nu suma incasata.
    assert await _accumulation(db, emp) == Decimal("300.00")

    payment_id = res["payments"][0]["id"]
    await _unlocked(lambda: router_mod.delete_payment(
        receipt.id, payment_id, db=db, account_id=acc.id, actor="casier",
    ))
    assert receipt.pay_method == PayMethod.NEPLATIT
    assert await _qty(db, item) == 10
    assert await _accumulation(db, emp) == Decimal("0")

    actors = (await db.execute(
        select(StockMovement.created_by_user).where(StockMovement.receipt_id == receipt.id)
    )).scalars().all()
    assert actors == ["casier", "casier"]


TESTS = [v for k, v in sorted(globals().items()) if k.startswith("test_")]

if __name__ == "__main__":
    for t in TESTS:
        run(t())
    print(f"OK — {len(TESTS)} scenarii registru de plati + stoc trecute.")
