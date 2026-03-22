from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_account_id
from app.models.device import Device
from app.schemas.device import DeviceCreate, DeviceRead
from app.schemas.common import Page

router = APIRouter()


@router.get("", response_model=Page[DeviceRead])
async def list_devices(
    last_id: int | None = None,
    limit: int = 100,
    q: str | None = None,
    location_id: int | None = None,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    limit = min(limit, 200)
    stmt = select(Device).where(Device.account_id == account_id)
    if last_id is not None:
        stmt = stmt.where(Device.id > last_id)
    if q:
        stmt = stmt.where(Device.name.ilike(f"%{q}%"))
    if location_id is not None:
        stmt = stmt.where(Device.location_id == location_id)
    stmt = stmt.order_by(Device.id).limit(limit + 1)

    rows = (await db.execute(stmt)).scalars().all()
    has_more = len(rows) > limit
    page = rows[:limit]
    return Page(items=page, next_cursor=page[-1].id if has_more else None)


@router.post("", response_model=DeviceRead, status_code=201)
async def create_device(
    body: DeviceCreate,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    device = Device(
        name=body.name,
        account_id=account_id,
        location_id=body.location_id,
    )
    db.add(device)
    await db.commit()
    await db.refresh(device)
    return device


@router.get("/{device_id}", response_model=DeviceRead)
async def get_device(
    device_id: int,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    device = await db.get(Device, device_id)
    if device is None or device.account_id != account_id:
        raise HTTPException(404, "Dispozitivul nu a fost găsit.")
    return device


@router.patch("/{device_id}", response_model=DeviceRead)
async def update_device(
    device_id: int,
    body: DeviceCreate,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    device = await db.get(Device, device_id)
    if device is None or device.account_id != account_id:
        raise HTTPException(404, "Dispozitivul nu a fost găsit.")
    device.name = body.name
    device.location_id = body.location_id
    await db.commit()
    await db.refresh(device)
    return device


@router.delete("/{device_id}", status_code=204)
async def delete_device(
    device_id: int,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    device = await db.get(Device, device_id)
    if device is None or device.account_id != account_id:
        raise HTTPException(404, "Dispozitivul nu a fost găsit.")
    await db.delete(device)
    await db.commit()
