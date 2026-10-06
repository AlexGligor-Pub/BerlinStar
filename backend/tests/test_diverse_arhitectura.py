"""Reparatii din revizia de arhitectura: `limit` nepozitiv la liste, legaturi
vechi spre alt cont (categoria articolului, clientul din montaj), „Neplatit" cu
restul bonurilor platite partial si reconstruirea zilelor vechi de raport.

Builderii de rapoarte si `run_report` folosesc SQL specific Postgres
(`AT TIME ZONE`, `::text`, `FILTER`, `NOW()`), deci aici se testeaza doar ce
ruleaza pe SQLite: expresia „Neplatit" (fara cast), cautarea zilelor modificate
si alegerea intervalelor de reconstruit.

Rulabil cu pytest sau direct:  python -m tests.test_diverse_arhitectura  (din backend/)
"""
from __future__ import annotations
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import select, text

from app.models.category import Category
from app.models.cazare_anvelope import CazareAnvelope
from app.models.location import Location
from app.models.montaj_rota import MontajRota
from app.models.programare import Programare
from app.models.receipt import PayMethod
from app.routers.categories import list_categories
from app.routers.items import list_items
from app.routers.montaj_roti import latest_montaj_by_plate
from app.services.reports.builder import UNPAID_SQL
from app.services.reports.manager import MAX_HEAL_DAYS, _find_dirty_days, _heal_ranges
from app.utils.paginate import checked_limit, paginate
from tests._harness import (
    make_account, make_client, make_item, make_receipt, make_session, raises_http, run,
    set_receipt_vehicol,
)


async def _item2(db, acc, name: str, price: str):
    """Al doilea articol al aceluiasi cont. `make_item` creeaza de fiecare data
    departamentul „Auto", unic pe cont, deci nu poate fi apelat de doua ori."""
    from app.models.department import Department
    from app.models.item import Item, ItemType
    dept = Department(account_id=acc.id, name=f"Dept {name}")
    db.add(dept)
    await db.flush()
    cat = Category(account_id=acc.id, name=f"Cat {name}", department_id=dept.id)
    db.add(cat)
    await db.flush()
    item = Item(
        account_id=acc.id, name=name, price=Decimal(price), unit="buc",
        type=ItemType.PRODUS, category_id=cat.id,
    )
    db.add(item)
    await db.flush()
    return item


async def _two_accounts():
    db = await make_session()
    acc = await make_account(db)
    other = await make_account(db, username="alta", code="alta")
    return db, acc, other


# ─── 1. `limit` nepozitiv ────────────────────────────────────────────────────

async def test_list_rejects_non_positive_limit_with_422():
    db, acc, _ = await _two_accounts()
    await make_item(db, acc, "Anvelopa", "100.00")
    await _item2(db, acc, "Janta", "200.00")
    await db.commit()
    for bad in (0, -1, -5):
        await raises_http(422, list_categories(limit=bad, db=db, account_id=acc.id))
        await raises_http(422, list_items(limit=bad, db=db, account_id=acc.id))


async def test_list_with_positive_limit_keeps_cursor_contract():
    db, acc, _ = await _two_accounts()
    await make_item(db, acc, "Anvelopa", "100.00")
    await _item2(db, acc, "Janta", "200.00")
    await db.commit()
    first = await list_categories(limit=1, db=db, account_id=acc.id)
    assert len(first.items) == 1 and first.next_cursor == first.items[0].id
    rest = await list_categories(limit=1, last_id=first.next_cursor, db=db, account_id=acc.id)
    assert len(rest.items) == 1 and rest.next_cursor is None
    everything = await list_categories(db=db, account_id=acc.id)
    assert len(everything.items) == 2 and everything.next_cursor is None


async def test_paginate_helper_is_safe_on_empty_and_bad_limit():
    db, acc, _ = await _two_accounts()
    stmt = select(Category).where(Category.account_id == acc.id)
    page = await paginate(db, stmt.limit(2), 1)
    assert page.items == [] and page.next_cursor is None
    await raises_http(422, paginate(db, stmt.limit(1), 0))
    assert checked_limit(1) == 1 and checked_limit(500) == 500


# ─── 3. Articol legat de categoria altui cont ────────────────────────────────

