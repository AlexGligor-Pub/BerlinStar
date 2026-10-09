"""Raportul „Introduse manual”: liniile de bon fara produs din catalog.

Rulabil cu pytest sau direct:  python -m tests.test_reports_introduse_manual  (din backend/)
"""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from zoneinfo import ZoneInfo

from app.models.item import ItemType
from app.models.location import Location
from app.models.receipt import PayMethod
from app.routers.reports import reports_introduse_manual
from tests._harness import add_line, make_account, make_employee, make_item, make_receipt, make_session, raises_http, run

BUC = ZoneInfo("Europe/Bucharest")
D1, D2 = date(2026, 9, 1), date(2026, 9, 30)


def _at(day: date, hour: int = 12) -> datetime:
    """Ora locala din Romania, salvata ca UTC (ca in aplicatie)."""
    return datetime(day.year, day.month, day.day, hour, tzinfo=BUC).astimezone(timezone.utc)


async def _receipt(db, acc, total, **kw):
    """make_receipt pune ora curenta; aici ne trebuie un moment anume."""
    when = kw.pop("created_at")
    r = await make_receipt(db, acc, total, **kw)
    r.created_at = when
    return r


async def _line(db, receipt, name, price, qty=1, item=None, item_type=None, employee=None):
    ln = await add_line(db, receipt, name, price, qty=qty, item_id=item.id if item else None)
    ln.account_id = receipt.account_id
    ln.item_type = item_type
    ln.employee_id = employee.id if employee else None
    return ln


async def _fixture():
    db = await make_session()
    acc = await make_account(db)
    other = await make_account(db, username="alta", code="alta")
    loc1 = Location(account_id=acc.id, name="Centru")
    loc2 = Location(account_id=acc.id, name="Nord")
    db.add_all([loc1, loc2])
    await db.flush()
    ion = await make_employee(db, acc, "Ion")
    ulei = await make_item(db, acc, "Ulei motor", "100.00")
    return db, acc, other, loc1, loc2, ion, ulei


async def _report(db, acc, **kw):
    return await reports_introduse_manual(
        date_from=kw.pop("date_from", D1), date_to=kw.pop("date_to", D2),
        location_ids=kw.pop("location_ids", None), db=db, account_id=acc.id,
    )


async def test_only_manual_lines_of_valid_receipts_in_the_period():
    db, acc, other, loc1, loc2, ion, ulei = await _fixture()
    r1 = await _receipt(db, acc, "350.00", location_id=loc1.id, created_at=_at(date(2026, 9, 10)))
    await _line(db, r1, "Ulei motor", "100.00", item=ulei, item_type=ItemType.PRODUS)        # din catalog
    await _line(db, r1, "Transport marfa", "50.00", qty=2, item_type=ItemType.SERVICE, employee=ion)
    await _line(db, r1, "Garnitura speciala", "150.00", item_type=ItemType.PRODUS)
    sters = await _receipt(db, acc, "999.00", created_at=_at(date(2026, 9, 11)), is_deleted=True)
    await _line(db, sters, "Transport marfa", "999.00")
    fdl = await _receipt(db, acc, "999.00", created_at=_at(date(2026, 9, 12)), source="fdl")
    await _line(db, fdl, "Transport marfa", "999.00")
    afara = await _receipt(db, acc, "999.00", created_at=_at(date(2026, 10, 1)))
    await _line(db, afara, "Transport marfa", "999.00")
    strain = await _receipt(db, other, "999.00", created_at=_at(date(2026, 9, 10)))
    await _line(db, strain, "Transport marfa", "999.00")
    await db.commit()

    out = await _report(db, acc)
    k = out.kpi
    assert (k.linii, k.devize, k.denumiri) == (2, 1, 2)
    assert k.valoare_totala == Decimal("250.00")
    assert (k.valoare_produse, k.valoare_servicii, k.valoare_nespecificat) == (Decimal("150.00"), Decimal("100.00"), Decimal("0.00"))
    assert k.vanzari_totale == Decimal("350.00")
    assert round(k.pondere_pct, 2) == 71.43
    assert [g.denumire for g in out.grupuri] == ["Garnitura speciala", "Transport marfa"]
    transport = out.grupuri[1]
    assert (transport.tip, transport.cantitate, transport.pret_mediu) == ("Serviciu", Decimal(2), Decimal("50.00"))
    assert [(e.employee_name, e.linii, e.valoare) for e in out.angajati] == [("Fără angajat", 1, Decimal("150.00")), ("Ion", 1, Decimal("100.00"))]
    assert out.linii_total == 2 and {ln.denumire for ln in out.linii} == {"Transport marfa", "Garnitura speciala"}
    assert out.linii[0].locatie == "Centru"


