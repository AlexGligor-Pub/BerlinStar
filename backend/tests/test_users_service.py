"""Regulile de business din gestiunea utilizatorilor.

Acopera invariantii care, daca se rup, produc pagube tacute:
  - contul rămâne mereu cu cel putin un admin activ (altfel nimeni nu mai poate
    administra nimic, si nu exista cale de iesire din UI);
  - username-ul unui utilizator sters redevine liber (era rezervat pe veci de
    constrangerea unica totala);
  - `employee_id` nu poate trimite spre angajatul altei firme.

Rulabil cu pytest sau direct:  python -m tests.test_users_service
"""
from __future__ import annotations

from app.models.user import UserRole
from app.services import users_service as svc
from tests._harness import (
    make_account, make_employee, make_session, make_user, raises_http, run,
)


async def _fixture():
    db = await make_session()
    acc = await make_account(db)
    admin = await make_user(db, acc, "admin", UserRole.ADMIN)
    await db.commit()
    return db, acc, admin


# ─── Ultimul administrator ────────────────────────────────────────────────────

async def test_cannot_demote_the_last_admin():
    db, acc, admin = await _fixture()
    await raises_http(400, svc.update_user(db, acc.id, admin.id, {"role": UserRole.WORKER}))


async def test_cannot_deactivate_the_last_admin():
    db, acc, admin = await _fixture()
    await raises_http(400, svc.update_user(db, acc.id, admin.id, {"is_active": False}))


async def test_cannot_delete_the_last_admin():
    db, acc, admin = await _fixture()
    await raises_http(400, svc.delete_user(db, acc.id, admin.id))


async def test_can_demote_when_another_admin_exists():
    db, acc, admin = await _fixture()
    await make_user(db, acc, "admin2", UserRole.ADMIN)
    await db.commit()
    updated = await svc.update_user(db, acc.id, admin.id, {"role": UserRole.WORKER})
    assert updated.role == UserRole.WORKER


async def test_an_inactive_second_admin_does_not_count():
    db, acc, admin = await _fixture()
    await make_user(db, acc, "admin2", UserRole.ADMIN, is_active=False)
    await db.commit()
    await raises_http(400, svc.delete_user(db, acc.id, admin.id))


# ─── Unicitatea username-ului ─────────────────────────────────────────────────

async def test_duplicate_username_is_rejected():
    db, acc, _admin = await _fixture()
    await svc.create_user(db, acc.id, "ion", "parolaunga1", UserRole.WORKER, "Ion")
    await raises_http(400, svc.create_user(db, acc.id, "ion", "parolaunga1", UserRole.WORKER, "Ion 2"))


async def test_username_of_a_deleted_user_can_be_reused():
    """Regresie: numele era blocat definitiv, fiindca unicitatea numara si
    randurile sterse."""
    db, acc, _admin = await _fixture()
    ion = await svc.create_user(db, acc.id, "ion", "parolaunga1", UserRole.WORKER, "Ion")
    await svc.delete_user(db, acc.id, ion.id)

    recreat = await svc.create_user(db, acc.id, "ion", "parolaunga2", UserRole.WORKER, "Ion Nou")
    assert recreat.id != ion.id
    assert recreat.username == "ion"
    # Cel vechi rămâne in baza pentru audit, dar in afara listei.
    listed = await svc.list_users(db, acc.id)
    assert [u.id for u in listed if u.username == "ion"] == [recreat.id]


async def test_same_username_in_another_account_is_fine():
    db, acc, _admin = await _fixture()
    other = await make_account(db, username="alta", code="alta")
    await db.commit()
    await svc.create_user(db, acc.id, "ion", "parolaunga1", UserRole.WORKER, "Ion")
    await svc.create_user(db, other.id, "ion", "parolaunga1", UserRole.WORKER, "Ion")


async def test_rename_onto_an_existing_username_is_rejected():
    db, acc, _admin = await _fixture()
    await svc.create_user(db, acc.id, "ion", "parolaunga1", UserRole.WORKER, "Ion")
    vasile = await svc.create_user(db, acc.id, "vasile", "parolaunga1", UserRole.WORKER, "Vasile")
    await raises_http(400, svc.update_user(db, acc.id, vasile.id, {"username": "ion"}))


# ─── Legatura cu angajatul ────────────────────────────────────────────────────

async def test_employee_from_another_account_is_rejected_on_create():
    db, acc, _admin = await _fixture()
    other = await make_account(db, username="alta", code="alta")
    strain = await make_employee(db, other, "Angajat strain")
    await db.commit()
    await raises_http(400, svc.create_user(
        db, acc.id, "ion", "parolaunga1", UserRole.WORKER, "Ion", employee_id=strain.id,
    ))


async def test_employee_from_another_account_is_rejected_on_update():
    db, acc, _admin = await _fixture()
    other = await make_account(db, username="alta", code="alta")
    strain = await make_employee(db, other, "Angajat strain")
    await db.commit()
    ion = await svc.create_user(db, acc.id, "ion", "parolaunga1", UserRole.WORKER, "Ion")
    await raises_http(400, svc.update_user(db, acc.id, ion.id, {"employee_id": strain.id}))


async def test_own_employee_is_accepted_and_can_be_cleared():
    db, acc, _admin = await _fixture()
    emp = await make_employee(db, acc, "Ion Popescu")
    await db.commit()
    ion = await svc.create_user(
        db, acc.id, "ion", "parolaunga1", UserRole.WORKER, "Ion", employee_id=emp.id,
    )
    assert ion.employee_id == emp.id
    cleared = await svc.update_user(db, acc.id, ion.id, {"employee_id": None})
    assert cleared.employee_id is None


# ─── Izolarea pe cont ─────────────────────────────────────────────────────────

async def test_cannot_touch_a_user_of_another_account():
    db, acc, _admin = await _fixture()
    other = await make_account(db, username="alta", code="alta")
    strain = await make_user(db, other, "strain", UserRole.ADMIN)
    await db.commit()
    await raises_http(404, svc.update_user(db, acc.id, strain.id, {"name": "Hack"}))
    await raises_http(404, svc.delete_user(db, acc.id, strain.id))
    await raises_http(404, svc.set_password(db, acc.id, strain.id, "parolaunga1"))


TESTS = [v for k, v in sorted(globals().items()) if k.startswith("test_")]

if __name__ == "__main__":
    for t in TESTS:
        run(t())
    print(f"OK — {len(TESTS)} scenarii de gestiune utilizatori trecute.")
