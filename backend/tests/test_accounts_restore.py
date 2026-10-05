"""Restaurarea unui cont sters (AdminV2 › Conturi › „Restaurează").

Butonul trimitea PATCH cu `is_deleted: false`, camp pe care `AccountUpdate` nu
il are, catre un handler care raspunde 404 pentru conturile sterse — deci nu
restaura niciodata nimic. Ruta dedicata e inversul exact al stergerii.

Rulabil cu pytest sau direct:  python -m tests.test_accounts_restore  (din backend/)
"""
from __future__ import annotations

from sqlalchemy import text

from app.routers.accounts import delete_account, list_accounts, patch_account, restore_account
from app.schemas.account import AccountUpdate
from tests._harness import make_account, make_session, raises_http, run


async def _listed(db, **kw) -> list[int]:
    page = await list_accounts(last_id=None, limit=20, q=None, filters=None, sort=None, db=db, **kw)
    return [a.id for a in page.items]


async def test_restore_brings_a_deleted_account_back():
    db = await make_session()
    acc = await make_account(db)
    await db.commit()
    await delete_account(acc.id, db=db)
    assert await _listed(db) == []

    restored = await restore_account(acc.id, db=db)

    assert restored.id == acc.id and restored.is_deleted is False
    assert restored.updated_at is not None
    assert await _listed(db) == [acc.id]
    # Contul e din nou editabil — inainte PATCH raspundea 404.
    patched = await patch_account(acc.id, AccountUpdate(name="Alt nume"), db=db)
    assert patched.name == "Alt nume"


async def test_restore_keeps_the_lock_state():
    """Stergerea nu blocheaza si nu deblocheaza contul; nici restaurarea."""
    db = await make_session()
    blocat = await make_account(db, username="blocat", code="blocat")
    blocat.is_locked = True
    activ = await make_account(db, username="activ", code="activ")
    await db.commit()
    for acc in (blocat, activ):
        await delete_account(acc.id, db=db)

    assert (await restore_account(blocat.id, db=db)).is_locked is True
    assert (await restore_account(activ.id, db=db)).is_locked is False


async def test_restore_of_an_active_account_changes_nothing():
    db = await make_session()
    acc = await make_account(db)
    await db.commit()

    same = await restore_account(acc.id, db=db)

    assert same.is_deleted is False and same.updated_at is None


async def test_restore_of_a_missing_account_is_404():
    db = await make_session()
    await raises_http(404, restore_account(99999, db=db))


async def test_restore_conflicts_with_an_active_account_using_the_same_code():
    db = await make_session()
    # Indexul unic pe `code` face coliziunea imposibila pe schema curenta; il
    # scoatem ca sa verificam garda din handler, care nu trebuie sa depinda de el.
    await db.execute(text("DROP INDEX ix_accounts_code"))
    sters = await make_account(db, username="veche", code="firma")
    await db.commit()
    await delete_account(sters.id, db=db)
    await make_account(db, username="noua", code="firma")
    await db.commit()

    detail = await raises_http(409, restore_account(sters.id, db=db))

    assert "cod" in detail.lower()
    assert await _listed(db, include_deleted=True) == [sters.id, sters.id + 1]
    assert await _listed(db) == [sters.id + 1]


TESTS = [v for k, v in sorted(globals().items()) if k.startswith("test_")]

if __name__ == "__main__":
    for t in TESTS:
        run(t())
    print(f"OK — {len(TESTS)} scenarii de restaurare cont trecute.")