async def test_items_list_hides_foreign_category_but_keeps_the_item():
    db, acc, other = await _two_accounts()
    own = await make_item(db, acc, "Anvelopa", "100.00")
    legacy = await _item2(db, acc, "Janta veche", "200.00")
    foreign = await make_item(db, other, "Strain", "1.00")
    foreign_cat = await db.get(Category, foreign.category_id)
    foreign_cat.name = "CATEGORIE STRAINA"
    # Legatura veche, de dinaintea verificarii de apartenenta.
    legacy.category_id = foreign_cat.id
    # Doar id-uri: dupa `expire_all` un obiect nu mai poate fi citit in afara unui query.
    own_id, legacy_id, foreign_cat_id = own.id, legacy.id, foreign_cat.id
    own_dept_id = (await db.get(Category, own.category_id)).department_id
    acc_id = acc.id
    await db.commit()
    db.expire_all()

    by_id = {i.id: i for i in (await list_items(db=db, account_id=acc_id)).items}
    assert set(by_id) == {own_id, legacy_id}
    assert (by_id[legacy_id].category_name, by_id[legacy_id].department_id) == (None, None)
    assert by_id[legacy_id].category_id == foreign_cat_id
    assert (by_id[own_id].category_name, by_id[own_id].department_id) == ("General", own_dept_id)


# ─── 4. Montaj dupa numar: clientul altui cont ───────────────────────────────

async def _receipt_with_montaj(db, acc, client_id: int, plate: str):
    receipt = await make_receipt(db, acc, client_id=client_id)
    await set_receipt_vehicol(db, receipt, plate)
    db.add(MontajRota(account_id=acc.id, receipt_id=receipt.id))
    await db.flush()
    return receipt


async def test_montaj_by_plate_shows_own_client_and_hides_foreign_one():
    db, acc, other = await _two_accounts()
    own_client = await make_client(db, acc, "Client Propriu")
    foreign_client = await make_client(db, other, "CLIENT STRAIN")
    own = await _receipt_with_montaj(db, acc, own_client.id, "B 12 ABC")
    legacy = await _receipt_with_montaj(db, acc, foreign_client.id, "CJ 99 XYZ")
    await db.commit()

    out = await latest_montaj_by_plate(numar_masina="b12abc", db=db, account_id=acc.id)
    assert (out["found"], out["receipt_id"]) == (True, own.id)
    assert (out["client_id"], out["client_nume"]) == (own_client.id, "Client Propriu")

    out = await latest_montaj_by_plate(numar_masina="CJ99XYZ", db=db, account_id=acc.id)
    assert (out["found"], out["receipt_id"]) == (True, legacy.id)
    assert (out["client_id"], out["client_nume"]) == (None, None)
    assert len(out["wheels"]) == 1


# ─── 5. „Neplatit" include restul bonurilor platite partial ──────────────────

async def _unpaid(db, account_id: int) -> Decimal:
    # Expresia reala din builder, fara cast-ul `::text` (specific Postgres).
    sql = text(
        f"SELECT COALESCE(SUM({UNPAID_SQL.replace('::text', '')}), 0) "
        "FROM receipts r WHERE r.account_id = :acc"
    )
    return Decimal(str(round(float((await db.execute(sql, {"acc": account_id})).scalar_one()), 2)))


async def test_unpaid_counts_remainder_of_partial_receipts():
    db, acc, other = await _two_accounts()
    # Scenariul din raport: bon de 1000 cu avans 200 -> 800 raman de incasat.
    await make_receipt(db, acc, "1000.00", pay_method=PayMethod.PARTIAL, partial_pay=Decimal("200.00"))
    await db.flush()
    assert await _unpaid(db, acc.id) == Decimal("800")
    await make_receipt(db, acc, "300.00")  # neplatit integral
    await make_receipt(db, acc, "400.00", pay_method=PayMethod.CASH)
    await make_receipt(db, acc, "250.00", pay_method=PayMethod.CARD)
    await make_receipt(db, acc, "150.00", pay_method=PayMethod.OP)
    # Partial fara suma (date vechi): tot bonul e rest.
    await make_receipt(db, acc, "50.00", pay_method=PayMethod.PARTIAL)
    await make_receipt(db, other, "999.00")
    await db.flush()
    assert await _unpaid(db, acc.id) == Decimal("1150")
    assert await _unpaid(db, other.id) == Decimal("999")


async def test_unpaid_remainder_never_goes_negative():
    db, acc, _ = await _two_accounts()
    # Bon vechi cu partial_pay peste total: restul e 0, nu scade „Neplatit".
    await make_receipt(db, acc, "100.00", pay_method=PayMethod.PARTIAL, partial_pay=Decimal("150.00"))
    await make_receipt(db, acc, "300.00")
    await db.flush()
    assert await _unpaid(db, acc.id) == Decimal("300")


# ─── 6. Zilele vechi de raport modificate tarziu ─────────────────────────────

SINCE = datetime(2026, 10, 1, 8, 0, tzinfo=timezone.utc)
BEFORE, AFTER = SINCE - timedelta(days=3), SINCE + timedelta(hours=2)


