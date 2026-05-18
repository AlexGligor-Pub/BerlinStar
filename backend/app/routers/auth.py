from __future__ import annotations
import logging
from datetime import datetime, timedelta, timezone
import jwt
from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Request, UploadFile
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import SECRET_KEY, ALGORITHM, TOKEN_EXPIRE_DAYS
from app.database import get_db
from app.dependencies import get_current_account
from app.models.account import Account
from app.models.company import Company
from app.rate_limit import limiter
from app.services.account_seeder import seed_new_account
from app.utils.security import hash_password, is_legacy_hash, verify_password
from app.utils.storage import delete_image_by_url, upload_image, validate_image

# Token de acces la pagina Rapoarte: scurt (1h), scope distinct fata de
# token-ul normal de login, ca sa nu ne incurcam intre ele in dependinte.
REPORTS_TOKEN_TTL_SECONDS = 3600

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
    cui_firma: int = Field(..., gt=0)
    phone: str = Field(..., min_length=1, max_length=50)

    @field_validator("email")
    @classmethod
    def _no_crlf_in_email(cls, v: str | None) -> str | None:
        # EmailStr nu admite CRLF, dar adaugam check defensiv pt SMTP injection
        if v and ("\r" in v or "\n" in v):
            raise ValueError("Email invalid.")
        return v

    @field_validator("phone")
    @classmethod
    def _phone_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Numarul de telefon este obligatoriu.")
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
    await db.flush()

    company = Company(
        account_id=account.id,
        cui=body.cui_firma,
        name=body.name,
        phone=body.phone,
    )
    db.add(company)
    await db.commit()

    background_tasks.add_task(
        seed_new_account,
        account_id=account.id,
        company_id=company.id,
        cui=body.cui_firma,
        fallback_name=body.name,
        fallback_phone=body.phone,
    )
    if account.email:
        background_tasks.add_task(_send_client_nou, account.name, account.email, account.id)
    return GENERIC_OK


class ChangePasswordRequest(BaseModel):
    old_password: str = Field(..., min_length=1, max_length=255)
    new_password: str = Field(..., min_length=10, max_length=255)


class MessageResponse(BaseModel):
    message: str


class MeResponse(BaseModel):
    """Detaliile contului curent (fara campuri sensibile: parolele, flag-uri admin)."""
    id: int
    name: str
    username: str
    description: str | None
    email: str | None
    image_url: str | None


class MeUpdateRequest(BaseModel):
    """Acceptam doar campurile pe care userul are voie sa si le editeze din
    propriul cont. Username-ul ramane imuabil, parolele se schimba prin
    endpointurile dedicate.
    """
    name: str | None = Field(None, max_length=200)
    description: str | None = None
    email: EmailStr | None = Field(None, max_length=255)
    image_url: str | None = Field(None, max_length=500)

    @field_validator("email")
    @classmethod
    def _no_crlf_in_email(cls, v: str | None) -> str | None:
        if v and ("\r" in v or "\n" in v):
            raise ValueError("Email invalid.")
        return v


@router.get("/me", response_model=MeResponse)
async def get_me(account: Account = Depends(get_current_account)):
    return MeResponse(
        id=account.id,
        name=account.name,
        username=account.username,
        description=account.description,
        email=account.email,
        image_url=account.image_url,
    )


@router.patch("/me", response_model=MeResponse)
@limiter.limit("20/minute")
async def update_me(
    request: Request,
    body: MeUpdateRequest,
    account: Account = Depends(get_current_account),
    db: AsyncSession = Depends(get_db),
):
    patch = body.model_dump(exclude_unset=True)
    if "name" in patch:
        new_name = (patch["name"] or "").strip()
        if not new_name:
            raise HTTPException(400, "Numele nu poate fi gol.")
        account.name = new_name
    if "description" in patch:
        account.description = patch["description"]
    if "email" in patch:
        account.email = patch["email"] or None
    if "image_url" in patch:
        url = patch["image_url"]
        account.image_url = (url.strip() or None) if isinstance(url, str) else url
    account.updated_at = datetime.now(timezone.utc)
    await db.commit()
    return MeResponse(
        id=account.id,
        name=account.name,
        username=account.username,
        description=account.description,
        email=account.email,
        image_url=account.image_url,
    )


