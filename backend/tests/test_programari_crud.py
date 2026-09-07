"""CRUD programari cu legatura la angajat: creare, editare, filtru, validari.

Rulabil cu pytest sau direct:  python -m tests.test_programari_crud  (din backend/)
"""
from __future__ import annotations
from datetime import datetime, timedelta, timezone

from app.routers.programare import (
    create_programare, delete_programare, get_programare, list_programari, update_programare,
)
from app.schemas.programare import ProgramareCreate, ProgramarePatch
from tests._harness import make_account, make_employee, make_session, raises_http, run

T0 = datetime(2026, 9, 7, 9, 0, tzinfo=timezone.utc)


def _body(**kw) -> ProgramareCreate:
    base = dict(titlu="Revizie", location_id=1, start_time=T0, end_time=T0 + timedelta(hours=1))
    return ProgramareCreate(**{**base, **kw})


async def _fixture():
    db = await make_session()
    acc = await make_account(db)
    other = await make_account(db, username="alta", code="alta")
    emp = await make_employee(db, acc, "Ion")
    emp2 = await make_employee(db, acc, "Maria")
    foreign = await make_employee(db, other, "Strain")
    return db, acc, other, emp, emp2, foreign


async def test_create_with_employee_serializes_name():
    db, acc, _, emp, *_ = await _fixture()
    p = await create_programare(_body(employee_id=emp.id), db=db, account_id=acc.id)
    assert (p.employee_id, p.employee_name) == (emp.id, "Ion")
    got = await get_programare(p.id, db=db, account_id=acc.id)
    assert got.employee_name == "Ion"


async def test_create_without_employee_is_allowed():
    db, acc, *_ = await _fixture()
    p = await create_programare(_body(), db=db, account_id=acc.id)
    assert p.employee_id is None and p.employee_name is None


async def test_create_rejects_foreign_or_deleted_or_missing_employee():
    db, acc, _, emp, _, foreign = await _fixture()
    await raises_http(400, create_programare(_body(employee_id=foreign.id), db=db, account_id=acc.id))
    await raises_http(400, create_programare(_body(employee_id=99999), db=db, account_id=acc.id))
    emp.is_deleted = True
    await db.commit()
    await raises_http(400, create_programare(_body(employee_id=emp.id), db=db, account_id=acc.id))


async def test_patch_assigns_reassigns_and_unassigns():
    db, acc, _, emp, emp2, _ = await _fixture()
    p = await create_programare(_body(), db=db, account_id=acc.id)
    p = await update_programare(p.id, ProgramarePatch(employee_id=emp.id), db=db, account_id=acc.id)
    assert p.employee_name == "Ion"
    p = await update_programare(p.id, ProgramarePatch(employee_id=emp2.id), db=db, account_id=acc.id)
    assert p.employee_name == "Maria"
    p = await update_programare(p.id, ProgramarePatch(titlu="Alt titlu"), db=db, account_id=acc.id)
    assert (p.titlu, p.employee_id) == ("Alt titlu", emp2.id)
    p = await update_programare(p.id, ProgramarePatch(employee_id=None), db=db, account_id=acc.id)
    assert p.employee_id is None and p.employee_name is None


async def test_patch_invalid_employee_is_400_and_keeps_previous():
    db, acc, _, emp, _, foreign = await _fixture()
    p = await create_programare(_body(employee_id=emp.id), db=db, account_id=acc.id)
    await raises_http(400, update_programare(p.id, ProgramarePatch(employee_id=foreign.id), db=db, account_id=acc.id))
    await raises_http(400, update_programare(p.id, ProgramarePatch(employee_id=99999), db=db, account_id=acc.id))
    got = await get_programare(p.id, db=db, account_id=acc.id)
    assert got.employee_id == emp.id


async def test_no_overlap_limit():
    db, acc, _, emp, *_ = await _fixture()
    for _ in range(5):
        await create_programare(_body(employee_id=emp.id), db=db, account_id=acc.id)
    rows = await list_programari(limit=200, offset=0, db=db, account_id=acc.id)
    assert len(rows) == 5


async def test_list_filters_by_employee_and_isolates_accounts():
    db, acc, other, emp, emp2, foreign = await _fixture()
    await create_programare(_body(employee_id=emp.id), db=db, account_id=acc.id)
    await create_programare(_body(employee_id=emp2.id), db=db, account_id=acc.id)
    await create_programare(_body(), db=db, account_id=acc.id)
    await create_programare(_body(employee_id=foreign.id), db=db, account_id=other.id)
    assert len(await list_programari(limit=200, offset=0, db=db, account_id=acc.id)) == 3
    only = await list_programari(employee_id=emp.id, limit=200, offset=0, db=db, account_id=acc.id)
    assert [r.employee_name for r in only] == ["Ion"]
    assert await list_programari(employee_id=foreign.id, limit=200, offset=0, db=db, account_id=acc.id) == []


async def test_delete_is_soft_and_hidden_from_list():
    db, acc, _, emp, *_ = await _fixture()
    p = await create_programare(_body(employee_id=emp.id), db=db, account_id=acc.id)
    await delete_programare(p.id, db=db, account_id=acc.id)
    assert await list_programari(limit=200, offset=0, db=db, account_id=acc.id) == []
    assert len(await list_programari(include_deleted=True, limit=200, offset=0, db=db, account_id=acc.id)) == 1
    await raises_http(404, get_programare(p.id, db=db, account_id=acc.id))


TESTS = [v for k, v in sorted(globals().items()) if k.startswith("test_")]

if __name__ == "__main__":
    for t in TESTS:
        run(t())
    print(f"OK — {len(TESTS)} scenarii CRUD programari trecute.")
