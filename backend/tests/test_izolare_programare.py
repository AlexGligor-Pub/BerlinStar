"""Izolare intre conturi la programari: id-urile din body (client, locatie,
departament, angajat) trebuie sa apartina contului apelantului.

Rulabil cu pytest sau direct:  python -m tests.test_izolare_programare  (din backend/)
"""
from __future__ import annotations
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select

from app.models.department import Department
from app.models.location import Location
from app.models.programare import Programare
from app.routers.programare import (
    create_programare, get_programare, list_programari, update_programare,
)
from app.schemas.programare import ProgramareCreate, ProgramarePatch
from tests._harness import (
    make_account, make_client, make_employee, make_session, raises_http, run,
)

T0 = datetime(2026, 9, 7, 9, 0, tzinfo=timezone.utc)


class _Fx:
    """Doua conturi, fiecare cu locatie, departament, client si angajat."""


async def _side(db, acc, tag: str):
    loc = Location(account_id=acc.id, name=f"Locatie {tag}")
    dept = Department(account_id=acc.id, name=f"Dept {tag}")
    db.add_all([loc, dept])
    await db.flush()
    client = await make_client(db, acc, f"Client {tag}")
    emp = await make_employee(db, acc, f"Angajat {tag}")
    return loc, dept, client, emp


async def _fixture() -> _Fx:
    fx = _Fx()
    fx.db = await make_session()
    fx.acc = await make_account(fx.db)
    fx.other = await make_account(fx.db, username="alta", code="alta")
    fx.loc, fx.dept, fx.client, fx.emp = await _side(fx.db, fx.acc, "propriu")
    fx.f_loc, fx.f_dept, fx.f_client, fx.f_emp = await _side(fx.db, fx.other, "strain")
    await fx.db.commit()
    return fx


def _body(fx: _Fx, **kw) -> ProgramareCreate:
    base = dict(titlu="Revizie", location_id=fx.loc.id, start_time=T0, end_time=T0 + timedelta(hours=1))
    return ProgramareCreate(**{**base, **kw})


async def _count(fx: _Fx) -> int:
    return await fx.db.scalar(select(func.count()).select_from(Programare)) or 0


async def _legacy(fx: _Fx, **kw) -> Programare:
    """Programare scrisa direct in baza, ca cele salvate inainte de verificari."""
    p = Programare(
        account_id=fx.acc.id, titlu="Veche", location_id=fx.loc.id,
        start_time=T0, end_time=T0 + timedelta(hours=1), **kw,
    )
    fx.db.add(p)
    await fx.db.commit()
    return p


# ─── POST /api/programari ─────────────────────────────────────────────────────

async def test_create_with_own_ids_works():
    fx = await _fixture()
    p = await create_programare(
        _body(fx, client_id=fx.client.id, department_id=fx.dept.id, employee_id=fx.emp.id),
        db=fx.db, account_id=fx.acc.id,
    )
    assert (p.client_id, p.client_nume) == (fx.client.id, "Client propriu")
    assert (p.department_id, p.department_name) == (fx.dept.id, "Dept propriu")
    assert (p.location_id, p.employee_name) == (fx.loc.id, "Angajat propriu")


async def test_create_rejects_foreign_client():
    fx = await _fixture()
    detail = await raises_http(400, create_programare(
        _body(fx, client_id=fx.f_client.id), db=fx.db, account_id=fx.acc.id))
    assert "strain" not in detail
    assert await _count(fx) == 0


async def test_create_rejects_foreign_location():
    fx = await _fixture()
    await raises_http(400, create_programare(
        _body(fx, location_id=fx.f_loc.id), db=fx.db, account_id=fx.acc.id))
    assert await _count(fx) == 0


async def test_create_rejects_foreign_department():
    fx = await _fixture()
    detail = await raises_http(400, create_programare(
        _body(fx, department_id=fx.f_dept.id), db=fx.db, account_id=fx.acc.id))
    assert "strain" not in detail
    assert await _count(fx) == 0


async def test_create_same_answer_for_missing_and_foreign():
    fx = await _fixture()
    for field, foreign in (
        ("client_id", fx.f_client.id), ("location_id", fx.f_loc.id), ("department_id", fx.f_dept.id),
    ):
        d_foreign = await raises_http(400, create_programare(
            _body(fx, **{field: foreign}), db=fx.db, account_id=fx.acc.id))
        d_missing = await raises_http(400, create_programare(
            _body(fx, **{field: 99999}), db=fx.db, account_id=fx.acc.id))
        assert d_foreign == d_missing, field
    assert await _count(fx) == 0


async def test_create_rejects_deleted_own_rows():
    fx = await _fixture()
    fx.client.is_deleted = True
    fx.dept.is_deleted = True
    await fx.db.commit()
    await raises_http(400, create_programare(
        _body(fx, client_id=fx.client.id), db=fx.db, account_id=fx.acc.id))
    await raises_http(400, create_programare(
        _body(fx, department_id=fx.dept.id), db=fx.db, account_id=fx.acc.id))
    assert await _count(fx) == 0


async def test_create_accepts_deleted_own_location_but_not_foreign():
    """Locatia vine de la dispozitiv, iar stergerea ei nu dezleaga dispozitivele:
    statia trebuie sa poata face programari in continuare. A altui cont ramane
    refuzata, stearsa sau nu."""
    fx = await _fixture()
    fx.loc.is_deleted = True
    fx.f_loc.is_deleted = True
    await fx.db.commit()
    p = await create_programare(_body(fx), db=fx.db, account_id=fx.acc.id)
    assert p.location_id == fx.loc.id
    d_foreign = await raises_http(400, create_programare(
        _body(fx, location_id=fx.f_loc.id), db=fx.db, account_id=fx.acc.id))
    d_missing = await raises_http(400, create_programare(
        _body(fx, location_id=99999), db=fx.db, account_id=fx.acc.id))
    assert d_foreign == d_missing
    assert await _count(fx) == 1


