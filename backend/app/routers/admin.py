from __future__ import annotations
import hmac
import logging
import os
from datetime import datetime, timedelta, timezone
import jwt
from fastapi import APIRouter, Depends, HTTPException, Path, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import SECRET_KEY, ALGORITHM, TOKEN_EXPIRE_DAYS
from app.database import get_db
from app.dependencies import get_account_id
from app.models.account import Account
from app.rate_limit import limiter

log = logging.getLogger("berlinstar")

router = APIRouter()

# Parolele admin se citesc din env vars; fara fallback in productie.
# Pe dev, BERLINSTAR_DEV_SQLITE=1 permite si fallback de dev pentru ele.
_PASSWORD_1 = os.getenv("ADMIN_PASSWORD_1")
_PASSWORD_2 = os.getenv("ADMIN_PASSWORD_2")
if (not _PASSWORD_1 or not _PASSWORD_2):
    if os.getenv("BERLINSTAR_DEV_SQLITE") != "1":
        raise RuntimeError(
            "ADMIN_PASSWORD_1 si ADMIN_PASSWORD_2 sunt obligatorii. "
            "Seteaza-le in .env sau in environment-ul containerului."
        )


class VerifyRequest(BaseModel):
    password1: str
    password2: str


class VerifyResponse(BaseModel):
    ok: bool = True
    access_token: str
    token_type: str = "bearer"
    expires_in: int


def _safe_eq(a: str | None, b: str | None) -> bool:
    if not a or not b:
        return False
    return hmac.compare_digest(a.encode("utf-8"), b.encode("utf-8"))


@router.post("/verify", response_model=VerifyResponse)
@limiter.limit("3/minute")
async def verify_admin(request: Request, body: VerifyRequest, db: AsyncSession = Depends(get_db)):
    ok1 = _safe_eq(body.password1, _PASSWORD_1)
    ok2 = _safe_eq(body.password2, _PASSWORD_2)
    if not (ok1 and ok2):
        raise HTTPException(status_code=401, detail="Parole incorecte.")

    account = (await db.execute(
        select(Account).where(Account.username == "admin", Account.is_deleted == False)
    )).scalar_one_or_none()
    if account is None:
        raise HTTPException(status_code=500, detail="Contul administrator nu este configurat.")

    expire = datetime.now(timezone.utc) + timedelta(days=TOKEN_EXPIRE_DAYS)
    payload = {"sub": str(account.id), "name": account.name, "exp": expire}
    token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
    return VerifyResponse(access_token=token, expires_in=TOKEN_EXPIRE_DAYS * 24 * 3600)


class ImpersonateResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    username: str
    name: str
    is_locked: bool = False
    locked_at: datetime | None = None


async def _require_super_admin(
    account_id: int = Depends(get_account_id),
    db: AsyncSession = Depends(get_db),
) -> Account:
    account = (await db.execute(
        select(Account).where(
            Account.id == account_id,
            Account.is_deleted == False,
            Account.username == "admin",
        )
    )).scalar_one_or_none()
    if account is None:
        raise HTTPException(403, "Acces interzis: este necesar contul administrator.")
    return account


@router.post("/accounts/{account_id}/impersonate", response_model=ImpersonateResponse)
@limiter.limit("10/minute")
async def impersonate_account(
    request: Request,
    account_id: int = Path(..., gt=0),
    admin: Account = Depends(_require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    if account_id == admin.id:
        raise HTTPException(400, "Esti deja logat ca admin.")

    target = (await db.execute(
        select(Account).where(Account.id == account_id, Account.is_deleted == False)
    )).scalar_one_or_none()
    if target is None:
        raise HTTPException(404, "Contul nu exista.")

    expire = datetime.now(timezone.utc) + timedelta(days=TOKEN_EXPIRE_DAYS)
    payload = {"sub": str(target.id), "name": target.name, "exp": expire}
    token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
    log.warning(
        "Admin impersonation: admin_id=%s target_id=%s username=%s",
        admin.id, target.id, target.username,
    )
    return ImpersonateResponse(
        access_token=token,
        expires_in=TOKEN_EXPIRE_DAYS * 24 * 3600,
        username=target.username,
        name=target.name,
        is_locked=target.is_locked,
        locked_at=target.locked_at,
    )
