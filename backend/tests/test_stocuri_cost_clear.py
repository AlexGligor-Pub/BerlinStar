"""PATCH /api/stocuri/item/{id}: pretul de cumparare se poate sterge.

null trimis explicit goleste `cost_price`; un camp absent il lasa neschimbat.

Rulabil cu pytest sau direct:  python -m tests.test_stocuri_cost_clear  (din backend/)
"""
from __future__ import annotations
from decimal import Decimal

from app.routers.stocuri import patch_item_stoc_meta
from app.schemas.stoc import ItemStocPatch
from tests._harness import make_account, make_item, make_session, run

LOC = 1


async def _fixture(cost: str | None = "12.50", stoc_minim: int = 3):
    db = await make_session()
    acc = await make_account(db)
    item = await make_item(db, acc, "Ulei 5W30", "40.00")
    item.cost_price = Decimal(cost) if cost is not None else None
    item.stoc_minim = stoc_minim
    await db.commit()
    return db, acc, item


async def _patch(db, acc, item, payload: dict):
    # model_validate pe dict = exact ce face FastAPI cu body-ul JSON.
    body = ItemStocPatch.model_validate(payload)
    return await patch_item_stoc_meta(item.id, body, location_id=LOC, db=db, account_id=acc.id)


async def test_explicit_null_clears_cost_price():
    db, acc, item = await _fixture()
    row = await _patch(db, acc, item, {"cost_price": None})
    assert row.cost_price is None
    await db.refresh(item)
    assert item.cost_price is None
    assert item.stoc_minim == 3


async def test_omitted_cost_price_is_kept():
    db, acc, item = await _fixture()
    row = await _patch(db, acc, item, {"stoc_minim": 7})
    assert (row.cost_price, row.stoc_minim) == (Decimal("12.50"), 7)
    row = await _patch(db, acc, item, {})
    assert (row.cost_price, row.stoc_minim) == (Decimal("12.50"), 7)
    await db.refresh(item)
    assert item.cost_price == Decimal("12.50")


async def test_value_updates_cost_price():
    db, acc, item = await _fixture()
    row = await _patch(db, acc, item, {"cost_price": 9.99})
    assert row.cost_price == Decimal("9.99")
    row = await _patch(db, acc, item, {"cost_price": 0})
    assert row.cost_price == Decimal("0")
    await db.refresh(item)
    assert item.cost_price == Decimal("0")


async def test_value_sets_cost_price_when_unknown():
    db, acc, item = await _fixture(cost=None)
    row = await _patch(db, acc, item, {"cost_price": "15.00"})
    assert row.cost_price == Decimal("15.00")


async def test_null_stoc_minim_is_ignored():
    db, acc, item = await _fixture()
    row = await _patch(db, acc, item, {"stoc_minim": None})
    assert (row.cost_price, row.stoc_minim) == (Decimal("12.50"), 3)


TESTS = [v for k, v in sorted(globals().items()) if k.startswith("test_")]

if __name__ == "__main__":
    for t in TESTS:
        run(t())
    print(f"OK — {len(TESTS)} scenarii PATCH stoc (pret cumparare) trecute.")
