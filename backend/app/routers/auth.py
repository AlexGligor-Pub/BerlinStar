from __future__ import annotations
import base64
from datetime import datetime, timedelta, timezone
import jwt
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, Field
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
    is_locked: bool = False
    locked_at: datetime | None = None


async def _authenticate(username: str, password: str, db: AsyncSession) -> tuple[str, Account]:
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
    token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
    return token, account


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    token, account = await _authenticate(body.username, body.password, db)
    return TokenResponse(
        access_token=token,
        expires_in=TOKEN_EXPIRE_DAYS * 24 * 3600,
        is_locked=account.is_locked,
        locked_at=account.locked_at,
    )


class RegisterRequest(BaseModel):
    name: str = Field(..., max_length=200)
    username: str = Field(..., max_length=100)
    password: str = Field(..., min_length=6, max_length=255)
    email: str | None = Field(None, max_length=255)


class RegisterResponse(BaseModel):
    message: str


@router.post("/register", response_model=RegisterResponse, status_code=201)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    existing = (await db.execute(
        select(Account).where(Account.username == body.username, Account.is_deleted == False)
    )).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(409, "Acest nume de utilizator este deja folosit.")

    now = datetime.now(timezone.utc)
    account = Account(
        name=body.name,
        username=body.username,
        password=base64.b64encode(body.password.encode()).decode(),
        email=body.email,
        is_locked=True,
        locked_at=now,
    )
    db.add(account)
    await db.commit()
    return RegisterResponse(message="Contul a fost creat cu succes! Vei avea acces timp de 7 zile.")


@router.post("/token", response_model=TokenResponse, include_in_schema=False)
async def token_oauth2(
    form: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    """Endpoint OAuth2 folosit de Swagger UI pentru butonul Authorize."""
    token, account = await _authenticate(form.username, form.password, db)
    return TokenResponse(
        access_token=token,
        expires_in=TOKEN_EXPIRE_DAYS * 24 * 3600,
        is_locked=account.is_locked,
        locked_at=account.locked_at,
    )
