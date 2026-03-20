from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_account_id
from app.models.receipt import Receipt, ReceiptItem
from app.schemas.receipt import ReceiptCreate, ReceiptPatch, ReceiptRead
from app.schemas.common import Page
from app.utils.filter import apply_filters
from app.utils.soft_delete import soft_delete
from app.utils.sort import apply_sort

router = APIRouter()


@router.get("", response_model=Page[ReceiptRead])
async def list_receipts(
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
    stmt = (
        select(Receipt)
        .options(selectinload(Receipt.receipt_items))
        .where(Receipt.account_id == account_id)
    )
    if not include_deleted:
        stmt = stmt.where(Receipt.is_deleted == False)
    if last_id is not None:
        stmt = stmt.where(Receipt.id > last_id)
    if q:
        stmt = stmt.where(Receipt.titlu.ilike(f"%{q}%"))
    stmt = apply_filters(stmt, Receipt, filters)
    stmt = apply_sort(stmt, Receipt, sort)
    stmt = stmt.limit(limit + 1)

    rows = (await db.execute(stmt)).scalars().all()
    has_more = len(rows) > limit
    page = rows[:limit]
    return Page(items=page, next_cursor=page[-1].id if has_more else None)


@router.post("", response_model=ReceiptRead, status_code=201)
async def create_receipt(
    body: ReceiptCreate,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    receipt = Receipt(
        account_id=account_id,
        casier=body.casier,
        titlu=body.titlu,
        descriere=body.descriere,
        date_tehn=body.date_tehn,
        total=body.total,
        pay_method=body.pay_method,
        partial_pay=body.partial_pay,
    )
    db.add(receipt)
    await db.flush()

    for it in body.items:
        db.add(ReceiptItem(
            receipt_id=receipt.id,
            name=it.name,
            price=it.price,
            qty=it.qty,
            unit=it.unit,
        ))

    await db.commit()

    result = (await db.execute(
        select(Receipt)
        .options(selectinload(Receipt.receipt_items))
        .where(Receipt.id == receipt.id)
    )).scalar_one()
    return result


@router.get("/{receipt_id}", response_model=ReceiptRead)
async def get_receipt(
    receipt_id: int,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    receipt = (await db.execute(
        select(Receipt)
        .options(selectinload(Receipt.receipt_items))
        .where(Receipt.id == receipt_id)
    )).scalar_one_or_none()
    if receipt is None or receipt.account_id != account_id:
        raise HTTPException(404, "Bonul nu a fost gasit.")
    return receipt


@router.patch("/{receipt_id}", response_model=ReceiptRead)
async def patch_receipt(
    receipt_id: int,
    body: ReceiptPatch,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    receipt = await db.get(Receipt, receipt_id)
    if receipt is None or receipt.account_id != account_id:
        raise HTTPException(404, "Bonul nu a fost gasit.")
    receipt.pay_method = body.pay_method
    receipt.partial_pay = body.partial_pay
    receipt.updated_at = __import__("datetime").datetime.now(__import__("datetime").timezone.utc)
    await db.commit()
    result = (await db.execute(
        select(Receipt)
        .options(selectinload(Receipt.receipt_items))
        .where(Receipt.id == receipt_id)
    )).scalar_one()
    return result


@router.delete("/{receipt_id}", status_code=204)
async def delete_receipt(
    receipt_id: int,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    receipt = await db.get(Receipt, receipt_id)
    if receipt is None or receipt.account_id != account_id:
        raise HTTPException(404, "Bonul nu a fost gasit.")
    await soft_delete(db, Receipt, receipt_id)
