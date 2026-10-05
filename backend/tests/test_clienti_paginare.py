"""Paginarea listei de clienti: pagini numerotate (offset + total) si keyset (last_id).

Pagina Clienti trimite `limit` + `offset` si asteapta `total` in raspuns, ca sa
poata desena numerele de pagina si sa dezactiveze „inainte" pe ultima. Endpointul
stia doar de `last_id`: ignora `offset`, deci orice pagina arata primii clienti,
iar `total` lipsea.

Restul apelantilor (cautarile din POS/Receptie/Programari, `listAll`) raman pe
keyset si nu trebuie sa simta nimic: fara `offset` nu se numara nimic.

Vezi app/routers/clienti.py :: list_clienti.

Rulabil cu pytest sau direct:  python -m tests.test_clienti_paginare  (din backend/)
"""
from __future__ import annotations

from typing import get_args, get_type_hints

from app.routers.clienti import list_clienti
from app.schemas.common import Page
from tests._harness import make_account, make_client, make_session, run

# Nume cu ordine alfabetica evidenta; „Client 03" apare de doua ori ca sa verificam
# departajarea pe id din ORDER BY (nume, id).
NUME = [f"Client {i:02d}" for i in range(1, 8)] + ["Client 03"]


async def _fixture():
    db = await make_session()
    acc = await make_account(db)
    other = await make_account(db, username="alta", code="alta")
    # Inserati in ordine inversa: ordinea din lista nu are voie sa fie cea a id-urilor.
    for nume in reversed(NUME):
        await make_client(db, acc, nume)
    for nume in ("Client 02", "Strain 1", "Strain 2"):
        await make_client(db, other, nume)
    await db.commit()
    return db, acc, other


async def _all_ids(db, acc) -> list[int]:
    page = await list_clienti(limit=200, db=db, account_id=acc.id)
    return [c.id for c in page.items]


async def test_offset_pages_are_different_and_contiguous():
    db, acc, _ = await _fixture()
    full = await _all_ids(db, acc)
    assert len(full) == len(NUME)

    seen: list[int] = []
    for offset in (0, 3, 6):
        page = await list_clienti(limit=3, offset=offset, db=db, account_id=acc.id)
        ids = [c.id for c in page.items]
        assert ids == full[offset:offset + 3], f"offset {offset}: {ids}"
        assert page.total == len(NUME)
        seen += ids
    # Paginile puse cap la cap dau lista intreaga, fara dubluri si fara goluri.
    assert seen == full
    assert len(set(seen)) == len(seen)


async def test_offset_order_is_nume_then_id():
    db, acc, _ = await _fixture()
    page = await list_clienti(limit=200, offset=0, db=db, account_id=acc.id)
    assert [c.id for c in page.items] == [c.id for c in sorted(page.items, key=lambda c: (c.nume, c.id))]
    assert [c.nume for c in page.items][:4] == ["Client 01", "Client 02", "Client 03", "Client 03"]


async def test_offset_past_the_end_is_empty_but_keeps_total():
    db, acc, _ = await _fixture()
    page = await list_clienti(limit=3, offset=30, db=db, account_id=acc.id)
    assert page.items == []
    assert page.next_cursor is None
    assert page.total == len(NUME)


async def test_last_offset_page_has_no_next_cursor():
    db, acc, _ = await _fixture()
    first = await list_clienti(limit=3, offset=0, db=db, account_id=acc.id)
    assert first.next_cursor == first.items[-1].id
    last = await list_clienti(limit=3, offset=6, db=db, account_id=acc.id)
    assert len(last.items) == 2 and last.next_cursor is None


async def test_total_follows_search_filter():
    db, acc, _ = await _fixture()
    page = await list_clienti(limit=1, offset=0, q="client 03", db=db, account_id=acc.id)
    assert page.total == 2 and len(page.items) == 1
    second = await list_clienti(limit=1, offset=1, q="client 03", db=db, account_id=acc.id)
    assert second.total == 2
    assert second.items[0].id != page.items[0].id
    assert {page.items[0].nume, second.items[0].nume} == {"Client 03"}

    none = await list_clienti(limit=10, offset=0, q="inexistent", db=db, account_id=acc.id)
    assert none.total == 0 and none.items == []


async def test_total_follows_tip_and_plate_filters():
    db, acc, _ = await _fixture()
    juridic = await make_client(db, acc, "Firma SRL")
    juridic.tip = "juridic"
    juridic.numar_masina = "TM01ABC"
    await db.commit()

    page = await list_clienti(limit=10, offset=0, tip="juridic", db=db, account_id=acc.id)
    assert page.total == 1 and [c.id for c in page.items] == [juridic.id]
    page = await list_clienti(limit=10, offset=0, q_masina="tm01", db=db, account_id=acc.id)
    assert page.total == 1 and [c.id for c in page.items] == [juridic.id]
    page = await list_clienti(limit=10, offset=0, db=db, account_id=acc.id)
    assert page.total == len(NUME) + 1


