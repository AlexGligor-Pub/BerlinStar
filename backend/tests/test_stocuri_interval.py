"""Capetele de interval din Stocuri (miscari, top-produse, per-angajat).

Valorile fara fus orar sunt ora Romaniei; capatul de sus acopera toata ultima
secunda, ca o miscare de la 23:59:59.4 sa nu dispara din ambele zile.

Rulabil cu pytest sau direct:  python -m tests.test_stocuri_interval  (din backend/)
"""
from __future__ import annotations
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from app.models.stock_movement import StockMovement, StockMovementType
from app.routers.stocuri import (
    _as_end_instant, _as_instant, list_miscari, report_per_angajat, report_top_produse,
)
from tests._harness import make_account, make_item, make_session, run

UTC = timezone.utc


async def test_naive_start_is_local_midnight_eest():
    # 5 octombrie: ora de vara, UTC+3.
    assert _as_instant(datetime(2026, 10, 5)) == datetime(2026, 10, 4, 21, 0, tzinfo=UTC)


async def test_naive_start_is_local_midnight_eet():
    # 1 decembrie: ora de iarna, UTC+2.
    assert _as_instant(datetime(2026, 12, 1)) == datetime(2026, 11, 30, 22, 0, tzinfo=UTC)


async def test_naive_end_covers_whole_last_second_eest():
    got = _as_end_instant(datetime(2026, 10, 5, 23, 59, 59))
    assert got == datetime(2026, 10, 5, 20, 59, 59, 999999, tzinfo=UTC)
    # Ziua urmatoare incepe exact dupa: nicio miscare in ambele zile sau in niciuna.
    assert _as_instant(datetime(2026, 10, 6)) - got == timedelta(microseconds=1)


async def test_naive_end_covers_whole_last_second_eet():
    got = _as_end_instant(datetime(2026, 12, 1, 23, 59, 59))
    assert got == datetime(2026, 12, 1, 21, 59, 59, 999999, tzinfo=UTC)


async def test_naive_end_with_microseconds_is_exact():
    got = _as_end_instant(datetime(2026, 10, 5, 12, 0, 0, 250000))
    assert got == datetime(2026, 10, 5, 9, 0, 0, 250000, tzinfo=UTC)


async def test_aware_input_is_unchanged():
    aware = datetime(2026, 10, 5, 23, 59, 59, tzinfo=UTC)
    assert _as_instant(aware) is aware
    assert _as_end_instant(aware) is aware
    assert _as_end_instant(aware).microsecond == 0


async def test_none_stays_none():
    assert _as_instant(None) is None
    assert _as_end_instant(None) is None


async def test_movement_in_last_second_belongs_to_that_day_only():
    db = await make_session()
    acc = await make_account(db)
    item = await make_item(db, acc, "Ulei 5W30", "25.00")
    # 23:59:59.4 ora Romaniei, pe 5 octombrie.
    db.add(StockMovement(
        account_id=acc.id, item_id=item.id, item_name=item.name,
        movement_type=StockMovementType.SALE, qty_delta=-2,
        unit_price=Decimal("25.00"), unit_cost=Decimal("10.00"),
        created_at=datetime(2026, 10, 5, 20, 59, 59, 400000, tzinfo=UTC),
    ))
    await db.commit()

    day = dict(date_from=datetime(2026, 10, 5), date_to=datetime(2026, 10, 5, 23, 59, 59))
    next_day = dict(date_from=datetime(2026, 10, 6), date_to=datetime(2026, 10, 6, 23, 59, 59))

    assert len(await list_miscari(**day, limit=200, db=db, account_id=acc.id)) == 1
    assert await list_miscari(**next_day, limit=200, db=db, account_id=acc.id) == []

    top = await report_top_produse(**day, location_ids=[], limit=20, db=db, account_id=acc.id)
    assert [r["qty_total"] for r in top] == [2]
    assert await report_top_produse(**next_day, location_ids=[], limit=20, db=db, account_id=acc.id) == []

    per = await report_per_angajat(**day, location_ids=[], db=db, account_id=acc.id)
    assert [r["qty_total"] for r in per] == [2]
    assert await report_per_angajat(**next_day, location_ids=[], db=db, account_id=acc.id) == []


TESTS = [v for k, v in sorted(globals().items()) if k.startswith("test_")]

if __name__ == "__main__":
    for t in TESTS:
        run(t())
    print(f"OK — {len(TESTS)} scenarii interval stocuri trecute.")
