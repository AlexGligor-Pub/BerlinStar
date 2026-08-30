from __future__ import annotations
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Request, UploadFile
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth_context import AuthContext
from app.config import TOKEN_EXPIRE_DAYS
from app.database import get_db
from app.dependencies import get_admin_account, get_auth_context
from app.models.account import Account
from app.models.company import Company
from app.models.user import User
from app.permissions import Resource, allowed_resources
from app.rate_limit import limiter
from app.services.account_provisioning import provision_account_admin
from app.services.account_seeder import seed_new_account
from app.services.auth_service import (
    authenticate_user,
    create_session,
    revoke_all_sessions,
    revoke_session,
)
from app.utils.security import hash_password, is_legacy_hash, verify_password
from app.utils.storage import delete_image_by_url, upload_image, validate_image

log = logging.getLogger("berlinstar")

router = APIRouter()


class LoginRequest(BaseModel):
    # Codul firmei — necesar fiindca username-ul e unic doar in interiorul
    # contului. Opuional pentru tranzitie: fara el cadem pe username-ul contului.
    code: str | None = Field(None, max_length=50)
    username: str
    password: str
    # Dispozitivul POS inregistrat local (bs_device), ca sa putem arata in pagina
    # Utilizatori pe ce dispozitive e logat fiecare user.
    device_id: int | None = None
    device_name: str | None = Field(None, max_length=200)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int  # secunde
    is_locked: bool = False
    locked_at: datetime | None = None
    # Rolul si resursele permise — clientul le foloseste ca sa ascunda UI.
    # Enforcement-ul real rămâne pe server (vezi app/permissions.py).
    role: str
    resources: list[str] = []
    # Codul firmei, asa cum il stie serverul. Clientul NU trebuie sa-l deduca din
    # ce a tastat operatorul: la login fara cod (fluxul „contul principal") ar
    # ramane null si statia s-ar considera „alta firma" la fiecare autentificare,
    # pierzandu-si dispozitivul inregistrat.
    code: str | None = None


async def _apply_subscription_lock(account: Account, db: AsyncSession) -> None:
    """Auto-lock daca abonamentul a expirat (in caz ca jobul de scheduler nu a
    rulat inca). Contul de platforma (username=='admin') este exceptat.
    """
    if account.username == "admin":
        return
    from datetime import date as _date
    from app.models.subscription import AccountSubscription
    sub = (await db.execute(
        select(AccountSubscription).where(AccountSubscription.account_id == account.id)
    )).scalar_one_or_none()
    if sub is not None and sub.next_payment_date < _date.today() and not account.is_locked:
        account.is_locked = True
        account.locked_at = datetime.now(timezone.utc)
        await db.commit()


async def _authenticate(username: str, password: str, db: AsyncSession) -> tuple[str, User, Account]:
    """Varianta fara context de request — folosita de fluxul OAuth2 (Swagger)."""
    user, account = await authenticate_user(db, None, username, password)
    await _apply_subscription_lock(account, db)
    token, _ = await create_session(db, user, account)
    return token, user, account


