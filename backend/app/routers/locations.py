from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_account_id
from app.models.location import Location
from app.schemas.location import LocationCreate, LocationRead
from app.schemas.common import Page
from app.utils.soft_delete import soft_delete

router = APIRouter()


@router.get("", response_model=Page[LocationRead])
async def list_locations(
    last_id: int | None = None,
    limit: int = 100,
    q: str | None = None,
    include_deleted: bool = False,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    limit = min(limit, 200)
    stmt = select(Location).where(Location.account_id == account_id)
    if not include_deleted:
        stmt = stmt.where(Location.is_deleted == False)
    if last_id is not None:
        stmt = stmt.where(Location.id > last_id)
    if q:
        stmt = stmt.where(Location.name.ilike(f"%{q}%"))
    stmt = stmt.order_by(Location.id).limit(limit + 1)

    rows = (await db.execute(stmt)).scalars().all()
    has_more = len(rows) > limit
    page = rows[:limit]
    return Page(items=page, next_cursor=page[-1].id if has_more else None)


@router.post("", response_model=LocationRead, status_code=201)
async def create_location(
    body: LocationCreate,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    location = Location(
        name=body.name,
        description=body.description,
        account_id=account_id,
    )
    db.add(location)
    await db.commit()
    await db.refresh(location)
    return location


@router.delete("/{location_id}", status_code=204)
async def delete_location(
    location_id: int,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    location = await db.get(Location, location_id)
    if location is None or location.account_id != account_id:
        raise HTTPException(404, "Locația nu a fost găsită.")
    await soft_delete(db, Location, location_id)
