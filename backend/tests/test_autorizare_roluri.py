"""Autorizare pe roluri si pe stare, plus cele doua piese de infrastructura din
jurul login-ului: parola lunga si cheia limitei de rata.

Regresiile pe care le prinde:
  - un `worker` putea crea / edita / sterge angajati (inclusiv propriul sold de
    concediu) si putea modifica sau sterge o cerere de concediu deja aprobata;
  - aprobarea retinea numele firmei, nu al omului care a aprobat;
  - o parola peste 72 de octeti dadea 500 la salvare si 401 la login (bcrypt 5);
  - toate limitele pe IP aveau o singura galeata: adresa containerului nginx;
  - inregistrarea accepta un username gol si raspundea 409 pentru un nume
    purtat de un cont sters.

Rulabil cu pytest sau direct:  python -m tests.test_autorizare_roluri  (din backend/)
"""
from __future__ import annotations
import base64
from datetime import date, time

import bcrypt
from fastapi import BackgroundTasks
from pydantic import ValidationError
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles
from starlette.requests import Request

from app.auth_context import AuthContext
from app.dependencies import get_settings_account_id
from app.models.account import Account
from app.models.employee import Employee
from app.models.leave import Leave, LeaveStatus, LeaveType
from app.models.user import UserRole
from app.rate_limit import client_ip_from_chain, client_key, limiter
from app.routers import auth as auth_router
from app.routers.auth import RegisterRequest
from app.routers.employees import create_employee, delete_employee, update_employee
from app.routers.leaves import (
    approve_leave, consent_leave, create_leave, delete_leave, get_leave, reject_leave, update_leave,
)
from app.schemas.employee import EmployeeCreate, EmployeeUpdate
from app.schemas.leave import LeaveApprove, LeaveConsent, LeaveCreate, LeavePatch
from app.utils.security import hash_password_sync, verify_password_sync
from tests._harness import make_account, make_employee, make_session, make_user, raises_http, run
from tests.test_route_authorization import ROLE_DEPS, WRITE_METHODS, _dep_names, _routes

DAY = date(2026, 9, 7)  # luni

_register = getattr(auth_router.register, "__wrapped__", auth_router.register)


# `leaves.details_snapshot` e JSONB (tip specific Postgres), asa ca harness-ul sare
# tabela pe SQLite. Aici o cream explicit, cu JSONB compilat ca JSON.
@compiles(JSONB, "sqlite")
def _jsonb_as_json(_type, _compiler, **_kw) -> str:
    return "JSON"


def _ctx(user, acc) -> AuthContext:
    # Handlerele folosesc doar userul si contul; sesiunea nu intra in joc aici.
    return AuthContext(user=user, session=None, account=acc)


async def _fixture():
    db = await make_session()
    conn = await db.connection()
    await conn.run_sync(Leave.__table__.create, checkfirst=True)
    acc = await make_account(db)
    emp = await make_employee(db, acc, "Ion")
    worker = _ctx(await make_user(db, acc, "ion", UserRole.WORKER, name="Ion Lucrator"), acc)
    manager = _ctx(await make_user(db, acc, "maria", UserRole.MANAGER, name="Maria Manager"), acc)
    admin = _ctx(await make_user(db, acc, "sef", UserRole.ADMIN, name="Sef Admin"), acc)
    await db.commit()
    return db, acc, emp, worker, manager, admin


# Fiecare apel porneste cu sesiunea goala, ca o cerere HTTP noua.
async def _new_leave(db, acc, emp) -> int:
    db.expunge_all()
    # O invoire (tip pe ore): nu trece prin snapshot-ul de date legale.
    body = LeaveCreate(
        employee_id=emp.id, type=LeaveType.PERMISSION, start_date=DAY, end_date=DAY,
        start_time=time(9, 0), end_time=time(11, 0),
    )
    return (await create_leave(body, db=db, account_id=acc.id)).id


async def _patch(db, acc, ctx, leave_id: int, **kw):
    db.expunge_all()
    return await update_leave(leave_id, LeavePatch(**kw), db=db, account_id=acc.id, ctx=ctx)


async def _delete(db, acc, ctx, leave_id: int):
    db.expunge_all()
    return await delete_leave(leave_id, db=db, account_id=acc.id, ctx=ctx)


async def _consent(db, acc, ctx, leave_id: int):
    db.expunge_all()
    return await consent_leave(
        leave_id, LeaveConsent(employee_consent=True), db=db, account_id=acc.id, ctx=ctx,
    )