@router.post("/login", response_model=TokenResponse)
# Limita pe IP e larga intentionat: intr-un service toata echipa iese prin
# acelasi NAT, iar 5/minut inseamna ca la schimbul de tura oamenii se blocheaza
# reciproc. Brute-force-ul e oprit unde conteaza — pe combinatia (firma, user),
# in app/utils/login_throttle.py.
@limiter.limit("30/minute")
async def login(request: Request, body: LoginRequest, db: AsyncSession = Depends(get_db)):
    user, account = await authenticate_user(db, body.code, body.username, body.password)
    await _apply_subscription_lock(account, db)
    token, _session = await create_session(
        db, user, account,
        request=request,
        device_id=body.device_id,
        device_name=body.device_name,
    )
    return TokenResponse(
        access_token=token,
        expires_in=TOKEN_EXPIRE_DAYS * 24 * 3600,
        is_locked=account.is_locked,
        locked_at=account.locked_at,
        role=user.role.value,
        resources=allowed_resources(user.role),
        code=account.code,
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
    password_hash = hash_password(body.password)
    account = Account(
        name=body.name,
        username=body.username,
        password=password_hash,
        email=body.email,
        is_locked=True,
        locked_at=now,
    )
    db.add(account)
    await db.flush()

    # Codul firmei + utilizatorul `admin`: fara ele contul nou nu s-ar putea
    # autentifica, fiindca login-ul cauta in `users`, nu in `accounts`.
    await provision_account_admin(db, account, password_hash, commit=False)

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
    """Detaliile contului + userul curent (fara campuri sensibile: parole)."""
    id: int
    name: str
    username: str
    description: str | None
    email: str | None
    image_url: str | None
    # Codul firmei — afisat userului ca sa-l poata da colegilor pentru login.
    code: str | None = None
    # Identitatea si drepturile userului logat.
    user_id: int | None = None
    user_name: str | None = None
    user_username: str | None = None
    role: str | None = None
    resources: list[str] = []


def _me_response(ctx: AuthContext) -> MeResponse:
    account, user = ctx.account, ctx.user
    return MeResponse(
        id=account.id,
        name=account.name,
        username=account.username,
        description=account.description,
        email=account.email,
        image_url=account.image_url,
        code=account.code,
        user_id=user.id,
        user_name=user.name,
        user_username=user.username,
        role=user.role.value,
        resources=ctx.resources,
    )


@router.post("/logout", response_model=MessageResponse)
async def logout(ctx: AuthContext = Depends(get_auth_context), db: AsyncSession = Depends(get_db)):
    """Revoca sesiunea curenta, ca token-ul sa nu mai fie folosibil dupa logout."""
    await revoke_session(db, ctx.session)
    return MessageResponse(message="Sesiune inchisa.")


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
async def get_me(ctx: AuthContext = Depends(get_auth_context)):
    return _me_response(ctx)


@router.patch("/me", response_model=MeResponse)
@limiter.limit("20/minute")
async def update_me(
    request: Request,
    body: MeUpdateRequest,
    ctx: AuthContext = Depends(get_auth_context),
    db: AsyncSession = Depends(get_db),
):
    # Datele contului (numele firmei, emailul, imaginea) sunt identitatea
    # organizatiei, nu preferinte personale — le poate schimba doar adminul.
    if not ctx.can(Resource.USERS):
        raise HTTPException(403, "Doar administratorul contului poate modifica datele contului.")
    account = ctx.account
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
    return _me_response(ctx)


@router.post("/me/image", response_model=MeResponse)
@limiter.limit("5/minute")
async def upload_me_image(
    request: Request,
    file: UploadFile = File(...),
    ctx: AuthContext = Depends(get_auth_context),
    db: AsyncSession = Depends(get_db),
):
    """Upload imagine de profil. Inlocuieste imaginea curenta (daca exista) si
    o sterge din S3 doar dupa commit reusit, ca sa nu pierdem fisierul vechi
    inainte de a-l confirma pe cel nou in DB.
    """
    # Datele contului (numele firmei, emailul, imaginea) sunt identitatea
    # organizatiei, nu preferinte personale — le poate schimba doar adminul.
    if not ctx.can(Resource.USERS):
        raise HTTPException(403, "Doar administratorul contului poate modifica datele contului.")
    account = ctx.account
    data = await validate_image(file)
    old_url = account.image_url
    url = await upload_image(account.id, "accounts/avatars", data, file.content_type)
    account.image_url = url
    account.updated_at = datetime.now(timezone.utc)
    await db.commit()
    if old_url:
        await delete_image_by_url(old_url)
    return _me_response(ctx)


@router.delete("/me/image", response_model=MeResponse)
async def delete_me_image(
    ctx: AuthContext = Depends(get_auth_context),
    db: AsyncSession = Depends(get_db),
):
    # Datele contului (numele firmei, emailul, imaginea) sunt identitatea
    # organizatiei, nu preferinte personale — le poate schimba doar adminul.
    if not ctx.can(Resource.USERS):
        raise HTTPException(403, "Doar administratorul contului poate modifica datele contului.")
    account = ctx.account
    old_url = account.image_url
    account.image_url = None
    account.updated_at = datetime.now(timezone.utc)
    await db.commit()
    if old_url:
        await delete_image_by_url(old_url)
    return _me_response(ctx)


@router.post("/change-password", response_model=MessageResponse)
@limiter.limit("5/minute")
async def change_password(
    request: Request,
    body: ChangePasswordRequest,
    ctx: AuthContext = Depends(get_auth_context),
    db: AsyncSession = Depends(get_db),
):
    """Schimba parola UTILIZATORULUI logat (nu a contului)."""
    user = ctx.user
    if not verify_password(body.old_password, user.password):
        raise HTTPException(401, "Parola curenta este incorecta.")
    user.password = hash_password(body.new_password)
    user.updated_at = datetime.now(timezone.utc)
    await db.commit()
    # Celelalte sesiuni ale userului devin invalide; pastram sesiunea curenta ca
    # sa nu-l dam afara din aplicatie imediat dupa ce si-a schimbat parola.
    revoked = await revoke_all_sessions(db, user.id, except_jti=ctx.session.jti)
    msg = "Parola a fost schimbata."
    if revoked:
        msg += f" {revoked} sesiune/sesiuni de pe alte dispozitive au fost inchise."
    return MessageResponse(message=msg)


@router.post("/token", response_model=TokenResponse, include_in_schema=False)
@limiter.limit("5/minute")
async def token_oauth2(
    request: Request,
    form: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    """Endpoint OAuth2 folosit de Swagger UI pentru butonul Authorize."""
    token, user, account = await _authenticate(form.username, form.password, db)
    # Rolul real, nu unul presupus: un raspuns care spune mereu "admin" ar face
    # orice client care il foloseste sa deschida UI-ul complet.
    return TokenResponse(
        access_token=token,
        expires_in=TOKEN_EXPIRE_DAYS * 24 * 3600,
        is_locked=account.is_locked,
        locked_at=account.locked_at,
        role=user.role.value,
        resources=allowed_resources(user.role),
        code=account.code,
    )
