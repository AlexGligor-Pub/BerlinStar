"""Izolare intre conturi la categorii: department_id trebuie sa fie al contului.

Rulabil cu pytest sau direct:  python -m tests.test_izolare_categories  (din backend/)
"""
from __future__ import annotations

from sqlalchemy import func, select

from app.models.category import Category
from app.models.department import Department
from app.routers.categories import create_category, patch_category, update_category
from app.schemas.category import CategoryCreate, CategoryUpdate
from tests._harness import make_account, make_session, raises_http, run


async def _dept(db, account, name: str) -> Department:
    dept = Department(account_id=account.id, name=name)
    db.add(dept)
    await db.flush()
    return dept


async def _fixture():
    db = await make_session()
    acc = await make_account(db)
    other = await make_account(db, username="alta", code="alta")
    own = await _dept(db, acc, "Auto")
    own2 = await _dept(db, acc, "Vulcanizare")
    foreign = await _dept(db, other, "Strain")
    await db.commit()
    return db, acc, own, own2, foreign


async def _count(db, account) -> int:
    return await db.scalar(
        select(func.count()).select_from(Category).where(Category.account_id == account.id)
    )


async def _stored_department(db, category_id: int) -> int:
    return await db.scalar(select(Category.department_id).where(Category.id == category_id))


async def _soft_delete_department(db, dept: Department) -> None:
    dept.is_deleted = True
    await db.commit()


async def test_create_with_own_department_works():
    db, acc, own, *_ = await _fixture()
    cat = await create_category(CategoryCreate(name="Jante", department_id=own.id), db=db, account_id=acc.id)
    assert (cat.account_id, cat.department_id, cat.name) == (acc.id, own.id, "Jante")


async def test_create_rejects_foreign_missing_or_deleted_department():
    db, acc, own, _, foreign = await _fixture()
    d1 = await raises_http(400, create_category(
        CategoryCreate(name="A", department_id=foreign.id), db=db, account_id=acc.id))
    d2 = await raises_http(400, create_category(
        CategoryCreate(name="B", department_id=99999), db=db, account_id=acc.id))
    await _soft_delete_department(db, own)
    d3 = await raises_http(400, create_category(
        CategoryCreate(name="C", department_id=own.id), db=db, account_id=acc.id))
    # Acelasi raspuns: nu se poate deduce daca id-ul exista in alt cont.
    assert d1 == d2 == d3 == "Departamentul nu exista."
    assert await _count(db, acc) == 0


async def test_put_changes_to_own_department():
    db, acc, own, own2, _ = await _fixture()
    cat = await create_category(CategoryCreate(name="Jante", department_id=own.id), db=db, account_id=acc.id)
    cat = await update_category(
        cat.id, CategoryCreate(name="Jante aliaj", department_id=own2.id), db=db, account_id=acc.id)
    assert (cat.name, cat.department_id) == ("Jante aliaj", own2.id)


async def test_put_rejects_foreign_or_missing_department_and_keeps_previous():
    db, acc, own, _, foreign = await _fixture()
    cat = await create_category(CategoryCreate(name="Jante", department_id=own.id), db=db, account_id=acc.id)
    d1 = await raises_http(400, update_category(
        cat.id, CategoryCreate(name="Furat", department_id=foreign.id), db=db, account_id=acc.id))
    d2 = await raises_http(400, update_category(
        cat.id, CategoryCreate(name="Furat", department_id=99999), db=db, account_id=acc.id))
    assert d1 == d2
    assert await _stored_department(db, cat.id) == own.id
    assert await db.scalar(select(Category.name).where(Category.id == cat.id)) == "Jante"


async def test_put_unchanged_legacy_department_still_works():
    db, acc, own, *_ = await _fixture()
    cat = await create_category(CategoryCreate(name="Jante", department_id=own.id), db=db, account_id=acc.id)
    await _soft_delete_department(db, own)
    cat = await update_category(
        cat.id, CategoryCreate(name="Jante vechi", department_id=own.id), db=db, account_id=acc.id)
    assert (cat.name, cat.department_id) == ("Jante vechi", own.id)


async def test_patch_changes_to_own_department():
    db, acc, own, own2, _ = await _fixture()
    cat = await create_category(CategoryCreate(name="Jante", department_id=own.id), db=db, account_id=acc.id)
    cat = await patch_category(cat.id, CategoryUpdate(department_id=own2.id), db=db, account_id=acc.id)
    assert (cat.name, cat.department_id) == ("Jante", own2.id)


async def test_patch_rejects_foreign_missing_or_deleted_department_and_keeps_previous():
    db, acc, own, own2, foreign = await _fixture()
    cat = await create_category(CategoryCreate(name="Jante", department_id=own.id), db=db, account_id=acc.id)
    d1 = await raises_http(400, patch_category(
        cat.id, CategoryUpdate(name="Furat", department_id=foreign.id), db=db, account_id=acc.id))
    d2 = await raises_http(400, patch_category(
        cat.id, CategoryUpdate(department_id=99999), db=db, account_id=acc.id))
    await _soft_delete_department(db, own2)
    d3 = await raises_http(400, patch_category(
        cat.id, CategoryUpdate(department_id=own2.id), db=db, account_id=acc.id))
    assert d1 == d2 == d3
    assert await _stored_department(db, cat.id) == own.id
    assert await db.scalar(select(Category.name).where(Category.id == cat.id)) == "Jante"


async def test_patch_unchanged_legacy_department_still_works():
    db, acc, own, *_ = await _fixture()
    cat = await create_category(CategoryCreate(name="Jante", department_id=own.id), db=db, account_id=acc.id)
    await _soft_delete_department(db, own)
    # Acelasi id retrimis, apoi fara department_id deloc: ambele trebuie sa treaca.
    cat = await patch_category(
        cat.id, CategoryUpdate(name="Jante vechi", department_id=own.id), db=db, account_id=acc.id)
    assert (cat.name, cat.department_id) == ("Jante vechi", own.id)
    cat = await patch_category(cat.id, CategoryUpdate(name="Doar nume"), db=db, account_id=acc.id)
    assert (cat.name, cat.department_id) == ("Doar nume", own.id)


async def test_patch_explicit_null_department_is_ignored():
    db, acc, own, *_ = await _fixture()
    cat = await create_category(CategoryCreate(name="Jante", department_id=own.id), db=db, account_id=acc.id)
    cat = await patch_category(
        cat.id, CategoryUpdate(name="Redenumit", department_id=None), db=db, account_id=acc.id)
    assert (cat.name, cat.department_id) == ("Redenumit", own.id)


async def test_foreign_category_cannot_be_edited():
    db, acc, own, _, foreign = await _fixture()
    theirs = Category(account_id=foreign.account_id, name="A lor", department_id=foreign.id)
    db.add(theirs)
    await db.commit()
    await raises_http(404, patch_category(
        theirs.id, CategoryUpdate(department_id=own.id), db=db, account_id=acc.id))
    await raises_http(404, update_category(
        theirs.id, CategoryCreate(name="X", department_id=own.id), db=db, account_id=acc.id))
    assert await _stored_department(db, theirs.id) == foreign.id


TESTS = [v for k, v in sorted(globals().items()) if k.startswith("test_")]

if __name__ == "__main__":
    for t in TESTS:
        run(t())
    print(f"OK — {len(TESTS)} scenarii izolare categorii trecute.")
