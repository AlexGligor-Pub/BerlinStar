from __future__ import annotations
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
# Nomenclator/configurare: CITIREA ramane deschisa tuturor rolurilor (UI-ul
# operational depinde de ea), dar MODIFICAREA e admin + manager. Vezi
# app/permissions.py pentru matricea completa.
from app.dependencies import get_account_id, get_settings_account_id
from app.models.item import Item, ItemType
from app.models.category import Category
from app.models.department import Department
from app.schemas.item import ItemCreate, ItemUpdate, ItemRead
from app.schemas.common import Page
from app.utils.filter import apply_filters
from app.utils.paginate import paginate
from app.utils.storage import upload_image, delete_image_by_url, validate_image
from app.utils.soft_delete import soft_delete
from app.utils.sort import apply_sort

router = APIRouter()


def _with_category_name(item: Item) -> ItemRead:
    data = ItemRead.model_validate(item)
    data.category_name = item.category.name if item.category else None
    data.department_id = item.category.department_id if item.category else None
    return data


@router.get("", response_model=Page[ItemRead])
async def list_items(
    last_id: int | None = None,
    limit: int = 20,
    q: str | None = None,
    filters: str | None = None,
    sort: str | None = None,
    category_id: int | None = None,
    department_id: int | None = None,
    type: ItemType | None = None,
    include_deleted: bool = False,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    limit = min(limit, 300)
    stmt = (
        select(Item)
        .options(selectinload(Item.category))
        .join(Item.category)
        .join(Category.department)
        .where(Item.account_id == account_id)
    )

    if not include_deleted:
        stmt = stmt.where(
            Item.is_deleted == False,
            Category.is_deleted == False,
            Department.is_deleted == False,
        )
    if last_id is not None:
        stmt = stmt.where(Item.id > last_id)
    if q:
        stmt = stmt.where(Item.name.ilike(f"%{q}%"))
    if category_id is not None:
        stmt = stmt.where(Item.category_id == category_id)
    if department_id is not None:
        stmt = stmt.where(Category.department_id == department_id)
    if type is not None:
        stmt = stmt.where(Item.type == type)

    stmt = apply_filters(stmt, Item, filters)
    stmt = apply_sort(stmt, Item, sort)
    stmt = stmt.limit(limit + 1)
    return await paginate(db, stmt, limit, transform=_with_category_name)


@router.post("", response_model=ItemRead, status_code=201)
async def create_item(
    body: ItemCreate,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_settings_account_id),
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
    account_id: int = Depends(get_settings_account_id),
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
    account_id: int = Depends(get_settings_account_id),
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


@router.post("/{item_id}/image", response_model=ItemRead)
async def upload_item_image(
    item_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_settings_account_id),
):
    item = await db.get(Item, item_id)
    if item is None or item.account_id != account_id or item.is_deleted:
        raise HTTPException(404, "Item-ul nu a fost gasit.")
    data = await validate_image(file)
    old_url = item.image_path
    url = await upload_image(account_id, "items", data, file.content_type)
    item.image_path = url
    await db.commit()
    if old_url:
        await delete_image_by_url(old_url)
    result = await db.execute(
        select(Item).options(selectinload(Item.category)).where(Item.id == item_id)
    )
    return _with_category_name(result.scalar_one())


@router.delete("/{item_id}", status_code=204)
async def delete_item(
    item_id: int,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_settings_account_id),
):
    item = await db.get(Item, item_id)
    if item is None or item.account_id != account_id:
        raise HTTPException(404, "Item-ul nu a fost gasit.")
    await soft_delete(db, Item, item_id)
