"""Izolare intre conturi la articolele de catalog: `category_id` primit de la client.

Regresia pe care o prinde: POST/PUT/PATCH /api/items salvau orice `category_id`,
inclusiv al altui cont, iar lista de articole si rapoartele intorceau apoi numele
categoriei (si departamentul) acelui cont.

Rulabil cu pytest sau direct:  python -m tests.test_izolare_items  (din backend/)
"""
from __future__ import annotations
from decimal import Decimal

from sqlalchemy import func, select, update

from app.models.category import Category
from app.models.department import Department
from app.models.item import Item
from app.routers.items import create_item, patch_item, update_item
from app.schemas.item import ItemCreate, ItemUpdate
from tests._harness import make_account, make_item, make_session, raises_http, run


async def _category(db, acc, name: str) -> Category:
    dept = Department(account_id=acc.id, name=f"Dept {name}")
    db.add(dept)
    await db.flush()
    cat = Category(account_id=acc.id, name=name, department_id=dept.id)
    db.add(cat)
    await db.flush()
    return cat


async def _fixture():
    db = await make_session()
    acc = await make_account(db)
    other = await make_account(db, username="alta", code="alta")
    item = await make_item(db, acc, "Ulei", "50.00")
    cat2 = await _category(db, acc, "Anvelope")
    foreign = await _category(db, other, "Categorie Straina")
    await db.commit()
    return db, acc, other, item, cat2, foreign


def _body(category_id: int, **kw) -> ItemCreate:
    base = dict(name="Filtru", price=Decimal("30.00"), unit="buc", category_id=category_id)
    return ItemCreate(**{**base, **kw})


async def _soft_delete_category(db, category_id: int) -> None:
    await db.execute(update(Category).where(Category.id == category_id).values(is_deleted=True))
    await db.commit()


async def _stored(db, item_id: int) -> tuple:
    return tuple((await db.execute(
        select(Item.name, Item.category_id).where(Item.id == item_id)
    )).one())


async def _count_items(db) -> int:
    return (await db.execute(select(func.count()).select_from(Item))).scalar_one()


# ─── POST ─────────────────────────────────────────────────────────────────────

async def test_create_rejects_foreign_missing_or_deleted_category():
    db, acc, _, _, cat2, foreign = await _fixture()
    before = await _count_items(db)
    strain = await raises_http(400, create_item(_body(foreign.id), db=db, account_id=acc.id))
    lipsa = await raises_http(400, create_item(_body(99999), db=db, account_id=acc.id))
    # Acelasi raspuns: nu se poate afla daca id-ul exista in alt cont.
    assert strain == lipsa == "Categoria nu exista."
    await _soft_delete_category(db, cat2.id)
    await raises_http(400, create_item(_body(cat2.id), db=db, account_id=acc.id))
    assert await _count_items(db) == before


async def test_create_with_own_category_works():
    db, acc, _, _, cat2, _ = await _fixture()
    created = await create_item(_body(cat2.id), db=db, account_id=acc.id)
    assert (created.account_id, created.category_id) == (acc.id, cat2.id)
    assert await _stored(db, created.id) == ("Filtru", cat2.id)


# ─── PUT ──────────────────────────────────────────────────────────────────────

async def test_put_rejects_foreign_or_missing_category_and_stores_nothing():
    db, acc, _, item, _, foreign = await _fixture()
    before = await _stored(db, item.id)
    await raises_http(400, update_item(item.id, _body(foreign.id, name="Furat"), db=db, account_id=acc.id))
    await raises_http(400, update_item(item.id, _body(99999, name="Furat"), db=db, account_id=acc.id))
    assert await _stored(db, item.id) == before


async def test_put_moves_to_own_category():
    db, acc, _, item, cat2, _ = await _fixture()
    await update_item(item.id, _body(cat2.id, name="Ulei 5W30"), db=db, account_id=acc.id)
    assert await _stored(db, item.id) == ("Ulei 5W30", cat2.id)


async def test_put_keeps_unchanged_legacy_category():
    db, acc, _, item, _, _ = await _fixture()
    legacy = item.category_id
    await _soft_delete_category(db, legacy)
    await update_item(item.id, _body(legacy, name="Ulei nou"), db=db, account_id=acc.id)
    assert await _stored(db, item.id) == ("Ulei nou", legacy)


# ─── PATCH ────────────────────────────────────────────────────────────────────

async def test_patch_rejects_foreign_or_missing_category_and_stores_nothing():
    db, acc, _, item, _, foreign = await _fixture()
    before = await _stored(db, item.id)
    await raises_http(400, patch_item(
        item.id, ItemUpdate(name="Furat", category_id=foreign.id), db=db, account_id=acc.id,
    ))
    await raises_http(400, patch_item(
        item.id, ItemUpdate(name="Furat", category_id=99999), db=db, account_id=acc.id,
    ))
    assert await _stored(db, item.id) == before


async def test_patch_moves_to_own_category():
    db, acc, _, item, cat2, _ = await _fixture()
    await patch_item(item.id, ItemUpdate(category_id=cat2.id), db=db, account_id=acc.id)
    assert await _stored(db, item.id) == ("Ulei", cat2.id)


async def test_patch_keeps_unchanged_legacy_category():
    db, acc, _, item, _, _ = await _fixture()
    legacy = item.category_id
    await _soft_delete_category(db, legacy)
    # Fara category_id si cu acelasi category_id: ambele trebuie sa mearga in continuare.
    await patch_item(item.id, ItemUpdate(name="Ulei A"), db=db, account_id=acc.id)
    await patch_item(item.id, ItemUpdate(name="Ulei B", category_id=legacy), db=db, account_id=acc.id)
    assert await _stored(db, item.id) == ("Ulei B", legacy)


async def test_patch_item_of_other_account_stays_404():
    db, _, other, item, _, foreign = await _fixture()
    legacy = item.category_id
    await raises_http(404, patch_item(
        item.id, ItemUpdate(category_id=foreign.id), db=db, account_id=other.id,
    ))
    assert await _stored(db, item.id) == ("Ulei", legacy)


TESTS = [v for k, v in sorted(globals().items()) if k.startswith("test_")]

if __name__ == "__main__":
    for t in TESTS:
        run(t())
    print(f"OK — {len(TESTS)} scenarii izolare articole trecute.")
