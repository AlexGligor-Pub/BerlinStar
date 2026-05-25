from __future__ import annotations
from datetime import date, datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, or_
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_account_id
from app.models.employee import Employee
from app.models.leave import Leave, LeaveType, LeaveStatus
from app.schemas.leave import (
    LeaveCreate, LeavePatch, LeaveRead, LeaveBalance, LeaveTypeBreakdown, RomanianHoliday,
)
from app.utils.romanian_holidays import count_working_days, get_romanian_holidays
from app.utils.soft_delete import soft_delete

router = APIRouter()


def _with_relations():
    return [
        selectinload(Leave.employee).selectinload(Employee.locations),
        selectinload(Leave.location),
        selectinload(Leave.approver),
    ]


def _serialize(l: Leave) -> LeaveRead:
    # Fallback la prima locatie a angajatului daca leave-ul nu are una proprie.
    effective_loc_id = l.location_id
    effective_loc_name = l.location.name if l.location else None
    if effective_loc_id is None and l.employee and l.employee.locations:
        first_loc = l.employee.locations[0]
        effective_loc_id = first_loc.id
        effective_loc_name = first_loc.name

    return LeaveRead(
        id=l.id,
        account_id=l.account_id,
        employee_id=l.employee_id,
        employee_name=l.employee.name if l.employee else None,
        employee_image_path=l.employee.image_path if l.employee else None,
        location_id=effective_loc_id,
        location_name=effective_loc_name,
        type=l.type,
        status=l.status,
        start_date=l.start_date,
        end_date=l.end_date,
        working_days=l.working_days,
        notes=l.notes,
        approved_by=l.approved_by,
        approver_name=l.approver.name if l.approver else None,
        approved_at=l.approved_at,
        created_at=l.created_at,
        updated_at=l.updated_at,
        is_deleted=l.is_deleted,
        deleted_at=l.deleted_at,
    )


async def _load(db: AsyncSession, leave_id: int) -> Leave | None:
    stmt = select(Leave).where(Leave.id == leave_id).options(*_with_relations())
    return (await db.execute(stmt)).scalar_one_or_none()


async def _check_vacation_balance(
    db: AsyncSession,
    account_id: int,
    employee: Employee,
    start: date,
    end: date,
    working_days: int,
    exclude_leave_id: int | None = None,
) -> None:
    """Pentru cereri de tip VACATION, verifica daca totalul (existente + cererea curenta)
    nu depaseste cota anuala a angajatului. Calculul foloseste anul `start.year`."""
    year = start.year
    year_start = date(year, 1, 1)
    year_end   = date(year, 12, 31)
    stmt = select(Leave).where(
        Leave.account_id == account_id,
        Leave.employee_id == employee.id,
        Leave.type == LeaveType.VACATION,
        Leave.is_deleted == False,
        Leave.status.in_([LeaveStatus.APPROVED, LeaveStatus.PENDING]),
        Leave.start_date <= year_end,
        Leave.end_date >= year_start,
    )
    if exclude_leave_id is not None:
        stmt = stmt.where(Leave.id != exclude_leave_id)
    rows = (await db.execute(stmt)).scalars().all()
    used = 0
    for r in rows:
        clipped_start = max(r.start_date, year_start)
        clipped_end   = min(r.end_date, year_end)
        used += count_working_days(clipped_start, clipped_end)
    if used + working_days > employee.annual_vacation_days:
        remaining = max(0, employee.annual_vacation_days - used)
        raise HTTPException(
            400,
            f"Cererea depaseste soldul anual de concediu. "
            f"Angajatul are {employee.annual_vacation_days} zile/an, "
            f"deja folosite/in asteptare: {used}, disponibile: {remaining}, "
            f"cerute: {working_days}.",
        )


async def _validate_employee(db: AsyncSession, account_id: int, employee_id: int) -> Employee:
    emp = (await db.execute(
        select(Employee)
        .where(
            Employee.id == employee_id,
            Employee.account_id == account_id,
            Employee.is_deleted == False,
        )
        .options(selectinload(Employee.locations))
    )).scalar_one_or_none()
    if emp is None:
        raise HTTPException(404, "Angajatul nu a fost gasit.")
    return emp


