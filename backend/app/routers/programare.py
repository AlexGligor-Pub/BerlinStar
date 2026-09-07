from __future__ import annotations
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, or_
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_account_id, get_settings_account_id
from app.models.client import Client
from app.models.employee import Employee
from app.models.programare import Programare, ProgramareStatus
from app.schemas.programare import ProgramareCreate, ProgramarePatch, ProgramareRead
from app.utils.soft_delete import soft_delete

router = APIRouter()


def _with_relations():
    return [selectinload(Programare.client), selectinload(Programare.department), selectinload(Programare.employee)]


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
        employee_id=p.employee_id,
        employee_name=p.employee.name if p.employee else None,
        start_time=p.start_time,
        end_time=p.end_time,
        status=p.status,
        created_at=p.created_at,
        updated_at=p.updated_at,
        is_deleted=p.is_deleted,
        deleted_at=p.deleted_at,
    )


async def _load(db: AsyncSession, programare_id: int) -> Programare | None:
    stmt = (
        select(Programare)
        .where(Programare.id == programare_id)
        .options(*_with_relations())
    )
    return (await db.execute(stmt)).scalar_one_or_none()


async def _validate_employee(db: AsyncSession, account_id: int, employee_id: int | None) -> None:
    if employee_id is None:
        return
    stmt = select(Employee.id).where(
        Employee.id == employee_id,
        Employee.account_id == account_id,
        Employee.is_deleted == False,
    )
    if (await db.scalar(stmt)) is None:
        raise HTTPException(400, "Angajatul nu exista.")


@router.get("")
async def list_programari(
    location_id: int | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    q: str | None = None,
    department_id: int | None = None,
    employee_id: int | None = None,
    status: str | None = None,
    include_deleted: bool = False,
    limit: int = Query(200, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
) -> list[ProgramareRead]:
    stmt = (
        select(Programare)
        .where(Programare.account_id == account_id)
        .options(*_with_relations())
    )
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
    if employee_id is not None:
        stmt = stmt.where(Programare.employee_id == employee_id)
    if status:
        stmt = stmt.where(Programare.status == status)
    if q:
        pattern = f"%{q}%"
        stmt = stmt.where(
            or_(
                Programare.titlu.ilike(pattern),
                Programare.client.has(Client.nume.ilike(pattern)),
            )
        )
    stmt = stmt.order_by(Programare.start_time, Programare.id).limit(limit).offset(offset)

    rows = list((await db.execute(stmt)).scalars().all())
    return [_serialize(p) for p in rows]


@router.post("", status_code=201)
async def create_programare(
    body: ProgramareCreate,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
) -> ProgramareRead:
    if body.end_time <= body.start_time:
        raise HTTPException(400, "end_time trebuie sa fie dupa start_time.")
    await _validate_employee(db, account_id, body.employee_id)

    p = Programare(**body.model_dump(), account_id=account_id)
    db.add(p)
    await db.commit()
    await db.refresh(p)
    loaded = await _load(db, p.id)
    if loaded is None:
        raise HTTPException(500, "Eroare la creare programare.")
    return _serialize(loaded)


@router.get("/{programare_id}")
async def get_programare(
    programare_id: int,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
) -> ProgramareRead:
    p = await _load(db, programare_id)
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
    await _validate_employee(db, account_id, data.get("employee_id"))
    for k, v in data.items():
        setattr(p, k, v)

    if p.end_time <= p.start_time:
        raise HTTPException(400, "end_time trebuie sa fie dupa start_time.")

    p.updated_at = datetime.now(timezone.utc)
    await db.commit()
    loaded = await _load(db, p.id)
    if loaded is None:
        raise HTTPException(500, "Eroare la actualizare programare.")
    return _serialize(loaded)


@router.delete("/{programare_id}", status_code=204)
async def delete_programare(
    programare_id: int,
    db: AsyncSession = Depends(get_db),
    # Stergerea e actiune privilegiata (admin + manager): butonul e ascuns
    # pentru `worker` in UI, iar aici o refuzam si pe server.
    account_id: int = Depends(get_settings_account_id),
) -> None:
    p = await db.get(Programare, programare_id)
    if p is None or p.account_id != account_id:
        raise HTTPException(404, "Programarea nu a fost gasita.")
    await soft_delete(db, Programare, programare_id)
