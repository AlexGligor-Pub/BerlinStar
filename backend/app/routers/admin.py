from __future__ import annotations
from datetime import datetime, timedelta, timezone
import jwt
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import SECRET_KEY, ALGORITHM, TOKEN_EXPIRE_DAYS
from app.database import get_db
from app.models.account import Account

router = APIRouter()

_PASSWORD_1 = "alexgligor"
_PASSWORD_2 = "ADASTools1"


class VerifyRequest(BaseModel):
    password1: str
    password2: str


class VerifyResponse(BaseModel):
    ok: bool = True
    access_token: str
    token_type: str = "bearer"
    expires_in: int


@router.post("/verify", response_model=VerifyResponse)
async def verify_admin(body: VerifyRequest, db: AsyncSession = Depends(get_db)):
    if body.password1 != _PASSWORD_1 or body.password2 != _PASSWORD_2:
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
