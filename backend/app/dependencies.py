from __future__ import annotations
from typing import Callable

import jwt
from fastapi import Depends, HTTPException, Query, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth_context import AuthContext, resolve_auth_context
from app.config import SECRET_KEY, ALGORITHM
from app.database import AsyncSessionLocal, get_db
from app.models.account import Account
from app.permissions import Resource

_oauth2 = OAuth2PasswordBearer(tokenUrl="/api/auth/token")


def _decode_payload(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expirat.")
    except jwt.PyJWTError:
        raise HTTPException(401, "Token invalid.")


# get_account_id / get_account_id_from_query si dependintele pe roluri sunt
# definite la finalul fisierului, dupa get_auth_context (de care depind).


# ─── Autorizare pe roluri ─────────────────────────────────────────────────────
# `get_account_id` (mai sus) rămâne neschimbat, deci izolarea multi-tenant din
# toate routerele existente functioneaza ca inainte. Peste ea adaugam userul si
# rolul lui, verificate din DB la fiecare request.

async def get_auth_context(
    request: Request,
    token: str = Depends(_oauth2),
    db: AsyncSession = Depends(get_db),
) -> AuthContext:
    payload = _decode_payload(token)
    sub = payload.get("sub")
    if sub is None:
        raise HTTPException(401, "Token invalid.")
    try:
        account_id = int(sub)
    except (TypeError, ValueError):
        raise HTTPException(401, "Token invalid.")

    uid = payload.get("uid")
    try:
        user_id = int(uid) if uid is not None else None
    except (TypeError, ValueError):
        raise HTTPException(401, "Token invalid.")

    return await resolve_auth_context(
        request=request,
        db=db,
        account_id=account_id,
        user_id=user_id,
        jti=payload.get("jti"),
    )


def require_resource(resource: Resource) -> Callable:
    """Dependinta care cere acces la o resursa (vezi app/permissions.py).

    Folosire:
        @router.get("", dependencies=[Depends(require_resource(Resource.REPORTS))])
    sau, cand ai nevoie si de user in handler:
        ctx: AuthContext = Depends(require_resource(Resource.SETTINGS))
    """
    async def _dep(ctx: AuthContext = Depends(get_auth_context)) -> AuthContext:
        if not ctx.can(resource):
            raise HTTPException(
                403,
                f"Rolul '{ctx.role.value}' nu are acces la aceasta secțiune.",
            )
        return ctx
    return _dep


async def get_reports_account_id(ctx: AuthContext = Depends(get_auth_context)) -> int:
    """Acces la zona Rapoarte — acum pe ROL (admin), nu pe parola separata.

    Numele e pastrat intentionat: routerele care il foloseau (reports.py,
    leaves.py) nu necesita modificari; se schimba doar semantica, de la
    "token cu scope=reports" la "rolul are acces la Resource.REPORTS".
    """
    if not ctx.can(Resource.REPORTS):
        raise HTTPException(403, "Doar administratorul contului are acces la Rapoarte.")
    return ctx.account_id


async def get_advanced_account_id(ctx: AuthContext = Depends(get_auth_context)) -> int:
    """Acces la zonele avansate (Stocuri, fisa angajat, e-Factura, Factura
    Rapida) — admin + manager."""
    if not ctx.can(Resource.ADVANCED):
        raise HTTPException(403, "Rolul tau nu are acces la aceasta secțiune.")
    return ctx.account_id


async def get_settings_account_id(ctx: AuthContext = Depends(get_auth_context)) -> int:
    """Acces la Setari / Configurari — admin + manager."""
    if not ctx.can(Resource.SETTINGS):
        raise HTTPException(403, "Rolul tau nu are acces la Setari.")
    return ctx.account_id


async def get_account_id(ctx: AuthContext = Depends(get_auth_context)) -> int:
    """Contul curent (izolarea multi-tenant) — dependinta folosita de aproape
    toate routerele.

    Trece prin `get_auth_context` INTENTIONAT: altfel „Deconecteaza dispozitivul"
    si dezactivarea unui utilizator ar avea efect doar pe rutele care verifica
    rolul, iar restul aplicatiei ar rămâne accesibila pana la expirarea JWT-ului.
    FastAPI cache-uieste dependintele pe request, deci nu plătim de doua ori
    validarea cand un endpoint cere si contextul.
    """
    return ctx.account_id


async def get_account_id_from_query(
    request: Request,
    token: str = Query(...),
) -> int:
    """Varianta cu token in query string, pentru EventSource (SSE), care nu poate
    trimite headere. Valideaza sesiunea la fel ca fluxul normal.

    Sesiunea DB e deschisa local, NU prin `Depends(get_db)`: FastAPI inchide
    dependintele cu yield abia dupa ce raspunsul s-a terminat de trimis, iar un
    SSE nu se termina niciodata — fiecare tab deschis ar tine o conexiune din
    pool blocata `idle in transaction` pana la epuizarea lui.
    """
    payload = _decode_payload(token)
    sub = payload.get("sub")
    uid = payload.get("uid")
    try:
        account_id = int(sub) if sub is not None else None
        user_id = int(uid) if uid is not None else None
    except (TypeError, ValueError):
        raise HTTPException(401, "Token invalid.")
    if account_id is None:
        raise HTTPException(401, "Token invalid.")
    async with AsyncSessionLocal() as db:
        ctx = await resolve_auth_context(
            request=request, db=db, account_id=account_id,
            user_id=user_id, jti=payload.get("jti"),
        )
        return ctx.account_id


async def get_current_account(ctx: AuthContext = Depends(get_auth_context)) -> Account:
    return ctx.account


async def get_admin_account(ctx: AuthContext = Depends(get_auth_context)) -> Account:
    """Contul curent, dar numai pentru rolul `admin`.

    Pentru operatiuni care privesc firma ca entitate — datele de identitate ale
    contului, abonamentul, facturile catre noi. Un manager are acces la
    Configurări (setari operationale), dar nu trebuie sa poata redenumi firma
    sau sa initieze o plata.
    """
    if not ctx.can(Resource.USERS):
        raise HTTPException(403, "Doar administratorul contului poate face aceasta operatiune.")
    return ctx.account


async def get_actor_username(ctx: AuthContext = Depends(get_auth_context)) -> str:
    """Username-ul celui care face actiunea, pentru jurnalele de audit.

    Inainte de multi-user nu aveam ce sa scriem aici (contul era o singura
    identitate), asa ca `stock_movements.created_by_user` rămânea NULL. Acum
    stim exact cine a facut miscarea.
    """
    return ctx.user.username


# Contul de platforma (noi, Professor Prime) este identificat prin username-ul
# rezervat "admin". Rutele /api/admin/* si /api/accounts/* ii apartin exclusiv.
PLATFORM_ACCOUNT_USERNAME = "admin"


async def get_platform_admin_account(ctx: AuthContext = Depends(get_auth_context)) -> Account:
    """Super-adminul de platforma — gestioneaza CONTURILE clientilor, nu un cont.

    Doua conditii, nu una: token-ul trebuie sa apartina contului de platforma
    *si* utilizatorul din el trebuie sa aiba rol `admin`. Altfel un `worker`
    creat in contul de platforma ar administra toti clientii.
    """
    if ctx.account.username != PLATFORM_ACCOUNT_USERNAME:
        raise HTTPException(403, "Acces interzis: este necesar contul administrator.")
    if not ctx.can(Resource.USERS):
        raise HTTPException(403, "Acces interzis: este necesar rolul de administrator.")
    return ctx.account
