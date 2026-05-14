from __future__ import annotations
import hmac
import os
from datetime import datetime, timedelta, timezone
import jwt
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import SECRET_KEY, ALGORITHM, TOKEN_EXPIRE_DAYS
from app.database import get_db
from app.models.account import Account
from app.rate_limit import limiter

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
