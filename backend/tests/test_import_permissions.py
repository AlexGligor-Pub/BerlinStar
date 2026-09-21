"""Cine are voie la fiecare tip de import (Configurări › Import).

Regula nu e vizibila in `test_route_authorization.py`: acolo se verifica doar ca
ruta cere *un* rol, iar toate rutele de import cer `SETTINGS` (admin + manager).
Diferenta reala — „clientii doar adminul contului, hotelul si managerul" — o face
`_service()` in corpul handler-ului, pe `KINDS`, inclusiv pentru rutele unde tipul
vine din baza de date (`/sessions/{id}`, export, revert). Testul de fata trece prin
HTTP, ca sa prinda si un refactor care ar scoate acea verificare.

Rulabil cu pytest sau direct:  python -m tests.test_import_permissions
"""
from __future__ import annotations

import httpx
from sqlalchemy.ext.asyncio import async_sessionmaker

import app.database as database
from app.auth_context import AuthContext
from app.database import get_db
from app.dependencies import get_auth_context
from app.main import app
from app.models.import_session import ImportSession
from app.models.user import UserRole
from tests._harness import make_account, make_session, make_user, run


async def _fixture():
    db = await make_session()
    # Raportul CSV se trimite in flux, dintr-o sesiune proprie de baza de date (ca
    # in productie): o legam de baza testului.
    database.AsyncSessionLocal = async_sessionmaker(db.bind, expire_on_commit=False)
    acc = await make_account(db)
    other = await make_account(db, "alta", "alta")
    users = {
        role: await make_user(db, acc, f"u_{role.value}", role)
        for role in (UserRole.ADMIN, UserRole.MANAGER, UserRole.WORKER)
    }
    sessions = {}
    for kind in ("clienti", "hotel"):
        s = ImportSession(account_id=acc.id, kind=kind, total_rows=0, state="done", created_by="admin")
        db.add(s)
        sessions[kind] = s
    strain = ImportSession(account_id=other.id, kind="hotel", total_rows=0, state="done", created_by="admin")
    db.add(strain)
    await db.commit()
    return db, acc, users, {k: v.id for k, v in sessions.items()}, strain.id


def _client(db, acc, users, role_holder):
    async def _db():
        yield db

    app.dependency_overrides[get_db] = _db
    # Inlocuim doar identitatea: `require_resource(SETTINGS)` si `_service()` ruleaza
    # pe bune, deci exact regulile de rol sunt cele verificate.
    app.dependency_overrides[get_auth_context] = lambda: AuthContext(
        user=users[role_holder["role"]], session=None, account=acc,
    )
    return httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test")


async def test_each_role_reaches_only_its_imports():
    db, acc, users, ids, strain_id = await _fixture()
    role_holder = {"role": UserRole.ADMIN}
    try:
        async with _client(db, acc, users, role_holder) as c:
            # Adminul contului: ambele tipuri.
            for kind in ("clienti", "hotel"):
                assert (await c.get(f"/api/import/{kind}/format")).status_code == 200, kind
                assert (await c.get("/api/import/sessions", params={"kind": kind})).status_code == 200, kind
                assert (await c.get(f"/api/import/sessions/{ids[kind]}")).status_code == 200, kind
                assert (await c.get(f"/api/import/sessions/{ids[kind]}/export")).status_code == 200, kind
            assert set((await c.get("/api/import/pending")).json()) == {"clienti", "hotel"}

            # Managerul: hotelul da, clientii nu — nici pe rutele unde tipul vine
            # din baza de date, nu din URL.
            role_holder["role"] = UserRole.MANAGER
            assert (await c.get("/api/import/hotel/format")).status_code == 200
            assert (await c.get(f"/api/import/sessions/{ids['hotel']}")).status_code == 200
            assert set((await c.get("/api/import/pending")).json()) == {"hotel"}
            for url in (
                "/api/import/clienti/format",
                f"/api/import/sessions/{ids['clienti']}",
                f"/api/import/sessions/{ids['clienti']}/rows",
                f"/api/import/sessions/{ids['clienti']}/export",
            ):
                assert (await c.get(url)).status_code == 403, url
            assert (await c.get("/api/import/sessions", params={"kind": "clienti"})).status_code == 403
            assert (await c.post(f"/api/import/sessions/{ids['clienti']}/revert", json={"dry_run": True})).status_code == 403
            assert (await c.post(f"/api/import/sessions/{ids['clienti']}/rows/reject",
                                 json={"all_pending": True})).status_code == 403

            # Sesiunea altui cont nu exista pentru nimeni (404, nu 403: fara oracol).
            role_holder["role"] = UserRole.ADMIN
            assert (await c.get(f"/api/import/sessions/{strain_id}")).status_code == 404
            assert (await c.post(f"/api/import/sessions/{strain_id}/revert", json={"dry_run": True})).status_code == 404
    finally:
        app.dependency_overrides.clear()


async def test_worker_has_no_imports_at_all():
    db, acc, users, ids, _strain = await _fixture()
    role_holder = {"role": UserRole.WORKER}
    try:
        async with _client(db, acc, users, role_holder) as c:
            for url in ("/api/import/pending", "/api/import/hotel/format", "/api/import/clienti/format",
                        f"/api/import/sessions/{ids['hotel']}"):
                assert (await c.get(url)).status_code == 403, url
    finally:
        app.dependency_overrides.clear()


TESTS = [v for k, v in sorted(globals().items()) if k.startswith("test_")]

if __name__ == "__main__":
    for t in TESTS:
        run(t())
    print(f"OK — {len(TESTS)} scenarii de permisiuni la import trecute.")
