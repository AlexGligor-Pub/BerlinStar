"""Ce se intampla la fiecare request autentificat: sesiunea chiar e verificata.

Miza e ca revocarea sa fie reala. Un token JWT traieste 30 de zile, deci daca
verificarea din DB poate fi ocolita, „Deconecteaza dispozitivul" si dezactivarea
unui utilizator devin butoane decorative pana la expirare.

Regresia principala acoperita: un token FARA `jti` primea context valid, iar
toate controalele de sesiune erau sarite in tacere.

Rulabil cu pytest sau direct:  python -m tests.test_auth_context
"""
from __future__ import annotations
from datetime import datetime, timedelta, timezone

from app.auth_context import resolve_auth_context
from app.models.user import UserRole, UserSession
from app.permissions import Resource
from tests._harness import make_account, make_session, make_user, raises_http, run


async def _fixture(role=UserRole.ADMIN, is_active=True):
    db = await make_session()
    acc = await make_account(db)
    user = await make_user(db, acc, "ion", role, is_active=is_active)
    now = datetime.now(timezone.utc)
    session = UserSession(
        user_id=user.id,
        account_id=acc.id,
        jti="jti-valid",
        created_at=now,
        last_seen_at=now,
        expires_at=now + timedelta(days=30),
    )
    db.add(session)
    await db.commit()
    return db, acc, user, session


def _resolve(db, acc, user, jti="jti-valid"):
    # `request` nu e folosit in corpul functiei; il pasam None ca sa nu construim
    # un obiect ASGI fals doar de dragul semnaturii.
    return resolve_auth_context(
        request=None, db=db, account_id=acc.id, user_id=user.id, jti=jti,
    )


async def test_happy_path():
    db, acc, user, _s = await _fixture()
    ctx = await _resolve(db, acc, user)
    assert ctx.user.id == user.id
    assert ctx.account_id == acc.id
    assert ctx.role == UserRole.ADMIN
    assert ctx.can(Resource.REPORTS)
    assert ctx.session is not None


async def test_token_without_jti_is_rejected():
    """Regresie: fara `jti` se sareau TOATE verificarile de sesiune."""
    db, acc, user, _s = await _fixture()
    await raises_http(401, _resolve(db, acc, user, jti=None))
    await raises_http(401, _resolve(db, acc, user, jti=""))


async def test_token_without_uid_is_rejected():
    db, acc, _user, _s = await _fixture()
    await raises_http(401, resolve_auth_context(
        request=None, db=db, account_id=acc.id, user_id=None, jti="jti-valid",
    ))


async def test_unknown_jti_is_rejected():
    db, acc, user, _s = await _fixture()
    await raises_http(401, _resolve(db, acc, user, jti="inventat"))


async def test_revoked_session_is_rejected_immediately():
    db, acc, user, session = await _fixture()
    session.revoked_at = datetime.now(timezone.utc)
    await db.commit()
    await raises_http(401, _resolve(db, acc, user))


async def test_expired_session_is_rejected():
    db, acc, user, session = await _fixture()
    session.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
    await db.commit()
    await raises_http(401, _resolve(db, acc, user))


async def test_deactivated_user_gets_401_not_403():
    """401, ca frontend-ul sa deconecteze curat. Cu 403 omul ramanea blocat in
    aplicatie, cu fiecare cerere esuand."""
    db, acc, user, _s = await _fixture(is_active=False)
    detail = await raises_http(401, _resolve(db, acc, user))
    assert "dezactivat" in detail.lower()


async def test_session_of_another_user_cannot_be_borrowed():
    db, acc, user, session = await _fixture()
    other = await make_user(db, acc, "vasile", UserRole.WORKER)
    await db.commit()
    # Token cu uid-ul lui vasile, dar jti-ul sesiunii lui ion.
    await raises_http(401, _resolve(db, acc, other))


async def test_user_from_another_account_is_rejected():
    db, acc, user, _s = await _fixture()
    other_acc = await make_account(db, username="alta", code="alta")
    await db.commit()
    await raises_http(401, resolve_auth_context(
        request=None, db=db, account_id=other_acc.id, user_id=user.id, jti="jti-valid",
    ))


async def test_role_change_takes_effect_without_relogin():
    """Rolul se citeste din DB la fiecare request, nu din claim-ul token-ului."""
    db, acc, user, _s = await _fixture(role=UserRole.ADMIN)
    assert (await _resolve(db, acc, user)).can(Resource.REPORTS)

    user.role = UserRole.WORKER
    await db.commit()
    ctx = await _resolve(db, acc, user)
    assert not ctx.can(Resource.REPORTS)
    assert not ctx.can(Resource.SETTINGS)
    assert ctx.can(Resource.OPERATIONS)


async def test_deleted_user_is_rejected():
    db, acc, user, _s = await _fixture()
    user.is_deleted = True
    await db.commit()
    await raises_http(401, _resolve(db, acc, user))


TESTS = [v for k, v in sorted(globals().items()) if k.startswith("test_")]

if __name__ == "__main__":
    for t in TESTS:
        run(t())
    print(f"OK — {len(TESTS)} scenarii de sesiune/autorizare trecute.")