# ─── PATCH /api/programari/{id} ───────────────────────────────────────────────

async def test_patch_with_own_ids_works_and_can_clear():
    fx = await _fixture()
    p = await create_programare(_body(fx), db=fx.db, account_id=fx.acc.id)
    p = await update_programare(
        p.id, ProgramarePatch(client_id=fx.client.id, department_id=fx.dept.id),
        db=fx.db, account_id=fx.acc.id,
    )
    assert (p.client_nume, p.department_name) == ("Client propriu", "Dept propriu")
    p = await update_programare(
        p.id, ProgramarePatch(client_id=None, department_id=None), db=fx.db, account_id=fx.acc.id)
    assert (p.client_id, p.department_id) == (None, None)


async def test_patch_rejects_foreign_client_and_keeps_previous():
    fx = await _fixture()
    p = await create_programare(_body(fx, client_id=fx.client.id), db=fx.db, account_id=fx.acc.id)
    d_foreign = await raises_http(400, update_programare(
        p.id, ProgramarePatch(client_id=fx.f_client.id, titlu="Schimbat"), db=fx.db, account_id=fx.acc.id))
    d_missing = await raises_http(400, update_programare(
        p.id, ProgramarePatch(client_id=99999), db=fx.db, account_id=fx.acc.id))
    assert d_foreign == d_missing
    got = await get_programare(p.id, db=fx.db, account_id=fx.acc.id)
    assert (got.client_id, got.client_nume, got.titlu) == (fx.client.id, "Client propriu", "Revizie")


async def test_patch_rejects_foreign_department_and_keeps_previous():
    fx = await _fixture()
    p = await create_programare(_body(fx, department_id=fx.dept.id), db=fx.db, account_id=fx.acc.id)
    d_foreign = await raises_http(400, update_programare(
        p.id, ProgramarePatch(department_id=fx.f_dept.id, titlu="Schimbat"), db=fx.db, account_id=fx.acc.id))
    d_missing = await raises_http(400, update_programare(
        p.id, ProgramarePatch(department_id=99999), db=fx.db, account_id=fx.acc.id))
    assert d_foreign == d_missing
    got = await get_programare(p.id, db=fx.db, account_id=fx.acc.id)
    assert (got.department_id, got.department_name, got.titlu) == (fx.dept.id, "Dept propriu", "Revizie")


async def test_patch_unchanged_legacy_deleted_ids_still_work():
    fx = await _fixture()
    p = await _legacy(fx, client_id=fx.client.id, department_id=fx.dept.id, employee_id=fx.emp.id)
    fx.client.is_deleted = True
    fx.dept.is_deleted = True
    fx.emp.is_deleted = True
    await fx.db.commit()
    # Formularul de editare retrimite toate campurile, inclusiv id-urile neschimbate.
    out = await update_programare(
        p.id,
        ProgramarePatch(
            titlu="Editata", client_id=fx.client.id, department_id=fx.dept.id, employee_id=fx.emp.id,
        ),
        db=fx.db, account_id=fx.acc.id,
    )
    assert out.titlu == "Editata"
    assert (out.client_id, out.department_id, out.employee_id) == (fx.client.id, fx.dept.id, fx.emp.id)
    # Fara id-uri in body merge la fel.
    out = await update_programare(p.id, ProgramarePatch(notite="x"), db=fx.db, account_id=fx.acc.id)
    assert out.notite == "x"


async def test_legacy_foreign_ids_stay_editable_but_names_are_hidden():
    fx = await _fixture()
    p = await _legacy(
        fx, client_id=fx.f_client.id, department_id=fx.f_dept.id, employee_id=fx.f_emp.id)
    out = await update_programare(
        p.id,
        ProgramarePatch(
            titlu="Editata", client_id=fx.f_client.id, department_id=fx.f_dept.id,
            employee_id=fx.f_emp.id,
        ),
        db=fx.db, account_id=fx.acc.id,
    )
    assert out.titlu == "Editata"
    assert (out.client_nume, out.department_name, out.employee_name) == (None, None, None)
    got = await get_programare(p.id, db=fx.db, account_id=fx.acc.id)
    assert (got.client_nume, got.department_name, got.employee_name) == (None, None, None)
    # Cautarea nu poate ghici numele clientului altui cont.
    assert await list_programari(q="Client strain", limit=200, offset=0, db=fx.db, account_id=fx.acc.id) == []
    assert len(await list_programari(q="Editata", limit=200, offset=0, db=fx.db, account_id=fx.acc.id)) == 1


async def test_search_by_own_client_name_still_works():
    fx = await _fixture()
    await create_programare(_body(fx, client_id=fx.client.id), db=fx.db, account_id=fx.acc.id)
    rows = await list_programari(q="Client propriu", limit=200, offset=0, db=fx.db, account_id=fx.acc.id)
    assert [r.client_nume for r in rows] == ["Client propriu"]


TESTS = [v for k, v in sorted(globals().items()) if k.startswith("test_")]

if __name__ == "__main__":
    for t in TESTS:
        run(t())
    print(f"OK — {len(TESTS)} scenarii izolare programari trecute.")
