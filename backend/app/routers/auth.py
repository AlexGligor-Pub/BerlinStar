from __future__ import annotations
import logging
from datetime import datetime, timedelta, timezone
import jwt
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import SECRET_KEY, ALGORITHM, TOKEN_EXPIRE_DAYS
from app.database import get_db
from app.models.account import Account
from app.rate_limit import limiter
from app.utils.security import hash_password, is_legacy_hash, verify_password

log = logging.getLogger("berlinstar")

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

    if account is None or not verify_password(password, account.password):
        raise HTTPException(401, "Username sau parola incorecta.")

    if is_legacy_hash(account.password):
        account.password = hash_password(password)
        await db.commit()

    expire = datetime.now(timezone.utc) + timedelta(days=TOKEN_EXPIRE_DAYS)
    payload = {"sub": str(account.id), "name": account.name, "exp": expire}
    token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
    return token, account


@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/minute")
async def login(request: Request, body: LoginRequest, db: AsyncSession = Depends(get_db)):
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
    password: str = Field(..., min_length=10, max_length=255)
    email: EmailStr | None = Field(None, max_length=255)

    @field_validator("email")
    @classmethod
    def _no_crlf_in_email(cls, v: str | None) -> str | None:
        # EmailStr nu admite CRLF, dar adaugam check defensiv pt SMTP injection
        if v and ("\r" in v or "\n" in v):
            raise ValueError("Email invalid.")
        return v


class RegisterResponse(BaseModel):
    message: str


async def _send_client_nou(account_name: str, account_email: str, account_id: int) -> None:
    from app.database import AsyncSessionLocal
    from app.models.global_settings import GlobalSettings
    from app.utils.email_service import send_email
    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(GlobalSettings).limit(1))
            gs = result.scalar_one_or_none()
            company_name = (gs.smtp_from_name or "BerlinStar") if gs else "BerlinStar"
            await send_email(
                db,
                scenario="client_nou",
                variables={"client_name": account_name, "company_name": company_name},
                to_address=account_email,
                account_id=account_id,
            )
    except Exception:
        log.exception("Background _send_client_nou failed for account_id=%s", account_id)


@router.post("/register", response_model=RegisterResponse, status_code=201)
@limiter.limit("5/hour")
async def register(request: Request, body: RegisterRequest, background_tasks: BackgroundTasks, db: AsyncSession = Depends(get_db)):
    # Raspuns generic identic indiferent daca username-ul exista (no user enumeration)
    GENERIC_OK = RegisterResponse(
        message="Daca informatiile sunt corecte, vei primi un email cu detalii de acces."
    )

    existing = (await db.execute(
        select(Account).where(Account.username == body.username, Account.is_deleted == False)
    )).scalar_one_or_none()
    if existing is not None:
        log.info("Register: username already exists (%s)", body.username)
        return GENERIC_OK

    now = datetime.now(timezone.utc)
    account = Account(
        name=body.name,
        username=body.username,
        password=hash_password(body.password),
        email=body.email,
        is_locked=True,
        locked_at=now,
    )
    db.add(account)
    await db.commit()
    if account.email:
        background_tasks.add_task(_send_client_nou, account.name, account.email, account.id)
    return GENERIC_OK


@router.post("/token", response_model=TokenResponse, include_in_schema=False)
@limiter.limit("5/minute")
async def token_oauth2(
    request: Request,
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