async def _approve(db, acc, ctx, leave_id: int):
    db.expunge_all()
    # Dependinta de rol ruleaza inaintea handlerului, exact ca in FastAPI.
    account_id = await get_settings_account_id(ctx=ctx)
    return await approve_leave(
        leave_id, LeaveApprove(approver_consent=True), db=db, account_id=account_id, ctx=ctx,
    )


async def _reject(db, acc, ctx, leave_id: int):
    db.expunge_all()
    account_id = await get_settings_account_id(ctx=ctx)
    return await reject_leave(leave_id, db=db, account_id=account_id, ctx=ctx)


async def _get(db, acc, leave_id: int):
    db.expunge_all()
    return await get_leave(leave_id, db=db, account_id=acc.id)


# ─── Angajati: scrierile cer rol ──────────────────────────────────────────────

async def test_worker_is_rejected_on_employee_writes_manager_and_admin_pass():
    db, acc, emp, worker, manager, admin = await _fixture()
    detail = await raises_http(403, get_settings_account_id(ctx=worker))
    assert "Setari" in detail

    for ctx in (manager, admin):
        account_id = await get_settings_account_id(ctx=ctx)
        assert account_id == acc.id
        created = await create_employee(
            EmployeeCreate(name=f"Nou {ctx.user.username}"), db=db, account_id=account_id,
        )
        updated = await update_employee(
            created.id, EmployeeUpdate(annual_vacation_days=25), db=db, account_id=account_id,
        )
        assert updated.annual_vacation_days == 25
        await delete_employee(created.id, db=db, account_id=account_id)
        assert (await db.get(Employee, created.id)).is_deleted is True


def test_every_employee_write_route_carries_a_role_gate():
    writes, reads = [], []
    for route in _routes():
        if not route.path.startswith("/api/employees"):
            continue
        names = _dep_names(route)
        for method in route.methods - {"HEAD", "OPTIONS"}:
            (writes if method in WRITE_METHODS else reads).append((method, route.path, names))
    assert {(m, p) for m, p, _ in writes} >= {
        ("POST", "/api/employees"),
        ("PATCH", "/api/employees/{employee_id}"),
        ("POST", "/api/employees/{employee_id}/image"),
        ("DELETE", "/api/employees/{employee_id}"),
    }, writes
    for method, path, names in writes:
        assert names & ROLE_DEPS, f"{method} {path} cere doar autentificare"
    # Lista si fisa simpla raman deschise tuturor rolurilor: POS, Programari,
    # Hotel si Concedii incarca angajatii si pentru un `worker`.
    open_reads = {p for m, p, names in reads if not (names & ROLE_DEPS)}
    assert {"/api/employees", "/api/employees/{employee_id}"} <= open_reads, open_reads


# ─── Concedii: dupa decizie, doar rolurile care aproba ────────────────────────

async def test_worker_can_edit_consent_and_delete_a_pending_leave():
    db, acc, emp, worker, *_ = await _fixture()
    leave_id = await _new_leave(db, acc, emp)
    res = await _patch(db, acc, worker, leave_id, notes="corectat", end_time=time(12, 0))
    assert (res.notes, float(res.hours), res.status) == ("corectat", 3.0, LeaveStatus.PENDING)
    assert (await _consent(db, acc, worker, leave_id)).employee_consent is True
    await _delete(db, acc, worker, leave_id)
    await raises_http(404, _get(db, acc, leave_id))


async def test_worker_cannot_touch_an_approved_leave():
    db, acc, emp, worker, manager, _ = await _fixture()
    leave_id = await _new_leave(db, acc, emp)
    await _approve(db, acc, manager, leave_id)

    detail = await raises_http(403, _patch(db, acc, worker, leave_id, end_time=time(17, 0), notes="x"))
    assert "procesata" in detail
    await raises_http(403, _delete(db, acc, worker, leave_id))
    await raises_http(403, _consent(db, acc, worker, leave_id))

    got = await _get(db, acc, leave_id)
    assert (got.status, got.notes, float(got.hours)) == (LeaveStatus.APPROVED, None, 2.0)
    assert (got.employee_consent, got.is_deleted) == (False, False)


