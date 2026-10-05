"""Izolare intre conturi in rapoarte: JOIN-urile de nume raman in contul apelantului.

Rapoartele doar citesc. Un rand vechi care poarta deja id-ul unui angajat / unei
locatii / categorii din alt cont trebuie sa apara in continuare in raport (cu
sumele lui), dar fara numele, poza sau targetul randului strain.

Rulabil cu pytest sau direct:  python -m tests.test_izolare_reports  (din backend/)
"""
from __future__ import annotations
import inspect
import re
from datetime import date, datetime, timezone
from decimal import Decimal
from zoneinfo import ZoneInfo

from app.models.category import Category
from app.models.cazare_anvelope import CazareAnvelope
from app.models.department import Department
from app.models.employee import Employee
from app.models.item import Item, ItemType
from app.models.loc_cazare import LocCazare
from app.models.location import Location
from app.models.report_cazari_daily import ReportCazariDaily
from app.models.report_employee_daily import ReportEmployeeDaily
from app.models.report_receipts_breakdown_daily import ReportReceiptsBreakdownDaily
from app.routers import reports as reports_module
from app.routers.reports import (
    reports_contributii_angajati, reports_employee_detail, reports_hotel_anvelope,
    reports_items_catalog, reports_produse_servicii,
)
from tests._harness import make_account, make_employee, make_session, raises_http, run

NOW = datetime.now(timezone.utc)
# Aceeasi „azi" ca in router: luna curenta din /contributii-angajati e in Europe/Bucharest.
TODAY = datetime.now(ZoneInfo("Europe/Bucharest")).date()


async def _pg_functions(db) -> None:
    """Rapoartele lunare folosesc to_char(date_trunc('month', d), 'YYYY-MM'), care
    nu exista pe SQLite. Le inregistram pe conexiunea testului (una singura, baza
    e in memorie); SQLite tine datele ca text 'YYYY-MM-DD'."""
    conn = await db.connection()
    raw = await conn.get_raw_connection()
    driver = raw.driver_connection
    await driver.create_function("date_trunc", 2, lambda _unit, d: f"{d[:7]}-01")
    await driver.create_function("to_char", 2, lambda d, _fmt: d[:7])


async def _add(db, obj):
    db.add(obj)
    await db.flush()
    return obj


async def _fixture():
    db = await make_session()
    await _pg_functions(db)
    acc = await make_account(db)
    other = await make_account(db, username="alta", code="alta")
    own = {
        "emp": await make_employee(db, acc, "Ion"),
        "loc": await _add(db, Location(account_id=acc.id, name="Service Centru")),
        "raft": await _add(db, LocCazare(account_id=acc.id, nume="Raft A")),
        "dept": await _add(db, Department(account_id=acc.id, name="Vulcanizare")),
    }
    own["cat"] = await _add(db, Category(account_id=acc.id, name="Montaj", department_id=own["dept"].id))
    foreign = {
        "emp": await _add(db, Employee(
            account_id=other.id, name="Strain", image_path="strain.png", target=Decimal("99999"),
        )),
        "loc": await _add(db, Location(account_id=other.id, name="Locatie Straina")),
        "raft": await _add(db, LocCazare(account_id=other.id, nume="Raft Strain")),
        "dept": await _add(db, Department(account_id=other.id, name="Dept Strain")),
    }
    foreign["cat"] = await _add(db, Category(
        account_id=other.id, name="Cat Straina", department_id=foreign["dept"].id,
    ))
    return db, acc, other, own, foreign


async def _emp_row(db, acc, employee_id, amount, location_id=None, day: date = TODAY):
    return await _add(db, ReportEmployeeDaily(
        report_date=day, account_id=acc.id, employee_id=employee_id, location_id=location_id,
        item_type="SERVICE", sum_amount=Decimal(amount), count_items=1,
        created_at=NOW, updated_at=NOW,
    ))


async def _breakdown_row(db, acc, category_id, name, amount):
    return await _add(db, ReportReceiptsBreakdownDaily(
        report_date=TODAY, account_id=acc.id, dimension_type="category",
        dimension_id=category_id, dimension_value=name, sum_amount=Decimal(amount),
        count_items=1, created_at=NOW, updated_at=NOW,
    ))


async def _produse_servicii(db, acc):
    return await reports_produse_servicii(
        date_from=TODAY, date_to=TODAY, location_id=None, location_ids=None,
        db=db, account_id=acc.id,
    )


