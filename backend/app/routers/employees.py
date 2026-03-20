from __future__ import annotations
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_account_id
from app.models.employee import Employee
from app.schemas.employee import EmployeeRead
from app.schemas.common import Page
from app.utils.filter import apply_filters
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
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    limit = min(limit, 200)
    stmt = select(Employee).where(Employee.account_id == account_id)
    if not include_deleted:
        stmt = stmt.where(Employee.is_deleted == False)
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
