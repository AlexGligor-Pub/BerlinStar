"""Lista de bonuri: cursor aliniat cu sortarea dupa activitate, zile locale, izolare.

Rulabil cu pytest sau direct:  python -m tests.test_receipts_list_cursor  (din backend/)
"""
from __future__ import annotations
from datetime import date, datetime, timedelta, timezone

from app.models.receipt import Receipt
from app.routers.receipts import _activity_cursors, list_receipts
from tests._harness import make_account, make_receipt, make_session, run

T0 = datetime(2026, 9, 7, 9, 0, tzinfo=timezone.utc)


async def _receipt(db, acc, created_at: datetime, updated_at: datetime | None = None, **kw):
    r = await make_receipt(db, acc, **kw)
    r.created_at = created_at
    r.updated_at = updated_at
    await db.flush()
    return r


async def _fixture():
    """Sapte bonuri ale firmei, cu ordinea dupa activitate diferita de ordinea
    dupa id, plus bonuri ale altei firme intercalate in timp.

    Intoarce (db, acc_id, other_id, activity) unde activity = {id: activitate}.
    """
    # Fiecare test porneste cu o baza noua in care id-urile se repeta; pozitiile
    # de cursor tinute minte de testul anterior nu au ce cauta aici.
    _activity_cursors.clear()
    db = await make_session()
    acc = await make_account(db)
    other = await make_account(db, username="alta", code="alta")
    m = lambda n: T0 + timedelta(minutes=n)
    activity: dict[int, datetime] = {}
    # (creat, modificat): bonul cel mai vechi e si cel mai recent atins; doua
    # perechi au exact aceeasi activitate, ca sa conteze departajarea pe id.
    plan = [(1, 100), (2, None), (3, 50), (4, None), (5, 50), (6, None), (7, 2)]
    for created, updated in plan:
        r = await _receipt(db, acc, m(created), m(updated) if updated is not None else None)
        activity[r.id] = m(updated if updated is not None else created)
        # Bon strain cu activitate apropiata: nu are voie sa apara nicaieri.
        await _receipt(db, other, m(created), m(updated + 1) if updated is not None else None)
    await db.commit()
    # Instante proaspete la citire: relatiile se incarca prin selectin, ca in productie.
    db.expunge_all()
    return db, acc.id, other.id, activity


async def _walk(db, account_id: int, limit: int, **kw) -> list[int]:
    """Parcurge toate paginile dupa next_cursor si intoarce id-urile in ordine."""
    ids: list[int] = []
    cursor = None
    for _ in range(50):
        page = await list_receipts(last_id=cursor, limit=limit, db=db, account_id=account_id, **kw)
        got = [it["id"] for it in page["items"]]
        assert len(got) <= limit
        ids.extend(got)
        cursor = page["next_cursor"]
        if cursor is None:
            return ids
        assert cursor == got[-1]
    raise AssertionError("paginarea nu se termina")


async def test_activity_desc_walk_returns_each_receipt_once_in_order():
    db, acc_id, _, activity = await _fixture()
    expected = sorted(activity, key=lambda i: (activity[i], i), reverse=True)
    assert expected != sorted(activity, reverse=True), "fixture: ordinea trebuie sa difere de id"
    for limit in (1, 2, 3, 7, 20):
        assert await _walk(db, acc_id, limit, sort="-activity") == expected


async def test_activity_asc_walk_returns_each_receipt_once_in_order():
    db, acc_id, _, activity = await _fixture()
    # Activitate crescator, la egalitate id descrescator (ca in ORDER BY).
    expected = sorted(activity, key=lambda i: (activity[i], -i))
    for limit in (1, 2, 3):
        assert await _walk(db, acc_id, limit, sort="activity") == expected