@router.get("/holidays", response_model=list[RomanianHoliday])
async def list_holidays(
    year: int = Query(..., ge=1900, le=2200),
    _account_id: int = Depends(get_account_id),
) -> list[RomanianHoliday]:
    items = get_romanian_holidays(year)
    return [RomanianHoliday(date=d, name=name) for d, name in sorted(items.items())]


@router.get("/balance/{employee_id}", response_model=LeaveBalance)
async def get_balance(
    employee_id: int,
    year: int = Query(..., ge=1900, le=2200),
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
) -> LeaveBalance:
    emp = await _validate_employee(db, account_id, employee_id)

    year_start = date(year, 1, 1)
    year_end   = date(year, 12, 31)

    rows = (await db.execute(
        select(Leave).where(
            Leave.account_id == account_id,
            Leave.employee_id == employee_id,
            Leave.is_deleted == False,
            Leave.start_date <= year_end,
            Leave.end_date >= year_start,
            Leave.status.in_([LeaveStatus.APPROVED, LeaveStatus.PENDING]),
        )
    )).scalars().all()

    used_by_type: dict[LeaveType, int] = {t: 0 for t in LeaveType}
    pending_by_type: dict[LeaveType, int] = {t: 0 for t in LeaveType}

    for r in rows:
        clipped_start = max(r.start_date, year_start)
        clipped_end   = min(r.end_date, year_end)
        days = count_working_days(clipped_start, clipped_end)
        if r.status == LeaveStatus.APPROVED:
            used_by_type[r.type] += days
        else:
            pending_by_type[r.type] += days

    breakdown = [
        LeaveTypeBreakdown(type=t, used_days=used_by_type[t], pending_days=pending_by_type[t])
        for t in LeaveType
    ]

    used_vac = used_by_type[LeaveType.VACATION]
    pending_vac = pending_by_type[LeaveType.VACATION]

    return LeaveBalance(
        employee_id=emp.id,
        employee_name=emp.name,
        year=year,
        annual_allowance=emp.annual_vacation_days,
        used_vacation_days=used_vac,
        pending_vacation_days=pending_vac,
        remaining_vacation_days=max(0, emp.annual_vacation_days - used_vac),
        breakdown=breakdown,
    )


@router.get("", response_model=list[LeaveRead])
async def list_leaves(
    location_id: int | None = None,
    employee_id: int | None = None,
    type: LeaveType | None = None,
    status: LeaveStatus | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    q: str | None = None,
    include_deleted: bool = False,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
) -> list[LeaveRead]:
    stmt = (
        select(Leave)
        .where(Leave.account_id == account_id)
        .options(*_with_relations())
    )
    if not include_deleted:
        stmt = stmt.where(Leave.is_deleted == False)
    if location_id is not None:
        stmt = stmt.where(Leave.location_id == location_id)
    if employee_id is not None:
        stmt = stmt.where(Leave.employee_id == employee_id)
    if type is not None:
        stmt = stmt.where(Leave.type == type)
    if status is not None:
        stmt = stmt.where(Leave.status == status)
    # Range overlap: leave intersects [date_from, date_to]
    if date_from:
        stmt = stmt.where(Leave.end_date >= date_from)
    if date_to:
        stmt = stmt.where(Leave.start_date <= date_to)
    if q:
        pattern = f"%{q}%"
        stmt = stmt.where(
            or_(
                Leave.notes.ilike(pattern),
                Leave.employee.has(Employee.name.ilike(pattern)),
            )
        )
    stmt = stmt.order_by(Leave.start_date)

    rows = list((await db.execute(stmt)).scalars().all())
    return [_serialize(l) for l in rows]


@router.post("", status_code=201, response_model=LeaveRead)
async def create_leave(
    body: LeaveCreate,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
) -> LeaveRead:
    if body.end_date < body.start_date:
        raise HTTPException(400, "end_date trebuie sa fie >= start_date.")
    emp = await _validate_employee(db, account_id, body.employee_id)

    working_days = count_working_days(body.start_date, body.end_date)

    if body.type == LeaveType.VACATION:
        await _check_vacation_balance(db, account_id, emp, body.start_date, body.end_date, working_days)

    location_id = body.location_id
    if location_id is None and emp.locations:
        location_id = emp.locations[0].id

    l = Leave(
        account_id=account_id,
        employee_id=body.employee_id,
        location_id=location_id,
        type=body.type,
        status=LeaveStatus.PENDING,
        start_date=body.start_date,
        end_date=body.end_date,
        working_days=working_days,
        notes=body.notes,
    )
    db.add(l)
    await db.commit()
    await db.refresh(l)
    loaded = await _load(db, l.id)
    if loaded is None:
        raise HTTPException(500, "Eroare la creare cerere.")
    return _serialize(loaded)


