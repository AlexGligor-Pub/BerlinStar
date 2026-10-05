"""Izolare intre conturi in zona Stocuri: `location_id` primit de la client si
numele angajatului din jurnalul de miscari.

Regresiile pe care le prinde:
- PATCH /api/stocuri/item/{id} nu verifica deloc `location_id` din query;
- intrarea si ajustarea de stoc acceptau o locatie stearsa;
- GET /api/stocuri/miscari si raportul per angajat legau angajatul doar pe id, asa
  ca o miscare cu employee_id din ALT cont intorcea numele acelui angajat;
- un produs vechi cu `category_id` din ALT cont (sau cu categoria proprie legata de
  departamentul altui cont) intorcea numele categoriei / departamentului de acolo.

Rulabil cu pytest sau direct:  python -m tests.test_izolare_stocuri  (din backend/)
"""
from __future__ import annotations
from decimal import Decimal

from sqlalchemy import func, select, update

from app.models.category import Category
from app.models.department import Department
from app.models.item import Item, ItemType
from app.models.location import Location
from app.models.stock import Stock
from app.models.stock_movement import StockMovement, StockMovementType
from app.routers.stocuri import (
    ajustare_stoc, intrare_stoc, list_miscari, list_stocuri, patch_item_stoc_meta,
    report_per_angajat,
)
from app.schemas.stoc import AjustareStocCreate, IntrareStocCreate, ItemStocPatch
from tests._harness import make_account, make_employee, make_item, make_session, raises_http, run


async def _location(db, acc, name: str) -> Location:
    loc = Location(account_id=acc.id, name=name)
    db.add(loc)
    await db.flush()
    return loc


async def _fixture():
    db = await make_session()
    acc = await make_account(db)
    other = await make_account(db, username="alta", code="alta")
    item = await make_item(db, acc, "Ulei", "50.00")
    loc = await _location(db, acc, "Sediu")
    foreign_loc = await _location(db, other, "Strain")
    emp = await make_employee(db, acc, "Ion")
    foreign_emp = await make_employee(db, other, "Angajat Strain")
    await db.commit()
    return db, acc, other, item, loc, foreign_loc, emp, foreign_emp


async def _soft_delete_location(db, loc) -> None:
    await db.execute(update(Location).where(Location.id == loc.id).values(is_deleted=True))
    await db.commit()


async def _item_meta(db, item) -> tuple:
    return tuple((await db.execute(
        select(Item.cost_price, Item.stoc_minim).where(Item.id == item.id)
    )).one())


async def _count(db, model) -> int:
    return (await db.execute(select(func.count()).select_from(model))).scalar_one()


async def _patch(db, acc, item_id: int, location_id: int, **kw):
    return await patch_item_stoc_meta(
        item_id, ItemStocPatch(**kw), location_id=location_id, db=db, account_id=acc.id,
    )


async def _sale(db, acc, item, loc, employee_id: int | None, qty: int = 2) -> None:
    """Miscare de vanzare salvata direct, ca una venita dintr-un bon."""
    db.add(StockMovement(
        account_id=acc.id, item_id=item.id, item_name=item.name, location_id=loc.id,
        employee_id=employee_id, movement_type=StockMovementType.SALE,
        qty_delta=-qty, unit_price=Decimal("50.00"), unit_cost=Decimal("30.00"),
    ))
    await db.commit()


# ─── PATCH /api/stocuri/item/{id} ─────────────────────────────────────────────

async def test_patch_rejects_foreign_location_and_stores_nothing():
    db, acc, _, item, _, foreign_loc, *_ = await _fixture()
    before = await _item_meta(db, item)
    detail = await raises_http(404, _patch(
        db, acc, item.id, foreign_loc.id, cost_price=Decimal("12.50"), stoc_minim=4,
    ))
    assert "Strain" not in detail
    assert await _item_meta(db, item) == before


async def test_patch_missing_foreign_and_deleted_location_get_the_same_answer():
    db, acc, _, item, loc, foreign_loc, *_ = await _fixture()
    before = await _item_meta(db, item)
    d_foreign = await raises_http(404, _patch(db, acc, item.id, foreign_loc.id, stoc_minim=4))
    d_missing = await raises_http(404, _patch(db, acc, item.id, 99999, stoc_minim=4))
    await _soft_delete_location(db, loc)
    db.expunge_all()
    d_deleted = await raises_http(404, _patch(db, acc, item.id, loc.id, stoc_minim=4))
    assert d_foreign == d_missing == d_deleted
    assert await _item_meta(db, item) == before


