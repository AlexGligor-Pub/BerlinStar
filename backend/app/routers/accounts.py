from __future__ import annotations
import logging
from datetime import date, datetime, timedelta, timezone
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_platform_admin_account
from app.models.account import Account
from app.models.subscription import AccountSubscription
from app.models.user import User, UserSession
from app.schemas.account import AccountCreate, AccountUpdate, AccountRead
from app.schemas.common import Page
from app.services.account_provisioning import provision_account_admin
from app.utils.filter import apply_filters
from app.utils.paginate import paginate
from app.utils.security import hash_password
from app.utils.soft_delete import soft_delete
from app.utils.sort import apply_sort

log = logging.getLogger("berlinstar")

# Cat tine abonamentul creat automat cand un cont e scos din trial.
SUBSCRIPTION_DAYS = 365


async def _grant_subscription(db: AsyncSession, account: Account) -> None:
    """Da contului un abonament valabil `SUBSCRIPTION_DAYS`, la activare.

    Doua motive:
      * fara rand in `account_subscription`, /api/subscription/me raspunde
        „Abonament neconfigurat" si bannerul ramane pe ecran desi contul e activ;
      * cu un abonament deja expirat, login-ul (`auth._apply_subscription_lock`)
        si jobul de noapte blocheaza contul imediat la loc — activarea ar parea
        ca nu s-a salvat.

    Un abonament inca valabil nu se atinge: data lui vine din plati sau din
    AdminV2 > Abonament > Conturi.
    """
    azi = date.today()
    scadenta = azi + timedelta(days=SUBSCRIPTION_DAYS)
    sub = (await db.execute(
        select(AccountSubscription).where(AccountSubscription.account_id == account.id)
    )).scalar_one_or_none()
    if sub is not None:
        if sub.next_payment_date >= azi:
            return
        sub.next_payment_date = scadenta
        sub.updated_at = datetime.now(timezone.utc)
        log.info("Cont %s activat: abonamentul expirat a fost prelungit pana la %s.", account.id, scadenta)
        return
    try:
        # Randul il pot crea intre timp si plata Stripe, si AdminV2 > Abonament
        # (account_id e unic) — atunci pastram ce a scris celalalt.
        async with db.begin_nested():
            db.add(AccountSubscription(account_id=account.id, next_payment_date=scadenta))
            await db.flush()
    except IntegrityError:
        log.info("Cont %s: abonamentul fusese creat intre timp.", account.id)
        return
    log.info("Cont %s activat: abonament creat pana la %s.", account.id, scadenta)

# ATENTIE: acest router administreaza TENANTII (crearea unei firme noi, datele
# ei, stergerea ei), nu resursele din interiorul unui cont. Apartine exclusiv
# contului de platforma, deci gate-ul e pus pe router, nu endpoint cu endpoint —
# o ruta adaugata pe viitor e protejata din start.
router = APIRouter(dependencies=[Depends(get_platform_admin_account)])


@router.get("", response_model=Page[AccountRead])
async def list_accounts(
    last_id: int | None = None,
    limit: int = 20,
    q: str | None = None,
    filters: str | None = None,
    sort: str | None = None,
    include_deleted: bool = False,
    db: AsyncSession = Depends(get_db),
):
    limit = min(limit, 100)
    stmt = select(Account)
    if not include_deleted:
        stmt = stmt.where(Account.is_deleted == False)
    if last_id is not None:
        stmt = stmt.where(Account.id > last_id)
    if q:
        stmt = stmt.where(Account.name.ilike(f"%{q}%"))
    stmt = apply_filters(stmt, Account, filters)
    stmt = apply_sort(stmt, Account, sort)
    stmt = stmt.limit(limit + 1)
    return await paginate(db, stmt, limit)


async def _send_client_nou(account_name: str, account_email: str, account_id: int) -> None:
    from sqlalchemy import select
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


@router.post("", response_model=AccountRead, status_code=201)
async def create_account(body: AccountCreate, background_tasks: BackgroundTasks, db: AsyncSession = Depends(get_db)):
    data = body.model_dump()
    data["password"] = await hash_password(data["password"])
    account = Account(**data)
    db.add(account)
    await db.flush()
    if not account.is_locked:
        await _grant_subscription(db, account)
    # Fara user admin + cod de firma, contul nou nu s-ar putea autentifica:
    # login-ul cauta in `users`, nu in `accounts`.
    await provision_account_admin(db, account, data["password"], commit=False)
    await db.commit()
    await db.refresh(account)
    if account.email:
        background_tasks.add_task(_send_client_nou, account.name, account.email, account.id)
    return account


@router.get("/{account_id}", response_model=AccountRead)
async def get_account(account_id: int, db: AsyncSession = Depends(get_db)):
    account = await db.get(Account, account_id)
    if account is None:
        raise HTTPException(404, "Contul nu a fost gasit.")
    return account


