"""Căutarea din Hotel anvelope.

1. Lista de cazări și sumarul (`/summary`) trebuie să dea aceleași numere pe
   aceleași filtre — sumarul e afișat sub caseta de căutare, peste o listă care
   se încarcă pe pagini, deci nu poate fi verificat din ce se vede.
2. Caracterele speciale din căutare sunt text, nu jokeri (`%`, `_`), iar o
   căutare care nu lasă nimic din numărul de mașină („-") nu potrivește tot.

Rulabil cu pytest sau direct:  python -m tests.test_cazari_search
"""
from __future__ import annotations

from datetime import date

import httpx

from app.auth_context import AuthContext
from app.database import get_db
from app.dependencies import get_auth_context
from app.main import app
from app.models.anvelopa import Anvelopa, TipAnvelopa
from app.models.cazare_anvelope import CazareAnvelopaItem, CazareAnvelope
from app.models.loc_cazare import LocCazare
from app.models.user import UserRole
from tests._harness import make_account, make_client, make_session, make_user, run


async def _stay(db, acc, client, plate, loc=None, n=4, out=False):
    c = CazareAnvelope(
        account_id=acc.id, client_id=client.id, numar_masina=plate, data_checkin=date(2026, 3, 1),
        data_checkout=date(2026, 4, 1) if out else None, loc_cazare_id=loc.id if loc else None,
    )
    for _ in range(n):
        a = Anvelopa(account_id=acc.id, client_id=client.id, tip=TipAnvelopa.IARNA)
        db.add(a)
        c.items.append(CazareAnvelopaItem(account_id=acc.id, anvelopa=a))
    db.add(c)
    await db.flush()
    return c


def _http(db, acc, user):
    async def _db():
        yield db

    app.dependency_overrides[get_db] = _db
    if user is not None:
        app.dependency_overrides[get_auth_context] = lambda: AuthContext(user=user, session=None, account=acc)
    return httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test")


# ─── Căutare și sumar ────────────────────────────────────────────────────────

async def test_list_and_summary_agree_and_special_characters_are_text():
    db = await make_session()
    acc = await make_account(db)
    user = await make_user(db, acc, "u", UserRole.WORKER)
    rafturi = LocCazare(account_id=acc.id, nume="C1 DR")
    db.add(rafturi)
    await db.flush()
    popescu = await make_client(db, acc, "Popescu Ion")
    ionescu = await make_client(db, acc, "Ionescu_Maria")
    procent = await make_client(db, acc, "Auto 100% SRL")
    await _stay(db, acc, popescu, "B 12 ABC", loc=rafturi)
    await _stay(db, acc, popescu, "B-99-XYZ", n=2)
    await _stay(db, acc, ionescu, "DJ-33-JUS", loc=rafturi)
    await _stay(db, acc, procent, "CJ01AAA")
    await _stay(db, acc, procent, "CJ02BBB", out=True)          # istoric, nu intră la „active"
    # Alt cont, cu nume care s-ar potrivi: nu trebuie să apară niciodată.
    alt = await make_account(db, "alta", "alta")
    strain = await make_client(db, alt, "Popescu Străin")
    await _stay(db, alt, strain, "B12ABC")
    await db.commit()

    cazuri = {
        # q / filtru              -> (cazări, anvelope, clienți)
        (("q", "ion"),):              (3, 10, 2),   # Popescu Ion (2) + Ionescu_Maria (1)
        (("q", "b 12 abc"),):         (1, 4, 1),    # număr scris cu spații
        (("q", "dj-33"),):            (1, 4, 1),    # număr scris cu liniuță
        (("q", "%"),):                (1, 4, 1),    # doar „Auto 100% SRL", nu tot
        (("q", "_"),):                (1, 4, 1),    # doar „Ionescu_Maria", nu tot
        (("q", "-"),):                (0, 0, 0),    # nu rămâne nimic din număr
        (("loc_cazare_id", rafturi.id),): (2, 8, 2),
        (("q", "popescu"), ("loc_cazare_id", rafturi.id)): (1, 4, 1),
        ():                           (4, 14, 3),   # fără filtru: toate active ale contului
    }
    try:
        async with _http(db, acc, user) as c:
            for filtre, (n_caz, n_anv, n_cli) in cazuri.items():
                params = {"activa": "true", "limit": 200, **dict(filtre)}
                lista = (await c.get("/api/cazare-anvelope", params=params)).json()["items"]
                sumar = (await c.get("/api/cazare-anvelope/summary", params=params)).json()
                assert len(lista) == n_caz, (filtre, len(lista))
                assert sumar == {"cazari": n_caz, "anvelope": n_anv, "clienti": n_cli}, (filtre, sumar)
            # O dată greșită e 422, nu 500.
            r = await c.get("/api/cazare-anvelope/summary", params={"date_from": "nu-e-data"})
            assert r.status_code == 422, r.status_code
            r = await c.get("/api/cazare-anvelope/summary", params={"date_from": "2026-01-01"})
            assert r.status_code == 200 and r.json()["cazari"] == 5, r.text
    finally:
        app.dependency_overrides.clear()


TESTS = [v for k, v in sorted(globals().items()) if k.startswith("test_")]

if __name__ == "__main__":
    for t in TESTS:
        run(t())
    print(f"OK — {len(TESTS)} scenarii de căutare în hotel trecute.")
