from __future__ import annotations
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_account_id
from app.models.employee import Employee
from app.models.location import employee_locations
from app.schemas.employee import EmployeeCreate, EmployeeUpdate, EmployeeRead
from app.schemas.common import Page
from app.utils.filter import apply_filters
from app.utils.storage import upload_image as storage_upload_image, delete_image_by_url
from app.utils.soft_delete import soft_delete
from app.utils.sort import apply_sort

router = APIRouter()


@router.get("", response_model=Page[EmployeeRead])
async def list_employees(
    last_id: int | None = None,
    limit: int = 100,
    q: str | None = None,
    filters: str | None = None,
    sort: str | None = None,
    include_deleted: bool = False,
    location_id: int | None = None,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    limit = min(limit, 200)
    stmt = select(Employee).where(Employee.account_id == account_id)
    if not include_deleted:
        stmt = stmt.where(Employee.is_deleted == False)
    if location_id is not None:
        stmt = stmt.where(
            Employee.id.in_(
                select(employee_locations.c.employee_id).where(
                    employee_locations.c.location_id == location_id
                )
            )
        )
    if last_id is not None:
        stmt = stmt.where(Employee.id > last_id)
    if q:
        stmt = stmt.where(Employee.name.ilike(f"%{q}%"))
    stmt = apply_filters(stmt, Employee, filters)
    stmt = apply_sort(stmt, Employee, sort)
    stmt = stmt.limit(limit + 1)

    rows = (await db.execute(stmt)).scalars().all()
    has_more = len(rows) > limit
    page = rows[:limit]
    return Page(items=page, next_cursor=page[-1].id if has_more else None)


@router.post("", response_model=EmployeeRead, status_code=201)
async def create_employee(
    body: EmployeeCreate,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    employee = Employee(**body.model_dump(), account_id=account_id)
    db.add(employee)
    await db.commit()
    await db.refresh(employee)
    return employee


@router.patch("/{employee_id}", response_model=EmployeeRead)
async def update_employee(
    employee_id: int,
    body: EmployeeUpdate,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    employee = await db.get(Employee, employee_id)
    if employee is None or employee.account_id != account_id or employee.is_deleted:
        raise HTTPException(404, "Angajatul nu a fost găsit.")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(employee, k, v)
    employee.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(employee)
    return employee


@router.post("/{employee_id}/image", response_model=EmployeeRead)
async def upload_image(
    employee_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    employee = await db.get(Employee, employee_id)
    if employee is None or employee.account_id != account_id or employee.is_deleted:
        raise HTTPException(404, "Angajatul nu a fost găsit.")
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(400, "Fisierul trebuie sa fie o imagine.")
    data = await file.read()
    if len(data) > 5 * 1024 * 1024:
        raise HTTPException(400, "Imaginea nu poate depasi 5MB.")
    old_url = employee.image_path
    url = storage_upload_image(account_id, "employees", data, file.content_type)
    employee.image_path = url
    await db.commit()
    await db.refresh(employee)
    if old_url:
        delete_image_by_url(old_url)
    return employee


@router.delete("/{employee_id}", status_code=204)
async def delete_employee(
    employee_id: int,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    employee = await db.get(Employee, employee_id)
    if employee is None or employee.account_id != account_id:
        raise HTTPException(404, "Angajatul nu a fost găsit.")
    await soft_delete(db, Employee, employee_id)