@router.put("/{account_id}", response_model=AccountRead)
async def update_account(account_id: int, body: AccountCreate, db: AsyncSession = Depends(get_db)):
    account = await db.get(Account, account_id)
    if account is None or account.is_deleted:
        raise HTTPException(404, "Contul nu a fost gasit.")
    data = body.model_dump()
    data["password"] = await hash_password(data["password"])
    for k, v in data.items():
        setattr(account, k, v)
    account.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(account)
    return account


@router.patch("/{account_id}", response_model=AccountRead)
async def patch_account(account_id: int, body: AccountUpdate, db: AsyncSession = Depends(get_db)):
    account = await db.get(Account, account_id)
    if account is None or account.is_deleted:
        raise HTTPException(404, "Contul nu a fost gasit.")
    patch_data = body.model_dump(exclude_unset=True)
    # Parolele utilizatorilor se schimba prin /api/admin/accounts/{id}/users/...;
    # `accounts.password` a rămas doar pentru compatibilitate si nu mai e folosit
    # la autentificare, deci nu il expunem in PATCH.
    if "password" in patch_data:
        if patch_data["password"]:
            patch_data["password"] = await hash_password(patch_data["password"])
        else:
            patch_data.pop("password")
    # Abonamentul se da doar la trecerea din trial in activ, nu la orice salvare
    # a formularului (AdminV2 trimite `is_locked` de fiecare data).
    era_blocat = bool(account.is_locked)
    for k, v in patch_data.items():
        setattr(account, k, v)
    account.updated_at = datetime.now(timezone.utc)
    if era_blocat and patch_data.get("is_locked") is False:
        account.locked_at = None
        await _grant_subscription(db, account)
    await db.commit()
    await db.refresh(account)
    return account


async def _revoke_account_sessions(db: AsyncSession, account_id: int) -> None:
    """Inchide sesiunile deschise ale tuturor utilizatorilor contului. Nu face
    commit: se salveaza odata cu stergerea / restaurarea care o cere.

    Cat contul e sters, token-urile sunt respinse doar fiindca
    `resolve_auth_context` cere `Account.is_deleted == False`; fara revocare,
    restaurarea le-ar readuce la viata pe toate cele neexpirate.
    """
    # Autentificarea leaga sesiunea de cont prin user (`User.account_id`), deci
    # dupa el filtram; `UserSession.account_id` e acoperit doar ca plasa.
    sessions = (await db.execute(
        select(UserSession).where(
            UserSession.revoked_at.is_(None),
            or_(
                UserSession.account_id == account_id,
                UserSession.user_id.in_(select(User.id).where(User.account_id == account_id)),
            ),
        )
    )).scalars().all()
    now = datetime.now(timezone.utc)
    for s in sessions:
        s.revoked_at = now


@router.delete("/{account_id}", status_code=204)
async def delete_account(account_id: int, db: AsyncSession = Depends(get_db)):
    # Verificarea e repetata si in `soft_delete`; aici opreste revocarea
    # sesiunilor pentru un cont care oricum raspunde 404.
    account = await db.get(Account, account_id)
    if account is None or account.is_deleted:
        raise HTTPException(status_code=404, detail="Inregistrarea nu a fost gasita.")
    await _revoke_account_sessions(db, account_id)
    # `soft_delete` face commit-ul, deci revocarea si stergerea intra impreuna.
    await soft_delete(db, Account, account_id)


@router.post("/{account_id}/restore", response_model=AccountRead)
async def restore_account(account_id: int, db: AsyncSession = Depends(get_db)):
    """Inversul stergerii. Stergerea nu blocheaza contul si nu atinge
    utilizatorii sau abonamentul, deci readucem doar `is_deleted` — `is_locked`
    ramane cum l-a lasat adminul. Sesiunile inchise la stergere raman inchise:
    utilizatorii se autentifica din nou."""
    account = await db.get(Account, account_id)
    if account is None:
        raise HTTPException(404, "Contul nu a fost gasit.")
    if not account.is_deleted:
        # Dublu click sau lista veche in browser: contul e deja activ.
        return account
    # Login-ul si inregistrarea cauta contul dupa username/cod doar printre cele
    # nesterse, deci doua conturi active cu acelasi identificator le-ar strica.
    identic = [Account.username == account.username]
    if account.code:
        identic.append(Account.code == account.code)
    conflict = (await db.execute(
        select(Account.id)
        .where(Account.id != account.id, Account.is_deleted == False, or_(*identic))
        .limit(1)
    )).scalar_one_or_none()
    if conflict is not None:
        raise HTTPException(
            409,
            "Username-ul sau codul firmei este folosit intre timp de alt cont. "
            "Modifica-l pe celalalt cont, apoi incearca din nou.",
        )
    # Conturile sterse inainte ca stergerea sa revoce sesiunile le au inca
    # deschise in `user_sessions`; le inchidem aici, in aceeasi tranzactie.
    await _revoke_account_sessions(db, account.id)
    account.is_deleted = False
    account.updated_at = datetime.now(timezone.utc)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(409, "Username-ul sau codul firmei este folosit intre timp de alt cont.")
    await db.refresh(account)
    return account