async def test_patch_with_own_location_works_and_returns_its_qty():
    db, acc, _, item, loc, *_ = await _fixture()
    db.add(Stock(account_id=acc.id, item_id=item.id, location_id=loc.id, qty=7))
    await db.commit()
    row = await _patch(db, acc, item.id, loc.id, cost_price=Decimal("12.50"), stoc_minim=4)
    assert (row.item_id, row.qty, row.stoc_minim) == (item.id, 7, 4)
    assert row.cost_price == Decimal("12.50")
    assert await _item_meta(db, item) == (Decimal("12.50"), 4)


async def test_patch_with_own_location_without_stock_row_returns_zero():
    db, acc, _, item, loc, *_ = await _fixture()
    row = await _patch(db, acc, item.id, loc.id, stoc_minim=3)
    assert (row.qty, row.stoc_minim) == (0, 3)


async def test_patch_foreign_item_stays_404():
    db, _, other, item, _, foreign_loc, *_ = await _fixture()
    before = await _item_meta(db, item)
    await raises_http(404, _patch(db, other, item.id, foreign_loc.id, stoc_minim=9))
    assert await _item_meta(db, item) == before


# ─── POST /api/stocuri/intrare si /ajustare ───────────────────────────────────

async def test_intrare_rejects_foreign_missing_and_deleted_location():
    db, acc, _, item, loc, foreign_loc, *_ = await _fixture()

    def call(location_id: int):
        return intrare_stoc(
            IntrareStocCreate(item_id=item.id, location_id=location_id, qty=5),
            db=db, account_id=acc.id, actor="tester",
        )

    d_foreign = await raises_http(404, call(foreign_loc.id))
    d_missing = await raises_http(404, call(99999))
    await _soft_delete_location(db, loc)
    db.expunge_all()
    d_deleted = await raises_http(404, call(loc.id))
    assert d_foreign == d_missing == d_deleted
    assert await _count(db, Stock) == 0
    assert await _count(db, StockMovement) == 0


async def test_ajustare_rejects_foreign_missing_and_deleted_location():
    db, acc, _, item, loc, foreign_loc, *_ = await _fixture()

    def call(location_id: int):
        return ajustare_stoc(
            AjustareStocCreate(item_id=item.id, location_id=location_id, new_qty=5),
            db=db, account_id=acc.id, actor="tester",
        )

    d_foreign = await raises_http(404, call(foreign_loc.id))
    d_missing = await raises_http(404, call(99999))
    await _soft_delete_location(db, loc)
    db.expunge_all()
    d_deleted = await raises_http(404, call(loc.id))
    assert d_foreign == d_missing == d_deleted
    assert await _count(db, Stock) == 0
    assert await _count(db, StockMovement) == 0


# ─── GET /api/stocuri/miscari ─────────────────────────────────────────────────

async def test_miscari_hides_foreign_employee_name_on_legacy_row():
    db, acc, _, item, loc, _, _, foreign_emp = await _fixture()
    await _sale(db, acc, item, loc, foreign_emp.id)
    rows = await list_miscari(limit=200, db=db, account_id=acc.id)
    assert [(r.employee_id, r.employee_name) for r in rows] == [(foreign_emp.id, None)]


async def test_miscari_keeps_own_employee_name_and_rows_without_employee():
    db, acc, _, item, loc, _, emp, _ = await _fixture()
    await _sale(db, acc, item, loc, emp.id)
    await _sale(db, acc, item, loc, None)
    rows = await list_miscari(limit=200, db=db, account_id=acc.id)
    assert sorted((r.employee_name or "") for r in rows) == ["", "Ion"]
    only = await list_miscari(employee_id=emp.id, limit=200, db=db, account_id=acc.id)
    assert [r.employee_name for r in only] == ["Ion"]


async def test_miscari_isolates_accounts():
    db, acc, other, item, loc, _, emp, _ = await _fixture()
    await _sale(db, acc, item, loc, emp.id)
    assert await list_miscari(limit=200, db=db, account_id=other.id) == []
    assert await list_miscari(employee_id=emp.id, limit=200, db=db, account_id=other.id) == []


# ─── GET /api/stocuri/reports/per-angajat ─────────────────────────────────────

async def test_report_per_angajat_hides_foreign_employee_name():
    db, acc, _, item, loc, _, _, foreign_emp = await _fixture()
    await _sale(db, acc, item, loc, foreign_emp.id, qty=3)
    rows = await report_per_angajat(location_ids=[], db=db, account_id=acc.id)
    assert len(rows) == 1
    assert rows[0]["employee_name"] == "—"
    assert (rows[0]["employee_id"], rows[0]["qty_total"], rows[0]["valoare"]) == (foreign_emp.id, 3, 150.0)


