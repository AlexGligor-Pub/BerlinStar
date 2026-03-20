from __future__ import annotations
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_account_id
from app.models.item import Item, ItemType
from app.models.category import Category
from app.schemas.item import ItemCreate, ItemUpdate, ItemRead
from app.schemas.common import Page
from app.utils.filter import apply_filters
from app.utils.soft_delete import soft_delete
from app.utils.sort import apply_sort

router = APIRouter()


def _with_category_name(item: Item) -> ItemRead:
    data = ItemRead.model_validate(item)
    data.category_name = item.category.name if item.category else None
    return data


@router.get("", response_model=Page[ItemRead])
async def list_items(
    last_id: int | None = None,
    limit: int = 20,
    q: str | None = None,
    filters: str | None = None,
    sort: str | None = None,
    category_id: int | None = None,
    theme_id: int | None = None,
    type: ItemType | None = None,
    include_deleted: bool = False,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    limit = min(limit, 100)
    stmt = (
        select(Item)
        .options(selectinload(Item.category))
        .join(Item.category)
        .join(Category.theme)
        .where(Item.account_id == account_id)
    )

    if not include_deleted:
        stmt = stmt.where(Item.is_deleted == False)
    if last_id is not None:
        stmt = stmt.where(Item.id > last_id)
    if q:
        stmt = stmt.where(Item.name.ilike(f"%{q}%"))
    if category_id is not None:
        stmt = stmt.where(Item.category_id == category_id)
    if theme_id is not None:
        stmt = stmt.where(Category.theme_id == theme_id)
    if type is not None:
        stmt = stmt.where(Item.type == type)

    stmt = apply_filters(stmt, Item, filters)
    stmt = apply_sort(stmt, Item, sort)
    stmt = stmt.limit(limit + 1)

    rows = (await db.execute(stmt)).scalars().all()
    has_more = len(rows) > limit
    page = rows[:limit]
    return Page(
        items=[_with_category_name(i) for i in page],
        next_cursor=page[-1].id if has_more else None,
    )


@router.post("", response_model=ItemRead, status_code=201)
async def create_item(
    body: ItemCreate,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    item = Item(**body.model_dump(), account_id=account_id)
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


@router.get("/{item_id}", response_model=ItemRead)
async def get_item(
    item_id: int,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    item = await db.get(Item, item_id)
    if item is None or item.account_id != account_id:
        raise HTTPException(404, "Item-ul nu a fost gasit.")
    return item


@router.put("/{item_id}", response_model=ItemRead)
async def update_item(
    item_id: int,
    body: ItemCreate,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    item = await db.get(Item, item_id)
    if item is None or item.is_deleted or item.account_id != account_id:
        raise HTTPException(404, "Item-ul nu a fost gasit.")
    for k, v in body.model_dump().items():
        setattr(item, k, v)
    item.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(item)
    return item


@router.patch("/{item_id}", response_model=ItemRead)
async def patch_item(
    item_id: int,
    body: ItemUpdate,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    item = await db.get(Item, item_id)
    if item is None or item.is_deleted or item.account_id != account_id:
        raise HTTPException(404, "Item-ul nu a fost gasit.")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(item, k, v)
    item.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(item)
    return item


@router.delete("/{item_id}", status_code=204)
async def delete_item(
    item_id: int,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    item = await db.get(Item, item_id)
    if item is None or item.account_id != account_id:
        raise HTTPException(404, "Item-ul nu a fost gasit.")
    await soft_delete(db, Item, item_id)
