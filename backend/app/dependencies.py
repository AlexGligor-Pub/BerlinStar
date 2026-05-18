from __future__ import annotations
import jwt
from fastapi import Depends, HTTPException, Query
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import SECRET_KEY, ALGORITHM
from app.database import get_db
from app.models.account import Account

_oauth2 = OAuth2PasswordBearer(tokenUrl="/api/auth/token")


def _decode_token(token: str) -> int:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expirat.")
    except jwt.PyJWTError:
        raise HTTPException(401, "Token invalid.")
    sub = payload.get("sub")
    if sub is None:
        raise HTTPException(401, "Token invalid.")
    try:
        return int(sub)
    except (TypeError, ValueError):
        raise HTTPException(401, "Token invalid.")


def _decode_token_with_scope(token: str, required_scope: str) -> int:
    """Decode token si valideaza scope-ul. Folosit pentru tokenii cu acces
    limitat — ex. scope="reports" pentru pagina Rapoarte."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expirat. Reintrodu parola pentru Rapoarte.")
    except jwt.PyJWTError:
        raise HTTPException(401, "Token invalid.")
    if payload.get("scope") != required_scope:
        raise HTTPException(401, "Token fara acces la Rapoarte.")
    sub = payload.get("sub")
    if sub is None:
        raise HTTPException(401, "Token invalid.")
    try:
        return int(sub)
    except (TypeError, ValueError):
        raise HTTPException(401, "Token invalid.")


async def get_account_id(token: str = Depends(_oauth2)) -> int:
    return _decode_token(token)


async def get_reports_account_id(token: str = Depends(_oauth2)) -> int:
    """Cere un token emis de /api/auth/reports/verify (scope=reports, TTL 1h)."""
    return _decode_token_with_scope(token, "reports")


async def get_account_id_from_query(token: str = Query(...)) -> int:
    return _decode_token(token)


async def get_current_account(
    account_id: int = Depends(get_account_id),
    db: AsyncSession = Depends(get_db),
) -> Account:
    account = (await db.execute(
        select(Account).where(Account.id == account_id, Account.is_deleted == False)
    )).scalar_one_or_none()
    if account is None:
        raise HTTPException(401, "Cont inexistent.")
    return account
