"""Izolare intre conturi la cererile de concediu: `location_id` din body.

Regresia pe care o prinde: POST /api/leaves si PATCH /api/leaves/{id} salvau orice
location_id, iar raspunsul intorcea `location_name` — inclusiv numele unei locatii
din ALT cont.

Rulabil cu pytest sau direct:  python -m tests.test_izolare_leaves  (din backend/)
"""
from __future__ import annotations
from datetime import date, time

from sqlalchemy import func, select, update
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles

from app.models.employee import Employee
from app.models.leave import Leave, LeaveStatus, LeaveType
from app.models.location import Location
from app.routers.leaves import create_leave, get_leave, list_leaves, update_leave
from app.schemas.leave import LeaveCreate, LeavePatch
from tests._harness import make_account, make_employee, make_session, raises_http, run

DAY = date(2026, 9, 7)  # luni


# `leaves.details_snapshot` e JSONB (tip specific Postgres), asa ca harness-ul sare
# tabela pe SQLite. Aici o cream explicit, cu JSONB compilat ca JSON.
@compiles(JSONB, "sqlite")
def _jsonb_as_json(_type, _compiler, **_kw) -> str:
    return "JSON"


async def _location(db, acc, name: str) -> Location:
    loc = Location(account_id=acc.id, name=name)
    db.add(loc)
    await db.flush()
    return loc


async def _fixture():
    db = await make_session()
    conn = await db.connection()
    await conn.run_sync(Leave.__table__.create, checkfirst=True)
    acc = await make_account(db)
    other = await make_account(db, username="alta", code="alta")
    emp = await make_employee(db, acc, "Ion")
    loc = await _location(db, acc, "Sediu")
    loc2 = await _location(db, acc, "Depozit")
    foreign = await _location(db, other, "Strain")
    await db.commit()
    return db, acc, other, emp, loc, loc2, foreign


def _body(emp, **kw) -> LeaveCreate:
    # Implicit o invoire (tip pe ore): nu trece prin snapshot-ul de date legale.
    base = dict(
        employee_id=emp.id, type=LeaveType.PERMISSION, start_date=DAY, end_date=DAY,
        start_time=time(9, 0), end_time=time(11, 0),
    )
    return LeaveCreate(**{**base, **kw})


# Fiecare apel porneste cu sesiunea goala, ca o cerere HTTP noua: altfel relatiile
# deja incarcate (Leave.location) ar ramane cele vechi dupa un PATCH.
async def _create(db, acc, emp, **kw):
    db.expunge_all()
    return await create_leave(_body(emp, **kw), db=db, account_id=acc.id)


async def _patch(db, acc, leave_id: int, **kw):
    db.expunge_all()
    return await update_leave(leave_id, LeavePatch(**kw), db=db, account_id=acc.id)


async def _get(db, acc, leave_id: int):
    db.expunge_all()
    return await get_leave(leave_id, db=db, account_id=acc.id)


async def _count(db, acc) -> int:
    return (await db.execute(
        select(func.count()).select_from(Leave).where(Leave.account_id == acc.id)
    )).scalar_one()


async def _soft_delete_location(db, loc) -> None:
    await db.execute(update(Location).where(Location.id == loc.id).values(is_deleted=True))
    await db.commit()


async def _legacy_leave(db, acc, emp, location_id: int) -> int:
    """Cerere salvata direct, ca un rand dinaintea verificarii de apartenenta."""
    l = Leave(
        account_id=acc.id, employee_id=emp.id, location_id=location_id,
        type=LeaveType.PERMISSION, status=LeaveStatus.PENDING,
        start_date=DAY, end_date=DAY, working_days=0,
        start_time=time(9, 0), end_time=time(11, 0), hours=2,
    )
    db.add(l)
    await db.commit()
    return l.id


# ─── POST /api/leaves ─────────────────────────────────────────────────────────

async def test_create_rejects_foreign_location_and_stores_nothing():
    db, acc, _, emp, _, _, foreign = await _fixture()
    detail = await raises_http(400, _create(db, acc, emp, location_id=foreign.id))
    assert "Strain" not in detail
    assert await _count(db, acc) == 0


async def test_create_rejects_foreign_location_for_day_based_leave():
    db, acc, _, emp, _, _, foreign = await _fixture()
    await raises_http(400, _create(
        db, acc, emp, type=LeaveType.SICK, start_time=None, end_time=None, location_id=foreign.id,
    ))
    assert await _count(db, acc) == 0


async def test_create_missing_foreign_and_deleted_location_get_the_same_answer():
    db, acc, _, emp, loc, _, foreign = await _fixture()
    d_foreign = await raises_http(400, _create(db, acc, emp, location_id=foreign.id))
    d_missing = await raises_http(400, _create(db, acc, emp, location_id=99999))
    await _soft_delete_location(db, loc)
    d_deleted = await raises_http(400, _create(db, acc, emp, location_id=loc.id))
    assert d_foreign == d_missing == d_deleted
    assert await _count(db, acc) == 0


