"""Restaurarea unui cont sters (AdminV2 › Conturi › „Restaurează").

Butonul trimitea PATCH cu `is_deleted: false`, camp pe care `AccountUpdate` nu
il are, catre un handler care raspunde 404 pentru conturile sterse — deci nu
restaura niciodata nimic. Ruta dedicata e inversul stergerii, cu o exceptie:
sesiunile inchise la stergere raman inchise.

Rulabil cu pytest sau direct:  python -m tests.test_accounts_restore  (din backend/)
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import select, text

from app.auth_context import resolve_auth_context
from app.models.user import UserSession
from app.routers.accounts import delete_account, list_accounts, patch_account, restore_account
from app.schemas.account import AccountUpdate
from app.services.auth_service import _find_account
from tests._harness import make_account, make_session, make_user, raises_http, run


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


async def test_login_lookup_finds_the_account_only_while_it_is_not_deleted():
    """Pe schema nemodificata: cautarea contului de la login (dupa cod si, pentru
    clientii vechi, dupa username-ul contului) nu vede contul sters si il vede
    din nou dupa restaurare."""
    db = await make_session()
    acc = await make_account(db)
    await make_user(db, acc, "ion")
    await db.commit()
    assert (await _find_account(db, "firma", "ion")).id == acc.id

    await delete_account(acc.id, db=db)
    assert await _find_account(db, "firma", "ion") is None
    assert await _find_account(db, None, "firma") is None

    restored = await restore_account(acc.id, db=db)
    assert (await _find_account(db, "firma", "ion")).id == acc.id
    assert (await _find_account(db, None, "firma")).id == acc.id

    # A doua restaurare nu mai schimba nimic.
    stamp = restored.updated_at
    again = await restore_account(acc.id, db=db)
    assert again.is_deleted is False and again.updated_at == stamp


# Sesiunile create de teste, tinute in viata: sesiunea SQLAlchemy le pastreaza
# doar prin referinte slabe, iar recitite din SQLite `expires_at` isi pierde
# fusul orar si `resolve_auth_context` nu-l mai poate compara.
_KEEP: list[UserSession] = []


async def _open_session(db, acc, user, jti: str) -> None:
    now = datetime.now(timezone.utc)
    session = UserSession(
        user_id=user.id, account_id=acc.id, jti=jti,
        created_at=now, last_seen_at=now, expires_at=now + timedelta(days=30),
    )
    db.add(session)
    _KEEP.append(session)
    await db.flush()


async def _revoked_at(db, jti: str):
    # Coloana citita direct din baza, nu din obiectul tinut de sesiune.
    return (await db.execute(
        select(UserSession.revoked_at).where(UserSession.jti == jti)
    )).scalar_one()


def _resolve(db, acc, user, jti: str):
    # `request` nu e folosit in corpul functiei (vezi test_auth_context).
    return resolve_auth_context(request=None, db=db, account_id=acc.id, user_id=user.id, jti=jti)


async def test_delete_revokes_the_account_sessions_and_restore_keeps_them_revoked():
    db = await make_session()
    acc = await make_account(db)
    ion = await make_user(db, acc, "ion")
    ana = await make_user(db, acc, "ana")
    alta = await make_account(db, username="alta", code="alta")
    strain = await make_user(db, alta, "strain")
    await _open_session(db, acc, ion, "jti-ion")
    await _open_session(db, acc, ana, "jti-ana")
    await _open_session(db, alta, strain, "jti-strain")
    await db.commit()
    assert (await _resolve(db, acc, ion, "jti-ion")).account_id == acc.id

    await delete_account(acc.id, db=db)

    assert await _revoked_at(db, "jti-ion") is not None
    assert await _revoked_at(db, "jti-ana") is not None
    # Sesiunile altui cont nu sunt atinse.
    assert await _revoked_at(db, "jti-strain") is None

    await restore_account(acc.id, db=db)

    # Contul exista din nou, dar token-ul vechi ramane respins ca sesiune
    # incheiata — fara revocare ar fi trecut iar de `resolve_auth_context`.
    detail = await raises_http(401, _resolve(db, acc, ion, "jti-ion"))
    assert "incheiata" in detail
    assert await _revoked_at(db, "jti-ana") is not None
    assert (await _resolve(db, alta, strain, "jti-strain")).account_id == alta.id


async def test_restore_revokes_sessions_left_open_by_an_older_delete():
    """Conturile sterse inainte ca stergerea sa revoce sesiunile le au inca
    deschise; restaurarea le inchide ea."""
    db = await make_session()
    acc = await make_account(db)
    ion = await make_user(db, acc, "ion")
    await _open_session(db, acc, ion, "jti-ion")
    # Starea lasata de vechiul DELETE: doar `is_deleted`, sesiunea neatinsa.
    acc.is_deleted = True
    await db.commit()
    assert await _revoked_at(db, "jti-ion") is None

    await restore_account(acc.id, db=db)

    assert await _revoked_at(db, "jti-ion") is not None
    detail = await raises_http(401, _resolve(db, acc, ion, "jti-ion"))
    assert "incheiata" in detail


async def test_delete_of_a_missing_or_already_deleted_account_is_404():
    db = await make_session()
    acc = await make_account(db)
    await db.commit()
    await raises_http(404, delete_account(99999, db=db))
    await delete_account(acc.id, db=db)
    await raises_http(404, delete_account(acc.id, db=db))


async def test_restore_conflicts_with_an_active_account_using_the_same_code():
    """Garda de 409 din handler e doar defensiva: pe schema reala nu se poate
    ajunge la ea, fiindca `ix_accounts_code` si `ix_accounts_username` sunt
    indexuri unice TOTALE, deci contul sters isi tine codul si username-ul
    rezervate. Testul dovedeste un singur lucru — ca, daca indexul pe `code` ar
    deveni partial, restaurarea ar refuza coliziunea in loc sa lase doua conturi
    active cu acelasi cod. Ramura pe `username` nu e exercitata (unicitatea de
    pe coloana nu se poate scoate pe SQLite). Comportamentul de productie e
    acoperit de testele de mai sus, pe schema nemodificata."""
    db = await make_session()
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