async def test_total_ignores_soft_deleted():
    db, acc, _ = await _fixture()
    page = await list_clienti(limit=200, offset=0, db=db, account_id=acc.id)
    page.items[0].is_deleted = True
    await db.commit()
    after = await list_clienti(limit=200, offset=0, db=db, account_id=acc.id)
    assert after.total == len(NUME) - 1 == len(after.items)


async def test_last_id_mode_is_unchanged():
    db, acc, _ = await _fixture()
    full = await _all_ids(db, acc)

    walked: list[int] = []
    last_id = None
    for _ in range(10):
        page = await list_clienti(last_id=last_id, limit=3, db=db, account_id=acc.id)
        # Fara offset nu se numara nimic: apelantii pe cursor nu platesc un COUNT.
        assert page.total is None
        walked += [c.id for c in page.items]
        if page.next_cursor is None:
            break
        assert page.next_cursor == page.items[-1].id
        last_id = page.next_cursor
    assert walked == full
    assert len(set(walked)) == len(NUME)


async def test_last_id_wins_over_offset():
    db, acc, _ = await _fixture()
    full = await _all_ids(db, acc)
    page = await list_clienti(last_id=full[2], limit=3, offset=1, db=db, account_id=acc.id)
    assert [c.id for c in page.items] == full[3:6]
    assert page.total is None


async def test_search_without_offset_has_no_total():
    db, acc, _ = await _fixture()
    page = await list_clienti(limit=20, q="Client 0", db=db, account_id=acc.id)
    assert len(page.items) == len(NUME) and page.total is None


async def test_tenant_isolation():
    db, acc, other = await _fixture()
    mine = await list_clienti(limit=200, offset=0, db=db, account_id=acc.id)
    assert mine.total == len(NUME)
    assert all(c.account_id == acc.id for c in mine.items)

    theirs = await list_clienti(limit=200, offset=0, db=db, account_id=other.id)
    assert theirs.total == 3
    assert [c.nume for c in theirs.items] == ["Client 02", "Strain 1", "Strain 2"]

    # Cu filtru: „Client 02" exista in ambele conturi, se numara doar al meu.
    hit = await list_clienti(limit=200, offset=0, q="Client 02", db=db, account_id=acc.id)
    assert hit.total == 1 and hit.items[0].account_id == acc.id
    assert (await list_clienti(limit=200, offset=0, q="Strain", db=db, account_id=acc.id)).total == 0


def _annotated_extras(hint) -> list:
    # Recursiv: sub Python 3.11, un default None inveleste adnotarea in Optional[...].
    out = list(getattr(hint, "__metadata__", ()))
    for arg in get_args(hint):
        out += _annotated_extras(arg)
    return out


def _query_bounds(param: str) -> tuple[int | None, int | None]:
    """(ge, le) declarate in `Query(...)` pe un parametru al lui list_clienti."""
    ge = le = None
    for query in _annotated_extras(get_type_hints(list_clienti, include_extras=True)[param]):
        for m in getattr(query, "metadata", ()):
            ge = getattr(m, "ge", ge)
            le = getattr(m, "le", le)
    return ge, le


async def test_offset_and_last_id_are_bounded_in_signature():
    # Testele apeleaza functia direct, deci validarea FastAPI nu ruleaza aici: o
    # fixam prin semnatura. Fara `ge`, offset=-1 ajunge OFFSET -1 in Postgres; fara
    # `le`, o valoare peste int4 pica in asyncpg — ambele 500 in loc de 422.
    int4_max = 2**31 - 1
    assert _query_bounds("offset") == (0, int4_max)
    assert _query_bounds("last_id") == (0, int4_max)


async def test_offset_at_upper_bound_is_empty_not_an_error():
    # Cea mai mare valoare admisa trebuie sa treaca prin interogare, nu doar prin validare.
    db, acc, _ = await _fixture()
    page = await list_clienti(limit=3, offset=2**31 - 1, db=db, account_id=acc.id)
    assert page.items == [] and page.total == len(NUME)


async def test_page_total_is_optional_for_other_endpoints():
    # Page e folosit de toate listele: campul nou nu are voie sa devina obligatoriu.
    assert Page[int](items=[1], next_cursor=None).total is None
    assert Page[int].model_fields["total"].is_required() is False


TESTS = [v for k, v in sorted(globals().items()) if k.startswith("test_")]

if __name__ == "__main__":
    for t in TESTS:
        run(t())
    print(f"OK — {len(TESTS)} scenarii paginare clienti trecute.")