async def test_worker_cannot_touch_a_rejected_leave():
    db, acc, emp, worker, manager, _ = await _fixture()
    leave_id = await _new_leave(db, acc, emp)
    await _reject(db, acc, manager, leave_id)
    await raises_http(403, _patch(db, acc, worker, leave_id, notes="x"))
    await raises_http(403, _delete(db, acc, worker, leave_id))
    assert (await _get(db, acc, leave_id)).status == LeaveStatus.REJECTED


async def test_manager_and_admin_can_still_change_a_decided_leave():
    db, acc, emp, _, manager, admin = await _fixture()
    leave_id = await _new_leave(db, acc, emp)
    await _approve(db, acc, manager, leave_id)
    res = await _patch(db, acc, manager, leave_id, notes="mutat")
    assert (res.notes, res.status) == ("mutat", LeaveStatus.APPROVED)
    assert (await _consent(db, acc, admin, leave_id)).employee_consent is True
    await _delete(db, acc, admin, leave_id)
    await raises_http(404, _get(db, acc, leave_id))


async def test_worker_cannot_approve_or_reject():
    db, acc, emp, worker, *_ = await _fixture()
    leave_id = await _new_leave(db, acc, emp)
    await raises_http(403, _approve(db, acc, worker, leave_id))
    await raises_http(403, _reject(db, acc, worker, leave_id))
    assert (await _get(db, acc, leave_id)).status == LeaveStatus.PENDING


async def test_approval_records_the_acting_user_not_the_firm():
    db, acc, emp, _, manager, admin = await _fixture()
    leave_id = await _new_leave(db, acc, emp)

    res = await _approve(db, acc, manager, leave_id)
    assert res.approver_name_snapshot == "Maria Manager" != acc.name
    # `approved_by` ramane contul: coloana e FK catre accounts.
    assert (res.approved_by, res.approver_consent) == (acc.id, True)

    # Respingerea ulterioara de catre altcineva nu lasa acordul primului.
    res = await _reject(db, acc, admin, leave_id)
    assert (res.status, res.approver_name_snapshot) == (LeaveStatus.REJECTED, "Sef Admin")
    assert res.approver_consent is False


# ─── Parole: limita de 72 de octeti a bcrypt ──────────────────────────────────

def test_password_longer_than_72_bytes_hashes_and_verifies():
    long_pw = "frazaDeAcces-" * 8  # 104 octeti
    assert len(long_pw.encode("utf-8")) > 72
    hashed = hash_password_sync(long_pw)
    assert verify_password_sync(long_pw, hashed) is True
    assert verify_password_sync(long_pw[:60], hashed) is False
    assert verify_password_sync("alta parola, la fel de lunga " * 4, hashed) is False


def test_long_password_with_diacritics_is_cut_on_bytes_without_error():
    pw = "x" + "ăîșț" * 13  # 105 octeti; octetul 72 cade in mijlocul unui caracter
    assert len(pw.encode("utf-8")) == 105
    hashed = hash_password_sync(pw)
    assert verify_password_sync(pw, hashed) is True
    assert verify_password_sync("ăîșț" * 5, hashed) is False


def test_hash_made_by_old_bcrypt_from_a_long_password_still_logs_in():
    # bcrypt < 5 taia in tacere la 72 de octeti: asa arata hash-urile existente.
    long_pw = "p" * 100
    legacy = bcrypt.hashpw(long_pw.encode("utf-8")[:72], bcrypt.gensalt(rounds=4)).decode("utf-8")
    assert verify_password_sync(long_pw, legacy) is True
    assert verify_password_sync("q" * 100, legacy) is False


def test_short_passwords_and_base64_legacy_behave_as_before():
    hashed = hash_password_sync("parola-scurta-1")
    assert verify_password_sync("parola-scurta-1", hashed) is True
    assert verify_password_sync("parola-scurta-2", hashed) is False
    old = base64.b64encode("veche".encode("utf-8")).decode("utf-8")
    assert verify_password_sync("veche", old) is True
    assert verify_password_sync("x", "") is False


# ─── Limita de rata: cheia e clientul, nu proxy-ul ────────────────────────────

NGINX, CADDY = "172.20.0.3", "172.20.0.2"


def test_production_chain_resolves_to_the_client_caddy_saw():
    # client -> Caddy (scrie adresa clientului) -> nginx (adauga adresa lui Caddy)
    assert client_ip_from_chain(NGINX, f"203.0.113.7, {CADDY}") == "203.0.113.7"
    # Doi clienti diferiti nu mai impart galeata.
    assert client_ip_from_chain(NGINX, f"198.51.100.9, {CADDY}") == "198.51.100.9"


