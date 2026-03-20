from __future__ import annotations
import base64
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


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int  # secunde


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    account = (await db.execute(
        select(Account).where(
            Account.username == body.username,
            Account.is_deleted == False,
        )
    )).scalar_one_or_none()

    expected = base64.b64encode(body.password.encode()).decode()
    if account is None or account.password != expected:
        raise HTTPException(401, "Username sau parola incorecta.")

    expire = datetime.now(timezone.utc) + timedelta(days=TOKEN_EXPIRE_DAYS)
    payload = {
        "sub": str(account.id),
        "name": account.name,
        "exp": expire,
    }
    token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

    return TokenResponse(
        access_token=token,
        expires_in=TOKEN_EXPIRE_DAYS * 24 * 3600,
    )