async def test_produse_servicii_hides_foreign_employee_name():
    db, acc, _, own, foreign = await _fixture()
    await _emp_row(db, acc, own["emp"].id, "50")
    await _emp_row(db, acc, foreign["emp"].id, "100")
    out = await _produse_servicii(db, acc)
    names = {e.employee_id: e.employee_name for e in out.employees}
    assert names == {own["emp"].id: "Ion", foreign["emp"].id: "Fără angajat"}
    assert sum(e.total for e in out.employees) == Decimal("150")


async def test_produse_servicii_hides_foreign_department_of_category():
    db, acc, _, own, foreign = await _fixture()
    # categorie proprie ramasa legata de departamentul altui cont
    legacy = await _add(db, Category(account_id=acc.id, name="Veche", department_id=foreign["dept"].id))
    await _breakdown_row(db, acc, own["cat"].id, "Montaj", "30")
    await _breakdown_row(db, acc, legacy.id, "Veche", "20")
    await _breakdown_row(db, acc, foreign["cat"].id, "Agregat vechi", "10")
    out = await _produse_servicii(db, acc)
    by_cat = {c.category_id: c for c in out.categories}
    assert (by_cat[own["cat"].id].department_id, by_cat[own["cat"].id].department_name) == (
        own["dept"].id, "Vulcanizare",
    )
    for cat_id in (legacy.id, foreign["cat"].id):
        assert by_cat[cat_id].department_id is None
        assert by_cat[cat_id].department_name == "Introducere Manuala"
    assert "Dept Strain" not in {c.department_name for c in out.categories}


async def test_items_catalog_keeps_item_but_hides_foreign_category():
    db, acc, _, own, foreign = await _fixture()
    base = dict(account_id=acc.id, price=Decimal("10"), unit="buc", type=ItemType.SERVICE)
    ok = await _add(db, Item(name="Montaj roata", category_id=own["cat"].id, **base))
    legacy = await _add(db, Item(name="Articol vechi", category_id=foreign["cat"].id, **base))
    out = await reports_items_catalog(db=db, account_id=acc.id)
    by_id = {i.item_id: i for i in out.items}
    assert set(by_id) == {ok.id, legacy.id}
    assert (by_id[ok.id].category_name, by_id[ok.id].department_name) == ("Montaj", "Vulcanizare")
    assert by_id[ok.id].department_id == own["dept"].id
    assert by_id[legacy.id].category_id == foreign["cat"].id
    assert by_id[legacy.id].category_name == "Fara categorie"
    assert by_id[legacy.id].department_id is None
    assert by_id[legacy.id].department_name == "Fara departament"


async def test_items_catalog_hides_foreign_department_of_own_category():
    db, acc, _, _, foreign = await _fixture()
    legacy_cat = await _add(db, Category(account_id=acc.id, name="Veche", department_id=foreign["dept"].id))
    item = await _add(db, Item(
        account_id=acc.id, name="Articol", price=Decimal("10"), unit="buc",
        type=ItemType.PRODUS, category_id=legacy_cat.id,
    ))
    out = await reports_items_catalog(db=db, account_id=acc.id)
    assert [(i.item_id, i.category_name, i.department_id, i.department_name) for i in out.items] == [
        (item.id, "Veche", None, "Fara departament"),
    ]


async def test_contributii_hides_foreign_employee_name_image_and_target():
    db, acc, _, own, foreign = await _fixture()
    await _emp_row(db, acc, own["emp"].id, "50")
    await _emp_row(db, acc, foreign["emp"].id, "100")
    out = await reports_contributii_angajati(db=db, account_id=acc.id)
    current = {e.employee_id: e for e in out.months[0].employees}
    assert set(current) == {own["emp"].id, foreign["emp"].id}
    mine, strain = current[own["emp"].id], current[foreign["emp"].id]
    assert (mine.employee_name, mine.target) == ("Ion", Decimal("25000"))
    assert (strain.employee_name, strain.image_path, strain.target) == ("Fără angajat", None, Decimal("0"))
    assert strain.sum_amount == Decimal("100") and out.months[0].total == Decimal("150")


async def test_employee_detail_hides_foreign_location_name():
    db, acc, _, own, foreign = await _fixture()
    await _emp_row(db, acc, own["emp"].id, "50", location_id=own["loc"].id)
    await _emp_row(db, acc, own["emp"].id, "100", location_id=foreign["loc"].id)
    out = await reports_employee_detail(
        own["emp"].id, date_from=TODAY, date_to=TODAY, db=db, account_id=acc.id,
    )
    assert {loc.location_id: loc.location_name for loc in out.locations} == {
        own["loc"].id: "Service Centru", foreign["loc"].id: "Fără locație",
    }
    assert out.total == Decimal("150")