async def test_activity_cursor_on_old_recently_touched_receipt_skips_nothing():
    """Cazul din productie: ultimul rand al paginii e un bon vechi (id mic) atins
    recent. Cu `id < last_id` restul bonurilor, toate cu id mai mare, dispareau."""
    db, acc_id, _, activity = await _fixture()
    first = await list_receipts(limit=1, sort="-activity", db=db, account_id=acc_id)
    cursor = first["next_cursor"]
    assert cursor == min(activity), "fixture: primul rand e bonul cu cel mai mic id"
    rest = await list_receipts(last_id=cursor, limit=20, sort="-activity", db=db, account_id=acc_id)
    assert {it["id"] for it in rest["items"]} == set(activity) - {cursor}
    assert rest["next_cursor"] is None


async def _touch(db, receipt_id: int) -> None:
    """Bonul e editat/incasat: activitatea lui devine cea mai recenta din lista."""
    receipt = await db.get(Receipt, receipt_id)
    receipt.updated_at = T0 + timedelta(minutes=1000)
    await db.commit()
    db.expunge_all()


async def test_activity_cursor_touched_between_pages_continues_where_it_was():
    """Ultimul rand al paginii e modificat inainte de „incarca mai mult": pagina
    urmatoare continua de unde a ramas lista, nu o ia de la varf."""
    db, acc_id, _, activity = await _fixture()
    expected = sorted(activity, key=lambda i: (activity[i], i), reverse=True)
    first = await list_receipts(limit=3, sort="-activity", db=db, account_id=acc_id)
    assert [it["id"] for it in first["items"]] == expected[:3]
    cursor = first["next_cursor"]
    await _touch(db, cursor)

    second = await list_receipts(last_id=cursor, limit=3, sort="-activity", db=db, account_id=acc_id)
    assert [it["id"] for it in second["items"]] == expected[3:6]
    # Restul listei: fiecare bon nemodificat o singura data, nimic deja afisat.
    rest = await list_receipts(
        last_id=second["next_cursor"], limit=20, sort="-activity", db=db, account_id=acc_id,
    )
    assert [it["id"] for it in rest["items"]] == expected[6:]
    assert rest["next_cursor"] is None


async def test_activity_asc_cursor_touched_between_pages_skips_nothing():
    """Crescator, activitatea curenta a cursorului ar sari tot restul listei."""
    db, acc_id, _, activity = await _fixture()
    expected = sorted(activity, key=lambda i: (activity[i], -i))
    first = await list_receipts(limit=3, sort="activity", db=db, account_id=acc_id)
    assert [it["id"] for it in first["items"]] == expected[:3]
    cursor = first["next_cursor"]
    await _touch(db, cursor)

    second = await list_receipts(last_id=cursor, limit=3, sort="activity", db=db, account_id=acc_id)
    assert [it["id"] for it in second["items"]] == expected[3:6]


async def test_activity_cursor_without_remembered_position_skips_no_unmodified_receipt():
    """Dupa un restart pozitia nu mai e in memorie: se foloseste activitatea
    curenta a cursorului. Se pot repeta randuri deja afisate, dar nu lipseste
    niciun bon nemodificat."""
    db, acc_id, _, activity = await _fixture()
    expected = sorted(activity, key=lambda i: (activity[i], i), reverse=True)
    first = await list_receipts(limit=3, sort="-activity", db=db, account_id=acc_id)
    cursor = first["next_cursor"]
    _activity_cursors.clear()
    await _touch(db, cursor)

    rest = await list_receipts(last_id=cursor, limit=20, sort="-activity", db=db, account_id=acc_id)
    got = [it["id"] for it in rest["items"]]
    assert set(expected[3:]) <= set(got), got
    assert cursor not in got and len(got) == len(set(got))


async def test_remembered_cursor_position_is_per_account():
    """Pozitia tinuta minte pentru un cont nu deschide cursorul altui cont."""
    db, acc_id, other_id, _ = await _fixture()
    theirs = await list_receipts(limit=2, sort="-activity", db=db, account_id=other_id)
    foreign_cursor = theirs["next_cursor"]
    assert foreign_cursor is not None
    page = await list_receipts(
        last_id=foreign_cursor, limit=20, sort="-activity", db=db, account_id=acc_id,
    )
    assert page["items"] == [] and page["next_cursor"] is None
    # Contul care a primit cursorul continua normal de la el.
    more = await list_receipts(
        last_id=foreign_cursor, limit=20, sort="-activity", db=db, account_id=other_id,
    )
    assert len(more["items"]) == 5 and more["next_cursor"] is None


