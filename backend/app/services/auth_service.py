"""Autentificare pe utilizatori + gestiunea sesiunilor.

Login-ul cere `code` (codul firmei) + `username` + `password`, fiindca username-ul
e unic doar in interiorul contului. Pentru tranzitie, `code` e opuional: daca
lipseste, cadem pe login-ul vechi (username-ul contului) ca sa nu rupem clientii
care nu au fost inca actualizati.
"""
from __future__ import annotations
import secrets
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import SECRET_KEY, ALGORITHM, TOKEN_EXPIRE_DAYS
from app.models.account import Account
from app.models.device import Device
from app.models.user import User, UserSession
from app.utils import login_throttle
from app.utils.security import hash_password, is_legacy_hash, verify_password

# Mesaj unic pentru orice combinatie greasita — nu divulgam daca a fost codul,
# userul sau parola (evitam enumerarea conturilor/utilizatorilor).
INVALID_CREDENTIALS = "Cod firma, utilizator sau parola incorecte."


async def _find_account(db: AsyncSession, code: str | None, username: str) -> Account | None:
    if code:
        return (await db.execute(
            select(Account).where(
                Account.code == code.strip().lower(),
                Account.is_deleted == False,
            )
        )).scalar_one_or_none()
    # Fallback tranzitoriu: clientii vechi trimit doar username-ul contului.
    return (await db.execute(
        select(Account).where(
            Account.username == username,
            Account.is_deleted == False,
        )
    )).scalar_one_or_none()


async def authenticate_user(
    db: AsyncSession,
    code: str | None,
    username: str,
    password: str,
) -> tuple[User, Account]:
    # Blocarea se face pe combinatia incercata, nu pe IP — vezi login_throttle.
    login_throttle.assert_not_locked(code, username)

    account = await _find_account(db, code, username)
    if account is None:
        login_throttle.record_failure(code, username)
        raise HTTPException(401, INVALID_CREDENTIALS)

    user = (await db.execute(
        select(User).where(
            User.account_id == account.id,
            User.username == username,
            User.is_deleted == False,
        )
    )).scalar_one_or_none()
    if user is None or not verify_password(password, user.password):
        login_throttle.record_failure(code, username)
        raise HTTPException(401, INVALID_CREDENTIALS)

    # Parola a fost corecta: contorul se reseteaza chiar daca userul e
    # dezactivat, ca un cont suspendat sa nu ajunga blocat si dupa reactivare.
    login_throttle.record_success(code, username)
    if not user.is_active:
        raise HTTPException(403, "Utilizatorul este dezactivat. Contacteaza administratorul.")

    # Re-hash transparent pentru parolele in formatul vechi (base64).
    if is_legacy_hash(user.password):
        user.password = hash_password(password)
        await db.commit()

    return user, account


async def create_session(
    db: AsyncSession,
    user: User,
    account: Account,
    request: Request | None = None,
    device_id: int | None = None,
    device_name: str | None = None,
) -> tuple[str, UserSession]:
    """Creeaza o sesiune si intoarce (token JWT, sesiune).

    `jti` leaga token-ul de randul din `user_sessions`, ceea ce face token-ul
    revocabil (buton "Deconecteaza" din pagina Utilizatori).
    """
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=TOKEN_EXPIRE_DAYS)
    jti = secrets.token_urlsafe(32)

    # `device_id` vine din localStorage-ul clientului, deci nu e de incredere.
    # Daca statia a fost inregistrata pe alt cont (acelasi browser, alta firma),
    # legarea sesiunii de acel dispozitiv ar arata numele si locatia altui cont
    # in pagina Utilizatori. Il acceptam doar daca apartine contului curent.
    if device_id is not None:
        owned = (await db.execute(
            select(Device.id).where(Device.id == device_id, Device.account_id == account.id)
        )).scalar_one_or_none()
        if owned is None:
            device_id = None

    ip = None
    user_agent = None
    if request is not None:
        # X-Forwarded-For: primul IP e clientul real cand rulam in spatele Caddy.
        fwd = request.headers.get("x-forwarded-for")
        ip = (fwd.split(",")[0].strip() if fwd else None) or (
            request.client.host if request.client else None
        )
        user_agent = (request.headers.get("user-agent") or None)
        if user_agent:
            user_agent = user_agent[:500]

    session = UserSession(
        user_id=user.id,
        account_id=account.id,
        jti=jti,
        device_id=device_id,
        device_name=(device_name or None),
        ip=ip,
        user_agent=user_agent,
        created_at=now,
        last_seen_at=now,
        expires_at=expires_at,
    )
    db.add(session)
    user.last_login_at = now
    await db.commit()

    payload = {
        "sub": str(account.id),      # neschimbat: izolarea multi-tenant
        "uid": str(user.id),
        "role": user.role.value,
        "jti": jti,
        "name": account.name,
        "exp": expires_at,
    }
    token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
    return token, session


async def revoke_session(db: AsyncSession, session: UserSession) -> None:
    if session.revoked_at is None:
        session.revoked_at = datetime.now(timezone.utc)
        await db.commit()


async def revoke_all_sessions(
    db: AsyncSession, user_id: int, except_jti: str | None = None
) -> int:
    """Revoca sesiunile active ale unui user. Folosit la schimbarea parolei,
    dezactivare sau stergere — accesul se taie imediat, nu la expirarea token-ului.

    `except_jti` pastreaza o sesiune (tipic cea curenta, ca userul care si-a
    schimbat parola sa nu fie dat afara din aplicatie).
    """
    now = datetime.now(timezone.utc)
    conditions = [
        UserSession.user_id == user_id,
        UserSession.revoked_at.is_(None),
    ]
    if except_jti is not None:
        conditions.append(UserSession.jti != except_jti)
    sessions = (await db.execute(select(UserSession).where(*conditions))).scalars().all()
    for s in sessions:
        s.revoked_at = now
    if sessions:
        await db.commit()
    return len(sessions)
