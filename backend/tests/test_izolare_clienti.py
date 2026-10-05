"""Izolare intre conturi la lista de clienti: cursorul `last_id`.

Regresia pe care o prinde: GET /api/clienti?last_id=N lua numele randului N fara
filtru pe cont si il folosea ca reper de sortare. Cu id-ul unui client strain,
pagina intoarsa arata care dintre clientii proprii se sorteaza dupa numele lui —
destul ca numele sa fie ghicit litera cu litera, cu clienti-sonda.

Rulabil cu pytest sau direct:  python -m tests.test_izolare_clienti  (din backend/)
"""
from __future__ import annotations

from app.routers.clienti import list_clienti
from tests._harness import make_account, make_client, make_session, run


async def _fixture():
    db = await make_session()
    acc = await make_account(db)
    other = await make_account(db, username="alta", code="alta")
    ana = await make_client(db, acc, "Ana")
    dan = await make_client(db, acc, "Dan")
    zoe = await make_client(db, acc, "Zoe")
    # „Mihai" se sorteaza intre „Dan" si „Zoe": inainte de fix, cursorul strain
    # intorcea doar „Zoe".
    foreign = await make_client(db, other, "Mihai")
    await db.commit()
    return db, acc, other, (ana, dan, zoe), foreign


async def _names(db, account, **kw) -> list[str]:
    page = await list_clienti(**{"limit": 100, **kw}, db=db, account_id=account.id)
    return [c.nume for c in page.items]


async def test_foreign_cursor_returns_empty_page():
    db, acc, _, _, foreign = await _fixture()
    assert await _names(db, acc, last_id=foreign.id) == []


async def test_foreign_cursor_answers_like_missing_cursor():
    db, acc, other, _, foreign = await _fixture()
    # Doi clienti straini cu nume la capetele alfabetului: raspunsul nu are voie
    # sa depinda de unde se sorteaza numele lor.
    first = await make_client(db, other, "Aaa")
    last = await make_client(db, other, "Zzz")
    await db.commit()
    missing = await _names(db, acc, last_id=99999)
    assert missing == []
    for c in (foreign, first, last):
        assert await _names(db, acc, last_id=c.id) == missing


async def test_own_cursor_still_paginates():
    db, acc, _, (ana, dan, zoe), _ = await _fixture()
    page = await list_clienti(limit=2, db=db, account_id=acc.id)
    assert [c.nume for c in page.items] == ["Ana", "Dan"]
    assert page.next_cursor == dan.id
    page = await list_clienti(last_id=page.next_cursor, limit=2, db=db, account_id=acc.id)
    assert [c.id for c in page.items] == [zoe.id]
    assert page.next_cursor is None
    assert await _names(db, acc, last_id=ana.id) == ["Dan", "Zoe"]


async def test_own_cursor_deleted_meanwhile_still_works():
    # Randul-cursor sters intre doua pagini: lista continua de dupa el, ca pana acum.
    db, acc, _, (_, dan, _), _ = await _fixture()
    dan.is_deleted = True
    await db.commit()
    assert await _names(db, acc, last_id=dan.id) == ["Zoe"]


async def test_list_never_contains_other_account():
    db, acc, other, _, foreign = await _fixture()
    assert await _names(db, acc) == ["Ana", "Dan", "Zoe"]
    assert await _names(db, other) == ["Mihai"]
    # Cursorul propriu al celuilalt cont nu e afectat.
    assert await _names(db, other, last_id=foreign.id) == []


TESTS = [v for k, v in sorted(globals().items()) if k.startswith("test_")]

if __name__ == "__main__":
    for t in TESTS:
        run(t())
    print(f"OK — {len(TESTS)} scenarii izolare clienti trecute.")