async def test_create_with_own_location_works():
    db, acc, _, emp, loc, *_ = await _fixture()
    res = await _create(db, acc, emp, location_id=loc.id)
    assert (res.location_id, res.location_name) == (loc.id, "Sediu")
    assert await _count(db, acc) == 1


async def test_create_day_based_leave_with_own_location_works():
    db, acc, _, emp, loc, *_ = await _fixture()
    res = await _create(
        db, acc, emp, type=LeaveType.SICK, start_time=None, end_time=None, location_id=loc.id,
    )
    assert (res.location_id, res.location_name, res.working_days) == (loc.id, "Sediu", 1)


async def test_create_without_location_still_works():
    db, acc, _, emp, *_ = await _fixture()
    res = await _create(db, acc, emp)
    assert res.location_id is None and res.location_name is None


async def test_create_without_location_falls_back_to_employee_location():
    db, acc, _, _, loc, *_ = await _fixture()
    db.expunge_all()
    own_loc = await db.get(Location, loc.id)
    emp2 = Employee(account_id=acc.id, name="Maria", locations=[own_loc])
    db.add(emp2)
    await db.commit()
    res = await _create(db, acc, emp2)
    assert (res.location_id, res.location_name) == (loc.id, "Sediu")


# ─── PATCH /api/leaves/{id} ───────────────────────────────────────────────────

async def test_patch_rejects_foreign_location_and_keeps_previous():
    db, acc, _, emp, loc, _, foreign = await _fixture()
    created = await _create(db, acc, emp, location_id=loc.id)
    d_foreign = await raises_http(400, _patch(db, acc, created.id, location_id=foreign.id, notes="x"))
    d_missing = await raises_http(400, _patch(db, acc, created.id, location_id=99999))
    assert d_foreign == d_missing and "Strain" not in d_foreign
    got = await _get(db, acc, created.id)
    assert (got.location_id, got.location_name, got.notes) == (loc.id, "Sediu", None)


async def test_patch_to_own_location_and_clearing_work():
    db, acc, _, emp, loc, loc2, _ = await _fixture()
    created = await _create(db, acc, emp, location_id=loc.id)
    res = await _patch(db, acc, created.id, location_id=loc2.id)
    assert (res.location_id, res.location_name) == (loc2.id, "Depozit")
    res = await _patch(db, acc, created.id, notes="doar nota")
    assert (res.location_id, res.notes) == (loc2.id, "doar nota")
    res = await _patch(db, acc, created.id, location_id=None)
    assert res.location_id is None and res.location_name is None


async def test_patch_rejects_switching_to_a_deleted_location():
    db, acc, _, emp, loc, loc2, _ = await _fixture()
    created = await _create(db, acc, emp, location_id=loc.id)
    await _soft_delete_location(db, loc2)
    await raises_http(400, _patch(db, acc, created.id, location_id=loc2.id))
    got = await _get(db, acc, created.id)
    assert got.location_id == loc.id


async def test_patch_with_unchanged_legacy_deleted_location_still_works():
    db, acc, _, emp, loc, *_ = await _fixture()
    created = await _create(db, acc, emp, location_id=loc.id)
    await _soft_delete_location(db, loc)
    # Formularul retrimite location_id-ul existent impreuna cu restul campurilor.
    res = await _patch(db, acc, created.id, location_id=loc.id, notes="editat")
    assert (res.location_id, res.notes) == (loc.id, "editat")
    res = await _patch(db, acc, created.id, end_time=time(12, 0))
    assert res.location_id == loc.id and float(res.hours) == 3.0


async def test_legacy_row_with_foreign_location_stays_editable_but_hides_the_name():
    db, acc, _, emp, _, _, foreign = await _fixture()
    leave_id = await _legacy_leave(db, acc, emp, foreign.id)
    res = await _patch(db, acc, leave_id, location_id=foreign.id, notes="editat")
    assert (res.location_id, res.location_name, res.notes) == (foreign.id, None, "editat")
    got = await _get(db, acc, leave_id)
    assert got.location_name is None
    db.expunge_all()
    rows = await list_leaves(limit=200, offset=0, db=db, account_id=acc.id)
    assert [r.location_name for r in rows] == [None]


async def test_foreign_leave_stays_404_whatever_the_location():
    db, acc, other, emp, loc, _, foreign = await _fixture()
    created = await _create(db, acc, emp, location_id=loc.id)
    await raises_http(404, _patch(db, other, created.id, location_id=foreign.id))
    got = await _get(db, acc, created.id)
    assert got.location_id == loc.id


TESTS = [v for k, v in sorted(globals().items()) if k.startswith("test_")]

if __name__ == "__main__":
    for t in TESTS:
        run(t())
    print(f"OK — {len(TESTS)} scenarii de izolare la cererile de concediu trecute.")
