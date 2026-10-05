"""Nomenclatoare anvelope (dimensiuni, profiluri, coduri DOT, locuri cazare): paginarea
pe `last_id` trebuie sa urmeze ORDER BY-ul listei (valoare/nume, id), nu id-ul.

Rulabil cu pytest sau direct:  python -m tests.test_nomenclatoare_cursor  (din backend/)
"""
from __future__ import annotations

from app.models.cod_dot_anvelopa import CodDotAnvelopa
from app.models.dimensiune_anvelopa import DimensiuneAnvelopa
from app.models.loc_cazare import LocCazare
from app.models.profil_anvelopa import ProfilAnvelopa
from app.routers.coduri_dot_anvelope import list_coduri_dot
from app.routers.dimensiuni_anvelope import list_dimensiuni
from app.routers.loc_cazare import list_locuri
from app.routers.profiluri_anvelope import list_profiluri
from tests._harness import make_account, make_session, run

# Ordinea alfabetica difera de ordinea id-urilor, iar "K" apare de doua ori
# (departajarea pe id trebuie sa tina si la granita dintre pagini).
VALORI = ["M", "C", "X", "A", "K", "B", "Z", "K", "D"]

# (model, coloana de sortare, handler)
LISTE = [
    (CodDotAnvelopa, "valoare", list_coduri_dot),
    (DimensiuneAnvelopa, "valoare", list_dimensiuni),
    (ProfilAnvelopa, "valoare", list_profiluri),
    (LocCazare, "nume", list_locuri),
]


async def _fixture(model, col: str):
    db = await make_session()
    acc = await make_account(db)
    other = await make_account(db, username="alta", code="alta")
    rows = [model(account_id=acc.id, **{col: v}) for v in VALORI]
    sters = model(account_id=acc.id, is_deleted=True, **{col: "E"})
    strain = model(account_id=other.id, **{col: "F"})
    db.add_all([*rows, sters, strain])
    await db.commit()
    for r in rows:
        await db.refresh(r)
    asteptat = [r.id for r in sorted(rows, key=lambda r: (getattr(r, col), r.id))]
    return db, acc, other, asteptat


async def _walk(handler, db, account_id: int, limit: int) -> list[int]:
    ids: list[int] = []
    cursor = None
    for _ in range(50):
        page = await handler(last_id=cursor, limit=limit, db=db, account_id=account_id)
        assert len(page.items) <= limit
        ids += [r.id for r in page.items]
        cursor = page.next_cursor
        if cursor is None:
            return ids
    raise AssertionError("paginarea nu se termina")


async def _check_walk(model, col: str, handler):
    db, acc, _, asteptat = await _fixture(model, col)
    # Premisa testului: ordinea afisata nu coincide cu ordinea id-urilor.
    assert asteptat != sorted(asteptat)
    for limit in (1, 2, 3, 4, len(VALORI), 200):
        ids = await _walk(handler, db, acc.id, limit)
        assert len(ids) == len(set(ids)), f"{model.__name__} limit={limit}: randuri dublate {ids}"
        assert ids == asteptat, f"{model.__name__} limit={limit}: {ids} != {asteptat}"


async def test_coduri_dot_walk_every_row_once_in_visible_order():
    await _check_walk(*LISTE[0])


async def test_dimensiuni_walk_every_row_once_in_visible_order():
    await _check_walk(*LISTE[1])


async def test_profiluri_walk_every_row_once_in_visible_order():
    await _check_walk(*LISTE[2])


async def test_locuri_cazare_walk_every_row_once_in_visible_order():
    await _check_walk(*LISTE[3])


async def test_first_page_without_cursor_keeps_order_and_reports_more():
    db, acc, _, asteptat = await _fixture(CodDotAnvelopa, "valoare")
    page = await list_coduri_dot(last_id=None, limit=4, db=db, account_id=acc.id)
    assert [r.id for r in page.items] == asteptat[:4]
    assert page.next_cursor == asteptat[3]
    full = await list_coduri_dot(last_id=None, limit=200, db=db, account_id=acc.id)
    assert [r.valoare for r in full.items] == sorted(VALORI)
    assert full.next_cursor is None


async def test_cursor_on_last_row_returns_empty_page():
    db, acc, _, asteptat = await _fixture(CodDotAnvelopa, "valoare")
    page = await list_coduri_dot(last_id=asteptat[-1], limit=4, db=db, account_id=acc.id)
    assert page.items == [] and page.next_cursor is None


async def test_walk_isolates_accounts_and_skips_deleted():
    for model, col, handler in LISTE:
        db, acc, other, asteptat = await _fixture(model, col)
        ale_mele = await _walk(handler, db, acc.id, 2)
        ale_lui = await _walk(handler, db, other.id, 2)
        assert len(ale_mele) == len(VALORI) and len(ale_lui) == 1
        assert not set(ale_mele) & set(ale_lui)
        # Cursorul unui alt cont nu se rezolva: pagina goala, nu randurile proprii filtrate
        # dupa valoarea straina ("F" al lui `other` vine dupa "A", deci ar fi aparut).
        for strain_id in (asteptat[0], asteptat[-1]):
            page = await handler(last_id=strain_id, limit=200, db=db, account_id=other.id)
            assert page.items == [] and page.next_cursor is None, f"{model.__name__}: cursor strain {strain_id}"
        # La fel si in sens invers, si pentru un id inexistent.
        page = await handler(last_id=ale_lui[0], limit=200, db=db, account_id=acc.id)
        assert page.items == [] and page.next_cursor is None
        page = await handler(last_id=10**9, limit=200, db=db, account_id=acc.id)
        assert page.items == [] and page.next_cursor is None


async def test_cursor_row_soft_deleted_between_pages_still_resolves():
    for model, col, handler in LISTE:
        db, acc, _, asteptat = await _fixture(model, col)
        first = await handler(last_id=None, limit=4, db=db, account_id=acc.id)
        assert first.next_cursor == asteptat[3]
        row = await db.get(model, first.next_cursor)
        row.is_deleted = True
        await db.commit()
        rest = await _walk_from(handler, db, acc.id, first.next_cursor)
        assert rest == asteptat[4:], f"{model.__name__}: {rest} != {asteptat[4:]}"


async def _walk_from(handler, db, account_id: int, cursor: int) -> list[int]:
    ids: list[int] = []
    for _ in range(50):
        page = await handler(last_id=cursor, limit=4, db=db, account_id=account_id)
        ids += [r.id for r in page.items]
        if page.next_cursor is None:
            return ids
        cursor = page.next_cursor
    raise AssertionError("paginarea nu se termina")


TESTS = [v for k, v in sorted(globals().items()) if k.startswith("test_")]

if __name__ == "__main__":
    for t in TESTS:
        run(t())
    print(f"OK — {len(TESTS)} scenarii paginare nomenclatoare trecute.")
