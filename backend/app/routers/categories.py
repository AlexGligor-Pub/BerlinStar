from __future__ import annotations
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_account_id
from app.models.category import Category
from app.schemas.category import CategoryCreate, CategoryUpdate, CategoryRead
from app.schemas.common import Page
from app.utils.filter import apply_filters
from app.utils.soft_delete import soft_delete
from app.utils.sort import apply_sort

router = APIRouter()


@router.get("", response_model=Page[CategoryRead])
async def list_categories(
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
    stmt = select(Category).where(Category.account_id == account_id)
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


@router.post("", response_model=CategoryRead, status_code=201)
async def create_category(
    body: CategoryCreate,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    category = Category(**body.model_dump(), account_id=account_id)
    db.add(category)
    await db.commit()
    await db.refresh(category)
    return category


@router.get("/{category_id}", response_model=CategoryRead)
async def get_category(
    category_id: int,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    cat = await db.get(Category, category_id)
    if cat is None or cat.account_id != account_id:
        raise HTTPException(404, "Categoria nu a fost gasita.")
    return cat


@router.put("/{category_id}", response_model=CategoryRead)
async def update_category(
    category_id: int,
    body: CategoryCreate,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    cat = await db.get(Category, category_id)
    if cat is None or cat.is_deleted or cat.account_id != account_id:
        raise HTTPException(404, "Categoria nu a fost gasita.")
    for k, v in body.model_dump().items():
        setattr(cat, k, v)
    cat.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(cat)
    return cat


@router.patch("/{category_id}", response_model=CategoryRead)
async def patch_category(
    category_id: int,
    body: CategoryUpdate,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    cat = await db.get(Category, category_id)
    if cat is None or cat.is_deleted or cat.account_id != account_id:
        raise HTTPException(404, "Categoria nu a fost gasita.")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(cat, k, v)
    cat.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(cat)
    return cat


@router.delete("/{category_id}", status_code=204)
async def delete_category(
    category_id: int,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    cat = await db.get(Category, category_id)
    if cat is None or cat.account_id != account_id:
        raise HTTPException(404, "Categoria nu a fost gasita.")
    await soft_delete(db, Category, category_id)
