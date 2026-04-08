from __future__ import annotations
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.account import Account
from app.schemas.account import AccountCreate, AccountUpdate, AccountRead
from app.schemas.common import Page
from app.utils.filter import apply_filters
from app.utils.paginate import paginate
from app.utils.soft_delete import soft_delete
from app.utils.sort import apply_sort

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


@router.post("", response_model=AccountRead, status_code=201)
async def create_account(body: AccountCreate, db: AsyncSession = Depends(get_db)):
    account = Account(**body.model_dump())
    db.add(account)
    await db.commit()
    await db.refresh(account)
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
    for k, v in body.model_dump().items():
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
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(account, k, v)
    account.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(account)
    return account


@router.delete("/{account_id}", status_code=204)
async def delete_account(account_id: int, db: AsyncSession = Depends(get_db)):
    await soft_delete(db, Account, account_id)