@router.get("/{leave_id}", response_model=LeaveRead)
async def get_leave(
    leave_id: int,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
) -> LeaveRead:
    l = await _load(db, leave_id)
    if l is None or l.account_id != account_id or l.is_deleted:
        raise HTTPException(404, "Cererea nu a fost gasita.")
    return _serialize(l)


@router.patch("/{leave_id}", response_model=LeaveRead)
async def update_leave(
    leave_id: int,
    body: LeavePatch,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
) -> LeaveRead:
    l = await db.get(Leave, leave_id)
    if l is None or l.account_id != account_id or l.is_deleted:
        raise HTTPException(404, "Cererea nu a fost gasita.")

    data = body.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(l, k, v)

    if l.end_date < l.start_date:
        raise HTTPException(400, "end_date trebuie sa fie >= start_date.")

    if "start_date" in data or "end_date" in data:
        l.working_days = count_working_days(l.start_date, l.end_date)

    if l.type == LeaveType.VACATION:
        emp = await _validate_employee(db, account_id, l.employee_id)
        await _check_vacation_balance(
            db, account_id, emp, l.start_date, l.end_date, l.working_days,
            exclude_leave_id=l.id,
        )

    l.updated_at = datetime.now(timezone.utc)
    await db.commit()
    loaded = await _load(db, l.id)
    if loaded is None:
        raise HTTPException(500, "Eroare la actualizare cerere.")
    return _serialize(loaded)


@router.delete("/{leave_id}", status_code=204)
async def delete_leave(
    leave_id: int,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
) -> None:
    l = await db.get(Leave, leave_id)
    if l is None or l.account_id != account_id:
        raise HTTPException(404, "Cererea nu a fost gasita.")
    await soft_delete(db, Leave, leave_id)


@router.post("/{leave_id}/approve", response_model=LeaveRead)
async def approve_leave(
    leave_id: int,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
) -> LeaveRead:
    l = await db.get(Leave, leave_id)
    if l is None or l.account_id != account_id or l.is_deleted:
        raise HTTPException(404, "Cererea nu a fost gasita.")
    l.status = LeaveStatus.APPROVED
    l.approved_by = account_id
    l.approved_at = datetime.now(timezone.utc)
    l.updated_at = datetime.now(timezone.utc)
    await db.commit()
    loaded = await _load(db, l.id)
    if loaded is None:
        raise HTTPException(500, "Eroare la aprobare cerere.")
    return _serialize(loaded)


@router.post("/{leave_id}/reset", response_model=LeaveRead)
async def reset_leave(
    leave_id: int,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
) -> LeaveRead:
    l = await db.get(Leave, leave_id)
    if l is None or l.account_id != account_id or l.is_deleted:
        raise HTTPException(404, "Cererea nu a fost gasita.")
    l.status = LeaveStatus.PENDING
    l.approved_by = None
    l.approved_at = None
    l.updated_at = datetime.now(timezone.utc)
    await db.commit()
    loaded = await _load(db, l.id)
    if loaded is None:
        raise HTTPException(500, "Eroare la resetare cerere.")
    return _serialize(loaded)


@router.post("/{leave_id}/reject", response_model=LeaveRead)
async def reject_leave(
    leave_id: int,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
) -> LeaveRead:
    l = await db.get(Leave, leave_id)
    if l is None or l.account_id != account_id or l.is_deleted:
        raise HTTPException(404, "Cererea nu a fost gasita.")
    l.status = LeaveStatus.REJECTED
    l.approved_by = account_id
    l.approved_at = datetime.now(timezone.utc)
    l.updated_at = datetime.now(timezone.utc)
    await db.commit()
    loaded = await _load(db, l.id)
    if loaded is None:
        raise HTTPException(500, "Eroare la respingere cerere.")
    return _serialize(loaded)