async def test_same_name_written_differently_is_one_group():
    db, acc, *_ = await _fixture()
    r1 = await _receipt(db, acc, "100.00", created_at=_at(date(2026, 9, 3)))
    await _line(db, r1, "transport  marfa", "40.00", item_type=ItemType.SERVICE)
    r2 = await _receipt(db, acc, "100.00", created_at=_at(date(2026, 9, 20)))
    await _line(db, r2, "TRANSPORT MARFA", "60.00", item_type=ItemType.SERVICE)
    await _line(db, r2, "Transport marfa ", "70.00")
    await db.commit()
    out = await _report(db, acc)
    assert len(out.grupuri) == 1
    g = out.grupuri[0]
    assert (g.aparitii, g.devize, g.valoare) == (3, 2, Decimal("170.00"))
    assert (g.pret_min, g.pret_max, g.tip) == (Decimal("40.00"), Decimal("70.00"), "Mixt")
    assert g.ultima_data == date(2026, 9, 20)


async def test_flags_names_that_exist_in_the_catalog_with_other_casing():
    db, acc, *_, ulei = await _fixture()
    r = await _receipt(db, acc, "100.00", created_at=_at(date(2026, 9, 5)))
    await _line(db, r, "ULEI MOTOR", "100.00")      # catalogul are „Ulei motor”
    await _line(db, r, "Ceva nou", "10.00")
    await db.commit()
    out = await _report(db, acc)
    flags = {g.denumire: g.in_catalog_alta_scriere for g in out.grupuri}
    assert flags == {"ULEI MOTOR": True, "Ceva nou": False}


async def test_day_bounds_are_romanian_days_and_locations_filter():
    db, acc, _, loc1, loc2, *_ = await _fixture()
    # 30 sept, 23:30 ora Romaniei = 30 sept 20:30 UTC: intra in septembrie
    tarziu = await _receipt(db, acc, "10.00", location_id=loc1.id, created_at=_at(date(2026, 9, 30), 23) + timedelta(minutes=30))
    await _line(db, tarziu, "Seara", "10.00")
    # 1 oct, 00:30 ora Romaniei = 30 sept 21:30 UTC: NU intra in septembrie
    devreme = await _receipt(db, acc, "10.00", location_id=loc2.id, created_at=_at(date(2026, 10, 1), 0) + timedelta(minutes=30))
    await _line(db, devreme, "Dimineata", "10.00")
    await db.commit()
    assert [g.denumire for g in (await _report(db, acc)).grupuri] == ["Seara"]
    oct1 = await _report(db, acc, date_from=date(2026, 10, 1), date_to=date(2026, 10, 1))
    assert [g.denumire for g in oct1.grupuri] == ["Dimineata"]
    doar_nord = await _report(db, acc, date_from=date(2026, 9, 1), date_to=date(2026, 10, 1), location_ids=[loc2.id])
    assert [g.denumire for g in doar_nord.grupuri] == ["Dimineata"]


async def test_payment_status_is_shown_and_empty_period_is_zero():
    db, acc, *_ = await _fixture()
    r = await _receipt(db, acc, "80.00", created_at=_at(date(2026, 9, 15)), pay_method=PayMethod.CASH)
    await _line(db, r, "Manopera extra", "80.00")
    await db.commit()
    out = await _report(db, acc)
    assert out.linii[0].status_plata == PayMethod.CASH.value
    gol = await _report(db, acc, date_from=date(2025, 1, 1), date_to=date(2025, 1, 31))
    assert (gol.kpi.linii, gol.kpi.valoare_totala, gol.kpi.pondere_pct, gol.grupuri) == (0, Decimal("0.00"), 0.0, [])
    await raises_http(422, _report(db, acc, date_from=date(2026, 9, 30), date_to=date(2026, 9, 1)))


TESTS = [v for k, v in sorted(globals().items()) if k.startswith("test_")]

if __name__ == "__main__":
    for t in TESTS:
        run(t())
    print(f"OK — {len(TESTS)} scenarii raport linii introduse manual trecute.")
