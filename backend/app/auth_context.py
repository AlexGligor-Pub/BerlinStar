"""Contextul de autentificare: userul curent + sesiunea lui.

Separat de `app/dependencies.py` ca sa nu cream import-uri circulare
(`permissions` -> `models.user`, iar dependintele au nevoie de ambele).

Invariant important: `get_account_id` din dependencies.py continua sa intoarca
`account_id` din claim-ul `sub`, deci toate routerele existente (izolarea
multi-tenant) functioneaza neschimbat. Autorizarea pe roluri se adauga peste,
prin `require_resource(...)`.
"""
from __future__ import annotations
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.account import Account
from app.models.user import User, UserRole, UserSession
from app.permissions import Resource, allowed_resources, role_can

# Cat de rar actualizam `last_seen_at`: la fiecare request ar fi un UPDATE
# inutil pe fiecare apel de API.
LAST_SEEN_THROTTLE = timedelta(minutes=5)


@dataclass
class AuthContext:
    """Userul autentificat + sesiunea si contul lui.

    `session` nu e optional: fiecare token poarta un `jti`, iar unul fara el e
    respins in `resolve_auth_context`. Altfel am avea o cale prin care token-ul
    e valid dar nerevocabil.
    """
    user: User
    session: UserSession
    account: Account

    @property
    def role(self) -> UserRole:
        return self.user.role

    @property
    def account_id(self) -> int:
        return self.account.id

    def can(self, resource: Resource) -> bool:
        return role_can(self.user.role, resource)

    @property
    def resources(self) -> list[str]:
        return allowed_resources(self.user.role)


async def _touch_last_seen(db: AsyncSession, session: UserSession) -> None:
    now = datetime.now(timezone.utc)
    if now - session.last_seen_at < LAST_SEEN_THROTTLE:
        return
    session.last_seen_at = now
    await db.commit()


async def resolve_auth_context(
    request: Request,
    db: AsyncSession,
    account_id: int,
    user_id: int | None,
    jti: str | None,
) -> AuthContext:
    """Materializeaza contextul din claim-urile token-ului.

    Validarea se face din DB, nu doar din token: un rol schimbat, un user
    dezactivat sau o sesiune revocata au efect imediat, fara sa asteptam
    expirarea JWT-ului.

    Se executa pe fiecare request autentificat (vezi `get_account_id`), deci
    facem un singur SELECT cu join-uri; drumul cu interogari suplimentare e
    doar cel de eroare, unde latenta nu conteaza.
    """
    # Token emis inainte de migrarea la utilizatori (fara `uid`/`jti`): il tratam
    # ca sesiune expirata, ca sa forteze un login nou pe noul flux.
    #
    # `jti` e obligatoriu, nu doar verificat cand exista: un token fara el ar
    # trece de toate controalele de sesiune (revocare, expirare, deconectare
    # dispozitiv) fiindca n-ar avea ce sa caute in `user_sessions`.
    if user_id is None or not jti:
        raise HTTPException(401, "Sesiune invalida. Autentifica-te din nou.")

    row = (await db.execute(
        select(User, Account, UserSession)
        .join(Account, Account.id == User.account_id)
        .outerjoin(UserSession, UserSession.jti == jti)
        .where(
            User.id == user_id,
            User.account_id == account_id,
            User.is_deleted == False,
            Account.is_deleted == False,
        )
    )).first()

    if row is None:
        # Distingem cauzele doar aici, ca fluxul normal sa rămână un singur SELECT.
        account_exists = (await db.execute(
            select(Account.id).where(Account.id == account_id, Account.is_deleted == False)
        )).scalar_one_or_none()
        if account_exists is None:
            raise HTTPException(401, "Cont inexistent.")
        raise HTTPException(401, "Utilizator inexistent.")

    user, account, session = row
    # 401, nu 403: clientul trateaza 401 ca „sesiune moarta" si deconecteaza
    # curat. Cu 403 utilizatorul dezactivat ar rămâne blocat in aplicatie, cu
    # fiecare cerere esuand. Mesajul explica de ce, ca ecranul de login sa nu
    # para o deconectare aleatorie.
    if not user.is_active:
        raise HTTPException(401, "Utilizatorul a fost dezactivat. Contacteaza administratorul.")

    if session is None:
        raise HTTPException(401, "Sesiune inexistenta. Autentifica-te din nou.")
    if session.revoked_at is not None:
        raise HTTPException(401, "Sesiune incheiata. Autentifica-te din nou.")
    if session.user_id != user.id:
        raise HTTPException(401, "Sesiune invalida.")
    if session.expires_at <= datetime.now(timezone.utc):
        raise HTTPException(401, "Sesiune expirata. Autentifica-te din nou.")
    await _touch_last_seen(db, session)

    return AuthContext(user=user, session=session, account=account)
