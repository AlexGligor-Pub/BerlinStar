from __future__ import annotations
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_account_id
from app.models.programare import Programare, ProgramareStatus
from app.schemas.programare import ProgramareCreate, ProgramarePatch, ProgramareRead
from app.utils.soft_delete import soft_delete

router = APIRouter()


def _serialize(p: Programare) -> ProgramareRead:
    return ProgramareRead(
        id=p.id,
        account_id=p.account_id,
        titlu=p.titlu,
        notite=p.notite,
        client_id=p.client_id,
        client_nume=p.client.nume if p.client else None,
        location_id=p.location_id,
        department_id=p.department_id,
        department_name=p.department.name if p.department else None,
        start_time=p.start_time,
        end_time=p.end_time,
        status=p.status,
        created_at=p.created_at,
        updated_at=p.updated_at,
        is_deleted=p.is_deleted,
        deleted_at=p.deleted_at,
    )


async def _check_overlap(
    db: AsyncSession,
    account_id: int,
    location_id: int,
    start_time: datetime,
    end_time: datetime,
    exclude_id: int | None = None,
) -> None:
    stmt = select(func.count()).where(
        Programare.account_id == account_id,
        Programare.location_id == location_id,
        Programare.is_deleted == False,
        Programare.start_time < end_time,
        Programare.end_time > start_time,
    )
    if exclude_id is not None:
        stmt = stmt.where(Programare.id != exclude_id)
    count = await db.scalar(stmt)
    if count is not None and count >= 3:
        raise HTTPException(400, "Maxim 3 programari simultane permise la aceeasi locatie.")


@router.get("")
async def list_programari(
    location_id: int | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    q: str | None = None,
    department_id: int | None = None,
    status: str | None = None,
    include_deleted: bool = False,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
) -> list[ProgramareRead]:
    stmt = select(Programare).where(Programare.account_id == account_id)
    if not include_deleted:
        stmt = stmt.where(Programare.is_deleted == False)
    if location_id is not None:
        stmt = stmt.where(Programare.location_id == location_id)
    if date_from:
        stmt = stmt.where(Programare.start_time >= date_from)
    if date_to:
        stmt = stmt.where(Programare.start_time <= date_to)
    if department_id is not None:
        stmt = stmt.where(Programare.department_id == department_id)
    if status:
        stmt = stmt.where(Programare.status == status)
    stmt = stmt.order_by(Programare.start_time)

    rows = (await db.execute(stmt)).scalars().all()

    if q:
        q_lower = q.lower()
        rows = [
            p for p in rows
            if q_lower in p.titlu.lower()
            or (p.client and q_lower in p.client.nume.lower())
        ]

    return [_serialize(p) for p in rows]


@router.post("", status_code=201)
async def create_programare(
    body: ProgramareCreate,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
) -> ProgramareRead:
    if body.end_time <= body.start_time:
        raise HTTPException(400, "end_time trebuie sa fie dupa start_time.")
    await _check_overlap(db, account_id, body.location_id, body.start_time, body.end_time)

    p = Programare(**body.model_dump(), account_id=account_id)
    db.add(p)
    await db.flush()
    await db.refresh(p, ["client", "department"])
    await db.commit()
    await db.refresh(p)
    return _serialize(p)


@router.get("/{programare_id}")
async def get_programare(
    programare_id: int,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
) -> ProgramareRead:
    p = await db.get(Programare, programare_id)
    if p is None or p.account_id != account_id or p.is_deleted:
        raise HTTPException(404, "Programarea nu a fost gasita.")
    return _serialize(p)


@router.patch("/{programare_id}")
async def update_programare(
    programare_id: int,
    body: ProgramarePatch,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
) -> ProgramareRead:
    p = await db.get(Programare, programare_id)
    if p is None or p.account_id != account_id or p.is_deleted:
        raise HTTPException(404, "Programarea nu a fost gasita.")

    data = body.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(p, k, v)

    new_start = p.start_time
    new_end   = p.end_time
    if new_end <= new_start:
        raise HTTPException(400, "end_time trebuie sa fie dupa start_time.")

    if "start_time" in data or "end_time" in data:
        await _check_overlap(db, account_id, p.location_id, new_start, new_end, exclude_id=programare_id)

    p.updated_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(p, ["client", "department"])
    await db.commit()
    await db.refresh(p)
    return _serialize(p)


@router.delete("/{programare_id}", status_code=204)
async def delete_programare(
    programare_id: int,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
) -> None:
    p = await db.get(Programare, programare_id)
    if p is None or p.account_id != account_id:
        raise HTTPException(404, "Programarea nu a fost gasita.")
    await soft_delete(db, Programare, programare_id)