@router.post("/me/image", response_model=MeResponse)
@limiter.limit("5/minute")
async def upload_me_image(
    request: Request,
    file: UploadFile = File(...),
    account: Account = Depends(get_current_account),
    db: AsyncSession = Depends(get_db),
):
    """Upload imagine de profil. Inlocuieste imaginea curenta (daca exista) si
    o sterge din S3 doar dupa commit reusit, ca sa nu pierdem fisierul vechi
    inainte de a-l confirma pe cel nou in DB.
    """
    data = await validate_image(file)
    old_url = account.image_url
    url = await upload_image(account.id, "accounts/avatars", data, file.content_type)
    account.image_url = url
    account.updated_at = datetime.now(timezone.utc)
    await db.commit()
    if old_url:
        await delete_image_by_url(old_url)
    return MeResponse(
        id=account.id,
        name=account.name,
        username=account.username,
        description=account.description,
        email=account.email,
        image_url=account.image_url,
    )


@router.delete("/me/image", response_model=MeResponse)
async def delete_me_image(
    account: Account = Depends(get_current_account),
    db: AsyncSession = Depends(get_db),
):
    old_url = account.image_url
    account.image_url = None
    account.updated_at = datetime.now(timezone.utc)
    await db.commit()
    if old_url:
        await delete_image_by_url(old_url)
    return MeResponse(
        id=account.id,
        name=account.name,
        username=account.username,
        description=account.description,
        email=account.email,
        image_url=account.image_url,
    )


@router.post("/change-password", response_model=MessageResponse)
@limiter.limit("5/minute")
async def change_password(
    request: Request,
    body: ChangePasswordRequest,
    account: Account = Depends(get_current_account),
    db: AsyncSession = Depends(get_db),
):
    if not verify_password(body.old_password, account.password):
        raise HTTPException(401, "Parola curenta este incorecta.")
    account.password = hash_password(body.new_password)
    account.updated_at = datetime.now(timezone.utc)
    await db.commit()
    return MessageResponse(message="Parola a fost schimbata.")


class ReportsPasswordStatus(BaseModel):
    has_password: bool


@router.get("/reports/status", response_model=ReportsPasswordStatus)
async def reports_password_status(account: Account = Depends(get_current_account)):
    return ReportsPasswordStatus(has_password=bool(account.reports_password))


class ReportsVerifyRequest(BaseModel):
    password: str = Field(..., min_length=1, max_length=255)


class ReportsTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


@router.post("/reports/verify", response_model=ReportsTokenResponse)
@limiter.limit("5/minute")
async def reports_verify(
    request: Request,
    body: ReportsVerifyRequest,
    account: Account = Depends(get_current_account),
):
    if not account.reports_password:
        raise HTTPException(409, "Parola pentru Rapoarte nu este setata. Seteaza-o din Configurari -> Contul Meu.")
    if not verify_password(body.password, account.reports_password):
        raise HTTPException(401, "Parola incorecta.")
    expire = datetime.now(timezone.utc) + timedelta(seconds=REPORTS_TOKEN_TTL_SECONDS)
    payload = {
        "sub": str(account.id),
        "name": account.name,
        "scope": "reports",
        "exp": expire,
    }
    token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
    return ReportsTokenResponse(access_token=token, expires_in=REPORTS_TOKEN_TTL_SECONDS)


class ReportsSetPasswordRequest(BaseModel):
    # `old_password` este obligatorie doar daca exista deja o parola setata.
    old_password: str | None = Field(None, max_length=255)
    # min_length=10 ca la login — Rapoartele expun date sensibile (cifra de
    # afaceri, target angajati), deci nu pot avea parola mai slaba decat
    # contul principal.
    new_password: str = Field(..., min_length=10, max_length=255)


@router.post("/reports/set-password", response_model=MessageResponse)
@limiter.limit("5/minute")
async def reports_set_password(
    request: Request,
    body: ReportsSetPasswordRequest,
    account: Account = Depends(get_current_account),
    db: AsyncSession = Depends(get_db),
):
    if account.reports_password:
        if not body.old_password or not verify_password(body.old_password, account.reports_password):
            raise HTTPException(401, "Parola curenta pentru Rapoarte este incorecta.")
    account.reports_password = hash_password(body.new_password)
    account.updated_at = datetime.now(timezone.utc)
    await db.commit()
    return MessageResponse(message="Parola pentru Rapoarte a fost salvata.")


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
