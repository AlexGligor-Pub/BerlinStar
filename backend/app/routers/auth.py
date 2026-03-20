from __future__ import annotations
import base64
from datetime import datetime, timedelta, timezone
import jwt
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
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


async def _authenticate(username: str, password: str, db: AsyncSession) -> str:
    account = (await db.execute(
        select(Account).where(
            Account.username == username,
            Account.is_deleted == False,
        )
    )).scalar_one_or_none()

    expected = base64.b64encode(password.encode()).decode()
    if account is None or account.password != expected:
        raise HTTPException(401, "Username sau parola incorecta.")

    expire = datetime.now(timezone.utc) + timedelta(days=TOKEN_EXPIRE_DAYS)
    payload = {"sub": str(account.id), "name": account.name, "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    token = await _authenticate(body.username, body.password, db)
    return TokenResponse(access_token=token, expires_in=TOKEN_EXPIRE_DAYS * 24 * 3600)


@router.post("/token", response_model=TokenResponse, include_in_schema=False)
async def token_oauth2(
    form: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    """Endpoint OAuth2 folosit de Swagger UI pentru butonul Authorize."""
    token = await _authenticate(form.username, form.password, db)
    return TokenResponse(access_token=token, expires_in=TOKEN_EXPIRE_DAYS * 24 * 3600)
