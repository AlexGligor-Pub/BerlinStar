from __future__ import annotations
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_account_id
from app.models.department import Department
from app.models.category import Category
from app.schemas.department import DepartmentCreate, DepartmentUpdate, DepartmentRead
from app.schemas.category import CategoryRead
from app.schemas.common import Page
from app.utils.filter import apply_filters
from app.utils.soft_delete import soft_delete
from app.utils.sort import apply_sort

router = APIRouter()


@router.get("", response_model=Page[DepartmentRead])
async def list_departments(
    last_id: int | None = None,
    limit: int = 20,
    q: str | None = None,
    filters: str | None = None,
    sort: str | None = None,
    include_deleted: bool = False,
    location_id: int | None = None,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    limit = min(limit, 100)
    stmt = select(Department).where(Department.account_id == account_id)
    if location_id is not None:
        from app.models.location import Location
        stmt = stmt.where(Department.locations.any(Location.id == location_id))
    if not include_deleted:
        stmt = stmt.where(Department.is_deleted == False)
    if last_id is not None:
        stmt = stmt.where(Department.id > last_id)
    if q:
        stmt = stmt.where(Department.name.ilike(f"%{q}%"))
    stmt = apply_filters(stmt, Department, filters)
    stmt = apply_sort(stmt, Department, sort)
    stmt = stmt.limit(limit + 1)

    rows = (await db.execute(stmt)).scalars().all()
    has_more = len(rows) > limit
    page = rows[:limit]
    return Page(items=page, next_cursor=page[-1].id if has_more else None)


@router.post("", response_model=DepartmentRead, status_code=201)
async def create_department(
    body: DepartmentCreate,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    department = Department(**body.model_dump(), account_id=account_id)
    db.add(department)
    await db.commit()
    await db.refresh(department)
    return department


@router.get("/{department_id}", response_model=DepartmentRead)
async def get_department(
    department_id: int,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    department = await db.get(Department, department_id)
    if department is None or department.account_id != account_id:
        raise HTTPException(404, "Departamentul nu a fost găsit.")
    return department


@router.put("/{department_id}", response_model=DepartmentRead)
async def update_department(
    department_id: int,
    body: DepartmentCreate,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    department = await db.get(Department, department_id)
    if department is None or department.is_deleted or department.account_id != account_id:
        raise HTTPException(404, "Departamentul nu a fost găsit.")
    for k, v in body.model_dump().items():
        setattr(department, k, v)
    department.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(department)
    return department


@router.patch("/{department_id}", response_model=DepartmentRead)
async def patch_department(
    department_id: int,
    body: DepartmentUpdate,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    department = await db.get(Department, department_id)
    if department is None or department.is_deleted or department.account_id != account_id:
        raise HTTPException(404, "Departamentul nu a fost găsit.")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(department, k, v)
    department.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(department)
    return department


@router.delete("/{department_id}", status_code=204)
async def delete_department(
    department_id: int,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    department = await db.get(Department, department_id)
    if department is None or department.account_id != account_id:
        raise HTTPException(404, "Departamentul nu a fost găsit.")
    await soft_delete(db, Department, department_id)


@router.get("/{department_id}/categories", response_model=Page[CategoryRead])
async def list_department_categories(
    department_id: int,
    last_id: int | None = None,
    limit: int = 20,
    q: str | None = None,
    filters: str | None = None,
    sort: str | None = None,
    include_deleted: bool = False,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    limit = min(limit, 100)
    stmt = select(Category).where(
        Category.department_id == department_id,
        Category.account_id == account_id,
    )
    if not include_deleted:
        stmt = stmt.where(Category.is_deleted == False)
    if last_id is not None:
        stmt = stmt.where(Category.id > last_id)
    if q:
        stmt = stmt.where(Category.name.ilike(f"%{q}%"))
    stmt = apply_filters(stmt, Category, filters)
    stmt = apply_sort(stmt, Category, sort)
    stmt = stmt.limit(limit + 1)

    rows = (await db.execute(stmt)).scalars().all()
    has_more = len(rows) > limit
    page = rows[:limit]
    return Page(items=page, next_cursor=page[-1].id if has_more else None)