async def test_report_per_angajat_keeps_own_employee_name():
    db, acc, other, item, loc, _, emp, _ = await _fixture()
    await _sale(db, acc, item, loc, emp.id, qty=2)
    await _sale(db, acc, item, loc, emp.id, qty=1)
    rows = await report_per_angajat(location_ids=[loc.id], db=db, account_id=acc.id)
    assert [(r["employee_id"], r["employee_name"], r["qty_total"]) for r in rows] == [(emp.id, "Ion", 3)]
    assert await report_per_angajat(location_ids=[], db=db, account_id=other.id) == []


# ─── Categorie / departament din alt cont pe un produs vechi ──────────────────

async def _foreign_category_fixture(via_department: bool):
    """Produs propriu legat (direct in baza, ca un rand vechi) de categoria
    altui cont; cu `via_department`, categoria e proprie, dar departamentul ei
    e al altui cont."""
    db, acc, other, item, loc, *_ = await _fixture()
    foreign_dept = Department(account_id=other.id, name="Departament Strain")
    db.add(foreign_dept)
    await db.flush()
    foreign_cat = Category(account_id=other.id, name="Categorie Straina", department_id=foreign_dept.id)
    db.add(foreign_cat)
    await db.flush()
    if via_department:
        await db.execute(
            update(Category).where(Category.id == item.category_id)
            .values(department_id=foreign_dept.id)
        )
    else:
        await db.execute(
            update(Item).where(Item.id == item.id).values(category_id=foreign_cat.id)
        )
    ok_dept = Department(account_id=acc.id, name="Piese")
    db.add(ok_dept)
    await db.flush()
    ok_cat = Category(account_id=acc.id, name="Filtre", department_id=ok_dept.id)
    db.add(ok_cat)
    await db.flush()
    ok_item = Item(
        account_id=acc.id, name="Filtru", price=Decimal("20.00"), unit="buc",
        type=ItemType.PRODUS, category_id=ok_cat.id,
    )
    db.add(ok_item)
    await db.flush()
    await db.commit()
    # Obiectele din sesiune au inca valorile vechi; handlerele trebuie sa le
    # reciteasca din baza.
    db.expunge_all()
    return db, acc, item, ok_item, loc


async def _assert_foreign_category_hidden(via_department: bool) -> None:
    db, acc, item, ok_item, loc = await _foreign_category_fixture(via_department)

    rows = await list_stocuri(location_id=loc.id, q=None, db=db, account_id=acc.id)
    assert [r.item_id for r in rows] == [ok_item.id]
    assert all("Strain" not in r.category_name + r.department_name for r in rows)

    before = await _item_meta(db, item)
    d_patch = await raises_http(404, _patch(db, acc, item.id, loc.id, stoc_minim=4))
    d_intrare = await raises_http(404, intrare_stoc(
        IntrareStocCreate(item_id=item.id, location_id=loc.id, qty=5),
        db=db, account_id=acc.id, actor="tester",
    ))
    d_ajustare = await raises_http(404, ajustare_stoc(
        AjustareStocCreate(item_id=item.id, location_id=loc.id, new_qty=5),
        db=db, account_id=acc.id, actor="tester",
    ))
    # Acelasi raspuns ca pentru un produs inexistent.
    d_missing = await raises_http(404, _patch(db, acc, 99999, loc.id, stoc_minim=4))
    assert d_patch == d_intrare == d_ajustare == d_missing
    assert "Strain" not in d_patch
    assert await _item_meta(db, item) == before
    assert await _count(db, Stock) == 0
    assert await _count(db, StockMovement) == 0


async def test_item_with_foreign_category_is_hidden_and_not_editable():
    await _assert_foreign_category_hidden(via_department=False)


async def test_item_whose_category_has_foreign_department_is_hidden_and_not_editable():
    await _assert_foreign_category_hidden(via_department=True)


async def test_own_category_still_returned_by_list_intrare_and_ajustare():
    db, acc, _, item, loc, *_ = await _fixture()
    row = await intrare_stoc(
        IntrareStocCreate(item_id=item.id, location_id=loc.id, qty=5),
        db=db, account_id=acc.id, actor="tester",
    )
    assert (row.qty, row.category_name, row.department_name) == (5, "General", "Auto")
    row = await ajustare_stoc(
        AjustareStocCreate(item_id=item.id, location_id=loc.id, new_qty=2),
        db=db, account_id=acc.id, actor="tester",
    )
    assert (row.qty, row.category_name, row.department_name) == (2, "General", "Auto")
    rows = await list_stocuri(location_id=loc.id, q=None, db=db, account_id=acc.id)
    assert [(r.item_id, r.qty, r.category_name, r.department_name) for r in rows] == [
        (item.id, 2, "General", "Auto"),
    ]


TESTS = [v for k, v in sorted(globals().items()) if k.startswith("test_")]

if __name__ == "__main__":
    for t in TESTS:
        run(t())
    print(f"OK — {len(TESTS)} scenarii de izolare in zona Stocuri trecute.")