async def test_id_sorted_paging_is_unchanged():
    db, acc_id, _, activity = await _fixture()
    expected = sorted(activity, reverse=True)
    for limit in (1, 2, 3, 20):
        assert await _walk(db, acc_id, limit, sort="-id") == expected
    page = await list_receipts(last_id=expected[2], limit=2, sort="-id", db=db, account_id=acc_id)
    assert [it["id"] for it in page["items"]] == expected[3:5]
    assert page["next_cursor"] == expected[4]


async def test_accounts_are_isolated():
    db, acc_id, other_id, activity = await _fixture()
    mine = set(activity)
    theirs = set(await _walk(db, other_id, 3, sort="-activity"))
    assert len(theirs) == len(mine) and not (theirs & mine)
    assert set(await _walk(db, acc_id, 3, sort="-activity")) == mine
    assert set(await _walk(db, acc_id, 3, sort="-id")) == mine
    # Un cursor care arata spre bonul altei firme nu dezvaluie nimic despre el
    # (nici macar pozitia lui in timp) si nu aduce randuri straine.
    foreign = max(theirs)
    page = await list_receipts(last_id=foreign, limit=20, sort="-activity", db=db, account_id=acc_id)
    assert page["items"] == [] and page["next_cursor"] is None
    page = await list_receipts(last_id=foreign, limit=20, sort="-id", db=db, account_id=acc_id)
    assert {it["id"] for it in page["items"]} <= mine


async def test_date_filter_uses_local_days_not_utc():
    db = await make_session()
    acc = await make_account(db)
    utc = lambda *a: datetime(*a, tzinfo=timezone.utc)
    # Vara (UTC+3): 5 oct. local = [4 oct. 21:00Z, 5 oct. 21:00Z).
    before = await _receipt(db, acc, utc(2026, 10, 4, 20, 59))   # 4 oct. 23:59 local
    night = await _receipt(db, acc, utc(2026, 10, 4, 22, 30))    # 5 oct. 01:30 local
    evening = await _receipt(db, acc, utc(2026, 10, 5, 20, 59))  # 5 oct. 23:59 local
    after = await _receipt(db, acc, utc(2026, 10, 5, 21, 30))    # 6 oct. 00:30 local
    # 25 oct. 2026: trecerea la ora de iarna, ziua locala are 25 de ore
    # = [24 oct. 21:00Z, 25 oct. 22:00Z).
    dst_late = await _receipt(db, acc, utc(2026, 10, 25, 21, 30))  # 25 oct. 23:30 local
    dst_next = await _receipt(db, acc, utc(2026, 10, 25, 22, 30))  # 26 oct. 00:30 local
    await db.commit()
    db.expunge_all()

    async def day(d_from: date, d_to: date) -> set[int]:
        page = await list_receipts(
            date_from=d_from, date_to=d_to, limit=50, sort="-id", db=db, account_id=acc.id,
        )
        return {it["id"] for it in page["items"]}

    assert await day(date(2026, 10, 5), date(2026, 10, 5)) == {night.id, evening.id}
    assert await day(date(2026, 10, 4), date(2026, 10, 4)) == {before.id}
    assert await day(date(2026, 10, 6), date(2026, 10, 6)) == {after.id}
    assert await day(date(2026, 10, 4), date(2026, 10, 6)) == {before.id, night.id, evening.id, after.id}
    assert await day(date(2026, 10, 25), date(2026, 10, 25)) == {dst_late.id}
    assert await day(date(2026, 10, 26), date(2026, 10, 26)) == {dst_next.id}


TESTS = [v for k, v in sorted(globals().items()) if k.startswith("test_")]

if __name__ == "__main__":
    for t in TESTS:
        run(t())
    print(f"OK — {len(TESTS)} scenarii lista bonuri (cursor, zile locale, izolare) trecute.")
