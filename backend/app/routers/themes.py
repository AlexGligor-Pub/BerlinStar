from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_account_id
from app.models.theme import Theme
from app.models.category import Category
from app.schemas.theme import ThemeCreate, ThemeUpdate, ThemeRead
from app.schemas.category import CategoryRead
from app.schemas.common import Page
from app.utils.filter import apply_filters
from app.utils.soft_delete import soft_delete
from app.utils.sort import apply_sort

router = APIRouter()


@router.get("", response_model=Page[ThemeRead])
async def list_themes(
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
    stmt = select(Theme).where(Theme.account_id == account_id)
    if not include_deleted:
        stmt = stmt.where(Theme.is_deleted == False)
    if last_id is not None:
        stmt = stmt.where(Theme.id > last_id)
    if q:
        stmt = stmt.where(Theme.name.ilike(f"%{q}%"))
    stmt = apply_filters(stmt, Theme, filters)
    stmt = apply_sort(stmt, Theme, sort)
    stmt = stmt.limit(limit + 1)

    rows = (await db.execute(stmt)).scalars().all()
    has_more = len(rows) > limit
    page = rows[:limit]
    return Page(items=page, next_cursor=page[-1].id if has_more else None)


@router.post("", response_model=ThemeRead, status_code=201)
async def create_theme(
    body: ThemeCreate,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    theme = Theme(**body.model_dump(), account_id=account_id)
    db.add(theme)
    await db.commit()
    await db.refresh(theme)
    return theme


@router.get("/{theme_id}", response_model=ThemeRead)
async def get_theme(
    theme_id: int,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    theme = await db.get(Theme, theme_id)
    if theme is None or theme.account_id != account_id:
        raise HTTPException(404, "Theme negasit.")
    return theme


@router.put("/{theme_id}", response_model=ThemeRead)
async def update_theme(
    theme_id: int,
    body: ThemeCreate,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    theme = await db.get(Theme, theme_id)
    if theme is None or theme.is_deleted or theme.account_id != account_id:
        raise HTTPException(404, "Theme negasit.")
    for k, v in body.model_dump().items():
        setattr(theme, k, v)
    await db.commit()
    await db.refresh(theme)
    return theme


@router.patch("/{theme_id}", response_model=ThemeRead)
async def patch_theme(
    theme_id: int,
    body: ThemeUpdate,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    theme = await db.get(Theme, theme_id)
    if theme is None or theme.is_deleted or theme.account_id != account_id:
        raise HTTPException(404, "Theme negasit.")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(theme, k, v)
    await db.commit()
    await db.refresh(theme)
    return theme


@router.delete("/{theme_id}", status_code=204)
async def delete_theme(
    theme_id: int,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    theme = await db.get(Theme, theme_id)
    if theme is None or theme.account_id != account_id:
        raise HTTPException(404, "Theme negasit.")
    await soft_delete(db, Theme, theme_id)


@router.get("/{theme_id}/categories", response_model=Page[CategoryRead])
async def list_theme_categories(
    theme_id: int,
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
        Category.theme_id == theme_id,
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
