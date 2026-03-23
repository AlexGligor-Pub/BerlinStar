from __future__ import annotations
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_account_id
from app.models.loc_cazare import LocCazare
from app.schemas.loc_cazare import LocCazareCreate, LocCazareRead
from app.schemas.common import Page
from app.utils.soft_delete import soft_delete

router = APIRouter()


@router.get("", response_model=Page[LocCazareRead])
async def list_locuri(
    last_id: int | None = None,
    limit: int = 200,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    limit = min(limit, 500)
    stmt = select(LocCazare).where(
        LocCazare.account_id == account_id, LocCazare.is_deleted == False
    )
    if last_id is not None:
        stmt = stmt.where(LocCazare.id > last_id)
    stmt = stmt.order_by(LocCazare.nume, LocCazare.id).limit(limit + 1)
    rows = (await db.execute(stmt)).scalars().all()
    has_more = len(rows) > limit
    page = rows[:limit]
    return Page(items=page, next_cursor=page[-1].id if has_more else None)


@router.post("", response_model=LocCazareRead, status_code=201)
async def create_loc(
    body: LocCazareCreate,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    loc = LocCazare(**body.model_dump(), account_id=account_id)
    db.add(loc)
    await db.commit()
    await db.refresh(loc)
    return loc


@router.patch("/{loc_id}", response_model=LocCazareRead)
async def update_loc(
    loc_id: int,
    body: LocCazareCreate,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    loc = await db.get(LocCazare, loc_id)
    if loc is None or loc.account_id != account_id or loc.is_deleted:
        raise HTTPException(404, "Locul de cazare nu a fost găsit.")
    for k, v in body.model_dump().items():
        setattr(loc, k, v)
    loc.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(loc)
    return loc


@router.delete("/{loc_id}", status_code=204)
async def delete_loc(
    loc_id: int,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    loc = await db.get(LocCazare, loc_id)
    if loc is None or loc.account_id != account_id:
        raise HTTPException(404, "Locul de cazare nu a fost găsit.")
    await soft_delete(db, LocCazare, loc_id)
