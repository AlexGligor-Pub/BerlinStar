"""Stergerea unei anvelope a clientului (DELETE /api/anvelope/{id}).

Anvelopa se poate sterge cand nu e in depozit; una aflata intr-o cazare activa
(fara checkout) e refuzata cu 409, ca sa nu dispara din cazare. Cazarile inchise
si cele sterse nu o blocheaza, iar in istoricul lor ramane (stergere logica).

Rulabil cu pytest sau direct:  python -m tests.test_anvelope_stergere  (din backend/)
"""
from __future__ import annotations

from datetime import date

from app.models.anvelopa import Anvelopa
from app.models.cazare_anvelope import CazareAnvelopaItem, CazareAnvelope
from app.routers.anvelope import delete_anvelopa, list_anvelope
from tests._harness import make_account, make_client, make_session, raises_http, run


async def _fixture():
    db = await make_session()
    acc = await make_account(db)
    other = await make_account(db, username="alta", code="alta")
    client = await make_client(db, acc)
    anv = Anvelopa(account_id=acc.id, client_id=client.id)
    db.add(anv)
    await db.commit()
    return db, acc, other, client, anv


async def _cazare(db, acc, client, anv, *, checkout=None, deleted=False):
    c = CazareAnvelope(
        account_id=acc.id, client_id=client.id, data_checkin=date(2026, 10, 1),
        data_checkout=checkout, is_deleted=deleted,
    )
    db.add(c)
    await db.flush()
    db.add(CazareAnvelopaItem(account_id=acc.id, cazare_id=c.id, anvelopa_id=anv.id))
    await db.commit()
    return c


async def _ids(db, acc) -> list[int]:
    page = await list_anvelope(client_id=None, last_id=None, limit=200, db=db, account_id=acc.id)
    return [a["id"] for a in page.items]


async def test_free_tyre_is_deleted_and_leaves_the_list():
    db, acc, _, _, anv = await _fixture()
    await delete_anvelopa(anv.id, db=db, account_id=acc.id)
    assert anv.id not in await _ids(db, acc)
    row = await db.get(Anvelopa, anv.id)
    assert row.is_deleted and row.deleted_at is not None


async def test_tyre_in_active_storage_is_refused_with_409():
    db, acc, _, client, anv = await _fixture()
    c = await _cazare(db, acc, client, anv)
    detail = await raises_http(409, delete_anvelopa(anv.id, db=db, account_id=acc.id))
    assert f"#{c.id}" in str(detail)
    assert anv.id in await _ids(db, acc)


async def test_checked_out_or_deleted_storage_does_not_block():
    db, acc, _, client, anv = await _fixture()
    await _cazare(db, acc, client, anv, checkout=date(2026, 10, 5))
    await _cazare(db, acc, client, anv, deleted=True)
    await delete_anvelopa(anv.id, db=db, account_id=acc.id)
    assert anv.id not in await _ids(db, acc)


async def test_foreign_or_already_deleted_tyre_is_404():
    db, acc, other, _, anv = await _fixture()
    await raises_http(404, delete_anvelopa(anv.id, db=db, account_id=other.id))
    await delete_anvelopa(anv.id, db=db, account_id=acc.id)
    await raises_http(404, delete_anvelopa(anv.id, db=db, account_id=acc.id))


TESTS = [v for k, v in sorted(globals().items()) if k.startswith("test_")]

if __name__ == "__main__":
    for t in TESTS:
        run(t())
    print(f"OK — {len(TESTS)} scenarii de stergere a anvelopelor trecute.")
