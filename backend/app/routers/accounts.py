from __future__ import annotations
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.account import Account
from app.schemas.account import AccountCreate, AccountUpdate, AccountRead
from app.schemas.common import Page
from app.utils.filter import apply_filters
from app.utils.paginate import paginate
from app.utils.security import hash_password
from app.utils.soft_delete import soft_delete
from app.utils.sort import apply_sort

log = logging.getLogger("berlinstar")

router = APIRouter()


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
    data["password"] = hash_password(data["password"])
    account = Account(**data)
    db.add(account)
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
    data["password"] = hash_password(data["password"])
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
    for pwd_field in ("password", "reports_password"):
        if pwd_field in patch_data:
            if patch_data[pwd_field]:
                patch_data[pwd_field] = hash_password(patch_data[pwd_field])
            else:
                patch_data.pop(pwd_field)
    for k, v in patch_data.items():
        setattr(account, k, v)
    account.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(account)
    return account


@router.delete("/{account_id}", status_code=204)
async def delete_account(account_id: int, db: AsyncSession = Depends(get_db)):
    await soft_delete(db, Account, account_id)