async def test_employee_detail_rejects_foreign_employee():
    db, acc, _, _, foreign = await _fixture()
    await raises_http(404, reports_employee_detail(
        foreign["emp"].id, date_from=TODAY, date_to=TODAY, db=db, account_id=acc.id,
    ))
    await raises_http(404, reports_employee_detail(
        99999, date_from=TODAY, date_to=TODAY, db=db, account_id=acc.id,
    ))


async def test_hotel_anvelope_hides_foreign_location_slot_and_employee():
    db, acc, _, own, foreign = await _fixture()
    await _add(db, CazareAnvelope(
        account_id=acc.id, data_checkin=TODAY, location_id=own["loc"].id, loc_cazare_id=own["raft"].id,
    ))
    await _add(db, CazareAnvelope(
        account_id=acc.id, data_checkin=TODAY,
        location_id=foreign["loc"].id, loc_cazare_id=foreign["raft"].id,
    ))
    for emp_id, loc_id in ((own["emp"].id, own["loc"].id), (foreign["emp"].id, foreign["loc"].id)):
        await _add(db, ReportCazariDaily(
            report_date=TODAY, account_id=acc.id, employee_id=emp_id, location_id=loc_id,
            count_checkins=1, count_checkouts=1, created_at=NOW, updated_at=NOW,
        ))
    out = await reports_hotel_anvelope(
        date_from=TODAY, date_to=TODAY, location_ids=None, db=db, account_id=acc.id,
    )
    assert out.kpi.cazari_active_total == 2
    assert {r.location_id: r.location_name for r in out.active_per_location} == {
        own["loc"].id: "Service Centru", foreign["loc"].id: "Fără locație",
    }
    assert {r.loc_cazare_id: (r.location_name, r.loc_cazare_nume) for r in out.active_per_loc_cazare} == {
        own["raft"].id: ("Service Centru", "Raft A"),
        foreign["raft"].id: ("Fără locație", "Fără loc de depozitare"),
    }
    assert {r.employee_id: (r.employee_name, r.image_path) for r in out.per_employee} == {
        own["emp"].id: ("Ion", None), foreign["emp"].id: ("Fără angajat", None),
    }
    assert {r.employee_id: (r.employee_name, r.location_name) for r in out.per_employee_location} == {
        own["emp"].id: ("Ion", "Service Centru"),
        foreign["emp"].id: ("Fără angajat", "Fără locație"),
    }


async def test_other_account_report_is_untouched():
    db, acc, other, own, foreign = await _fixture()
    await _emp_row(db, acc, foreign["emp"].id, "100")
    await _emp_row(db, other, foreign["emp"].id, "70")
    out = await _produse_servicii(db, other)
    assert [(e.employee_name, e.total) for e in out.employees] == [("Strain", Decimal("70"))]


async def test_every_tenant_join_is_scoped_by_account():
    """Plasa pentru rapoartele cu SQL doar de Postgres (/clienti, /locatii-yoy,
    /items-timeseries), care nu pot rula pe SQLite: orice JOIN pe o tabela cu
    account_id trebuie sa lege si contul, nu doar id-ul."""
    tenant_tables = {
        "locations", "employees", "clienti", "receipts", "categories", "departments",
        "locuri_cazare", "items",
    }
    lines = inspect.getsource(reports_module).splitlines()
    checked = 0
    for idx, line in enumerate(lines):
        m = re.search(r"\bJOIN (\w+) \w+ ON ", line)
        if m is None or m.group(1) not in tenant_tables:
            continue
        clause = line
        if idx + 1 < len(lines) and lines[idx + 1].strip().startswith("AND "):
            clause += lines[idx + 1]
        assert "account_id" in clause, f"JOIN fara filtru de cont (linia {idx + 1}): {line.strip()}"
        checked += 1
    assert checked >= 18, f"astept cel putin 18 JOIN-uri verificate, gasit {checked}"


TESTS = [v for k, v in sorted(globals().items()) if k.startswith("test_")]

if __name__ == "__main__":
    for t in TESTS:
        run(t())
    print(f"OK — {len(TESTS)} scenarii de izolare in rapoarte trecute.")