def test_spoofed_leftmost_value_is_ignored_when_nginx_is_the_edge():
    # Fara Caddy: nginx adauga adresa reala la coada a ce a trimis clientul.
    assert client_ip_from_chain(NGINX, "1.2.3.4, 203.0.113.7") == "203.0.113.7"
    assert client_ip_from_chain(NGINX, "10.0.0.1, 1.2.3.4, 203.0.113.7") == "203.0.113.7"


def test_header_is_ignored_when_the_peer_is_not_one_of_our_proxies():
    assert client_ip_from_chain("203.0.113.7", "1.2.3.4") == "203.0.113.7"


def test_missing_or_unreadable_header_falls_back_safely():
    assert client_ip_from_chain(NGINX, None) == NGINX
    assert client_ip_from_chain(NGINX, "") == NGINX
    assert client_ip_from_chain(None, "1.2.3.4") == "127.0.0.1"
    assert client_ip_from_chain("testclient", "1.2.3.4") == "testclient"
    # O intrare ilizibila opreste mersul: ramane ultimul proxy citit, nu ce e in stanga.
    assert client_ip_from_chain(NGINX, f"nu-e-ip, {CADDY}") == CADDY
    assert client_ip_from_chain(NGINX, "nu-e-ip") == NGINX


def test_private_client_and_ipv6_forms():
    # Client din reteaua locala, prin Caddy: toate adresele sunt private.
    assert client_ip_from_chain(NGINX, f"192.168.1.10, {CADDY}") == "192.168.1.10"
    # IPv4 mapat in IPv6 e tot proxy-ul nostru.
    assert client_ip_from_chain(f"::ffff:{NGINX}", f"203.0.113.7, {CADDY}") == "203.0.113.7"
    # Un client IPv6 e numarat pe /64.
    a = client_ip_from_chain(NGINX, f"2001:db8:1:2:aaaa::1, {CADDY}")
    b = client_ip_from_chain(NGINX, f"2001:db8:1:2:bbbb::2, {CADDY}")
    assert a == b == "2001:db8:1:2::"


def _request(peer: str | None, *forwarded: str) -> Request:
    return Request({
        "type": "http", "method": "POST", "path": "/api/auth/login", "query_string": b"",
        "headers": [(b"x-forwarded-for", v.encode("latin-1")) for v in forwarded],
        "client": (peer, 40000) if peer else None,
    })


def test_limiter_uses_the_client_key_on_real_requests():
    assert limiter._key_func is client_key
    assert client_key(_request(NGINX, f"203.0.113.7, {CADDY}")) == "203.0.113.7"
    # Doua antete separate se citesc ca unul singur, in ordine.
    assert client_key(_request(NGINX, "203.0.113.7", CADDY)) == "203.0.113.7"
    assert client_key(_request(NGINX)) == NGINX
    assert client_key(_request(None)) == "127.0.0.1"


# ─── Inregistrare: username ───────────────────────────────────────────────────

def _register_body(username: str) -> RegisterRequest:
    return RegisterRequest(
        name="Firma Noua", username=username, password="parola-lunga-1",
        email=None, cui_firma=123, phone="0700000000",
    )


def test_register_rejects_empty_spaced_and_reserved_usernames():
    for bad in ("", "   ", "ion popescu", "Admin", " ADMIN "):
        try:
            _register_body(bad)
        except ValidationError:
            continue
        raise AssertionError(f"username {bad!r} a fost acceptat")
    assert _register_body("  firma.noua ").username == "firma.noua"


async def test_register_answers_generically_for_a_soft_deleted_username():
    db = await make_session()
    old = await make_account(db, username="vechi", code="vechi")
    old.is_deleted = True
    await db.commit()

    res = await _register(
        request=None, body=_register_body("vechi"), background_tasks=BackgroundTasks(), db=db,
    )
    assert res.code is None and "Daca informatiile sunt corecte" in res.message
    count = (await db.execute(select(func.count()).select_from(Account))).scalar_one()
    assert count == 1


TESTS = [v for k, v in sorted(globals().items()) if k.startswith("test_")]

if __name__ == "__main__":
    for t in TESTS:
        result = t()
        if hasattr(result, "__await__"):
            run(result)
    print(f"OK — {len(TESTS)} scenarii de autorizare trecute.")