async def test_dirty_days_for_receipts_follow_updates_and_deletes():
    db, acc, _ = await _two_accounts()
    untouched = await make_receipt(db, acc)
    untouched.created_at, untouched.updated_at = datetime(2026, 5, 4, 10, 0, tzinfo=timezone.utc), BEFORE
    paid_late = await make_receipt(db, acc)
    paid_late.created_at, paid_late.updated_at = datetime(2026, 8, 25, 10, 0, tzinfo=timezone.utc), AFTER
    deleted_late = await make_receipt(db, acc)
    deleted_late.created_at = datetime(2026, 7, 14, 9, 0, tzinfo=timezone.utc)
    deleted_late.is_deleted, deleted_late.deleted_at = True, AFTER
    # 22:30 UTC vara = 01:30 a doua zi la Bucuresti: ziua de raport e 1 iulie.
    near_midnight = await make_receipt(db, acc)
    near_midnight.created_at, near_midnight.updated_at = datetime(2026, 6, 30, 22, 30, tzinfo=timezone.utc), AFTER
    await db.commit()

    expected = {date(2026, 8, 25), date(2026, 7, 14), date(2026, 7, 1)}
    for report_type in ("receipts_daily", "employee_daily", "clients_daily"):
        assert await _find_dirty_days(db, report_type, SINCE) == expected
    assert await _find_dirty_days(db, "stock_movements_daily", SINCE) == set()
    assert await _find_dirty_days(db, "receipts_daily", AFTER + timedelta(minutes=1)) == set()


async def test_dirty_days_for_cazari_and_programari():
    db, acc, _ = await _two_accounts()
    location = Location(account_id=acc.id, name="Locatie")
    db.add(location)
    await db.flush()
    db.add_all([
        CazareAnvelope(
            account_id=acc.id, data_checkin=date(2026, 3, 1), data_checkout=date(2026, 9, 20), updated_at=AFTER,
        ),
        CazareAnvelope(account_id=acc.id, data_checkin=date(2026, 4, 2), is_deleted=True, deleted_at=AFTER),
        CazareAnvelope(account_id=acc.id, data_checkin=date(2026, 2, 2), updated_at=BEFORE),
        Programare(
            account_id=acc.id, titlu="Mutata", location_id=location.id, updated_at=AFTER,
            start_time=datetime(2026, 6, 10, 9, 0, tzinfo=timezone.utc),
            end_time=datetime(2026, 6, 10, 10, 0, tzinfo=timezone.utc),
        ),
        Programare(
            account_id=acc.id, titlu="Neatinsa", location_id=location.id,
            start_time=datetime(2026, 6, 11, 9, 0, tzinfo=timezone.utc),
            end_time=datetime(2026, 6, 11, 10, 0, tzinfo=timezone.utc),
        ),
    ])
    await db.commit()
    assert await _find_dirty_days(db, "cazari_daily", SINCE) == {
        date(2026, 3, 1), date(2026, 9, 20), date(2026, 4, 2),
    }
    assert await _find_dirty_days(db, "programari_daily", SINCE) == {date(2026, 6, 10)}


async def test_heal_ranges_skip_period_and_future_and_group_consecutive_days():
    today = date(2026, 10, 6)
    period = (date(2026, 9, 1), today)
    dirty = {
        date(2026, 8, 25), date(2026, 8, 24), date(2026, 8, 23),  # consecutive -> un interval
        date(2026, 7, 14),
        date(2026, 9, 15),   # in perioada: se reconstruieste oricum
        date(2026, 10, 9),   # viitor (programare)
    }
    ranges, skipped = _heal_ranges(dirty, *period, today)
    assert ranges == [(date(2026, 7, 14), date(2026, 7, 14)), (date(2026, 8, 23), date(2026, 8, 25))]
    assert skipped == []
    assert _heal_ranges(set(), *period, today) == ([], [])
    # Rebuild pe interval vechi din admin: zilele de dupa interval, pana azi, conteaza.
    ranges, _ = _heal_ranges({date(2026, 9, 15)}, date(2026, 1, 1), date(2026, 1, 31), today)
    assert ranges == [(date(2026, 9, 15), date(2026, 9, 15))]


async def test_heal_ranges_are_capped_keeping_the_most_recent_days():
    today = date(2026, 10, 6)
    start = date(2025, 1, 1)
    dirty = {start + timedelta(days=2 * i) for i in range(MAX_HEAL_DAYS + 10)}  # zile neconsecutive
    ranges, skipped = _heal_ranges(dirty, date(2026, 9, 1), today, today)
    assert len(ranges) == MAX_HEAL_DAYS and len(skipped) == 10
    assert max(skipped) < min(s for s, _ in ranges)
    ranges, skipped = _heal_ranges(dirty, date(2026, 9, 1), today, today, max_days=3)
    assert [s for s, _ in ranges] == sorted(dirty)[-3:] and len(skipped) == len(dirty) - 3


TESTS = [v for k, v in sorted(globals().items()) if k.startswith("test_")]

if __name__ == "__main__":
    for t in TESTS:
        run(t())
    print(f"OK — {len(TESTS)} scenarii din revizia de arhitectura trecute.")
