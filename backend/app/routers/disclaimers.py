from __future__ import annotations
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_account_id
from app.models.disclaimer import Disclaimer
from app.schemas.disclaimer import DisclaimerCreate, DisclaimerUpdate, DisclaimerRead
from app.schemas.common import Page
from app.utils.soft_delete import soft_delete

router = APIRouter()


@router.get("", response_model=Page[DisclaimerRead])
async def list_disclaimers(
    last_id: int | None = None,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    limit = min(limit, 100)
    stmt = (
        select(Disclaimer)
        .where(Disclaimer.account_id == account_id, Disclaimer.is_deleted == False)
        .order_by(Disclaimer.id)
    )
    if last_id is not None:
        stmt = stmt.where(Disclaimer.id > last_id)
    stmt = stmt.limit(limit + 1)

    rows = (await db.execute(stmt)).scalars().all()
    has_more = len(rows) > limit
    page = rows[:limit]
    return Page(items=page, next_cursor=page[-1].id if has_more else None)


@router.post("", response_model=DisclaimerRead, status_code=201)
async def create_disclaimer(
    body: DisclaimerCreate,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    d = Disclaimer(text=body.text, account_id=account_id)
    db.add(d)
    await db.commit()
    await db.refresh(d)
    return d


@router.get("/{disclaimer_id}", response_model=DisclaimerRead)
async def get_disclaimer(
    disclaimer_id: int,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    d = await db.get(Disclaimer, disclaimer_id)
    if d is None or d.account_id != account_id or d.is_deleted:
        raise HTTPException(404, "Disclaimer-ul nu a fost găsit.")
    return d


@router.patch("/{disclaimer_id}", response_model=DisclaimerRead)
async def patch_disclaimer(
    disclaimer_id: int,
    body: DisclaimerUpdate,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    d = await db.get(Disclaimer, disclaimer_id)
    if d is None or d.account_id != account_id or d.is_deleted:
        raise HTTPException(404, "Disclaimer-ul nu a fost găsit.")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(d, k, v)
    d.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(d)
    return d


@router.delete("/{disclaimer_id}", status_code=204)
async def delete_disclaimer(
    disclaimer_id: int,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    d = await db.get(Disclaimer, disclaimer_id)
    if d is None or d.account_id != account_id:
        raise HTTPException(404, "Disclaimer-ul nu a fost găsit.")
    await soft_delete(db, Disclaimer, disclaimer_id)
