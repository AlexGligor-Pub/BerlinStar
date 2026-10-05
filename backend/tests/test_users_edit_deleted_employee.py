"""Editarea unui utilizator legat de un angajat sters.

Regresie: formularul de editare retrimite mereu `employee_id`-ul stocat, iar
validarea il respingea cu 400 daca angajatul fusese sters intre timp. Userul
nu mai putea fi editat deloc (nume, rol, activ) si nu exista cale de reparare
din UI.

Regula corecta:
  - un `employee_id` NESCHIMBAT nu se revalideaza (restul campurilor se pot
    edita, iar legatura se poate goli);
  - un `employee_id` NOU trebuie in continuare sa fie un angajat activ din
    acelasi cont.

Rulabil cu pytest sau direct:  python -m tests.test_users_edit_deleted_employee
"""
from __future__ import annotations

from app.models.user import UserRole
from app.services import users_service as svc
from tests._harness import (
    make_account, make_employee, make_session, make_user, raises_http, run,
)


async def _fixture():
    """Cont cu un admin si cu userul „ion", legat de un angajat sters ulterior."""
    db = await make_session()
    acc = await make_account(db)
    await make_user(db, acc, "admin", UserRole.ADMIN)
    emp = await make_employee(db, acc, "Ion Popescu")
    await db.commit()
    ion = await svc.create_user(
        db, acc.id, "ion", "parolaunga1", UserRole.WORKER, "Ion", employee_id=emp.id,
    )
    emp.is_deleted = True
    await db.commit()
    return db, acc, ion, emp


# ─── Legatura neschimbata ─────────────────────────────────────────────────────

async def test_other_fields_are_editable_while_the_deleted_employee_is_kept():
    db, acc, ion, emp = await _fixture()
    updated = await svc.update_user(db, acc.id, ion.id, {
        "name": "Ion Schimbat",
        "email": "ion@example.com",
        "role": UserRole.MANAGER,
        "employee_id": emp.id,
    })
    assert updated.name == "Ion Schimbat"
    assert updated.email == "ion@example.com"
    assert updated.role == UserRole.MANAGER
    assert updated.employee_id == emp.id


async def test_user_can_be_deactivated_while_the_deleted_employee_is_kept():
    db, acc, ion, emp = await _fixture()
    updated = await svc.update_user(db, acc.id, ion.id, {
        "is_active": False, "employee_id": emp.id,
    })
    assert updated.is_active is False
    assert updated.employee_id == emp.id


async def test_patch_without_employee_id_leaves_the_link_untouched():
    db, acc, ion, emp = await _fixture()
    updated = await svc.update_user(db, acc.id, ion.id, {"name": "Ion Schimbat"})
    assert updated.name == "Ion Schimbat"
    assert updated.employee_id == emp.id


# ─── Golirea legaturii ────────────────────────────────────────────────────────

async def test_link_to_a_deleted_employee_can_be_cleared():
    db, acc, ion, _emp = await _fixture()
    cleared = await svc.update_user(db, acc.id, ion.id, {"employee_id": None})
    assert cleared.employee_id is None


async def test_deleted_employee_cannot_be_reassigned_after_clearing():
    """Toleranta e doar pentru valoarea deja stocata: odata golita legatura,
    angajatul sters redevine o atribuire noua, deci respinsa."""
    db, acc, ion, emp = await _fixture()
    await svc.update_user(db, acc.id, ion.id, {"employee_id": None})
    await raises_http(400, svc.update_user(db, acc.id, ion.id, {"employee_id": emp.id}))


# ─── Atribuirile noi raman validate ───────────────────────────────────────────

async def test_assigning_a_deleted_employee_is_still_rejected():
    db, acc, _ion, emp = await _fixture()
    vasile = await svc.create_user(db, acc.id, "vasile", "parolaunga1", UserRole.WORKER, "Vasile")
    await raises_http(400, svc.update_user(db, acc.id, vasile.id, {"employee_id": emp.id}))
    await db.refresh(vasile)
    assert vasile.employee_id is None


async def test_swapping_to_another_deleted_employee_is_still_rejected():
    db, acc, ion, emp = await _fixture()
    alt = await make_employee(db, acc, "Alt Angajat")
    alt.is_deleted = True
    await db.commit()
    await raises_http(400, svc.update_user(db, acc.id, ion.id, {"employee_id": alt.id}))
    await db.refresh(ion)
    assert ion.employee_id == emp.id


async def test_creating_a_user_with_a_deleted_employee_is_still_rejected():
    db, acc, _ion, emp = await _fixture()
    await raises_http(400, svc.create_user(
        db, acc.id, "vasile", "parolaunga1", UserRole.WORKER, "Vasile", employee_id=emp.id,
    ))


async def test_assigning_another_accounts_employee_is_still_rejected():
    db, acc, ion, emp = await _fixture()
    other = await make_account(db, username="alta", code="alta")
    strain = await make_employee(db, other, "Angajat strain")
    await db.commit()
    await raises_http(400, svc.update_user(db, acc.id, ion.id, {"employee_id": strain.id}))
    await db.refresh(ion)
    assert ion.employee_id == emp.id


async def test_swapping_to_an_active_own_employee_is_accepted():
    db, acc, ion, _emp = await _fixture()
    nou = await make_employee(db, acc, "Ion Nou")
    await db.commit()
    updated = await svc.update_user(db, acc.id, ion.id, {"employee_id": nou.id})
    assert updated.employee_id == nou.id


TESTS = [v for k, v in sorted(globals().items()) if k.startswith("test_")]

if __name__ == "__main__":
    for t in TESTS:
        run(t())
    print(f"OK — {len(TESTS)} scenarii de editare cu angajat sters trecute.")
