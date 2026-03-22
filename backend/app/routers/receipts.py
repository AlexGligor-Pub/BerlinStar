from __future__ import annotations
import asyncio
import json
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.broadcaster import broadcaster
from app.database import get_db
from app.dependencies import get_account_id, get_account_id_from_query
from app.models.receipt import Receipt, ReceiptItem
from app.schemas.receipt import ReceiptCreate, ReceiptPatch, ReceiptRead, ReceiptItemRead
from app.schemas.common import Page
from app.utils.filter import apply_filters
from app.utils.soft_delete import soft_delete
from app.utils.sort import apply_sort

router = APIRouter()


def _serialize(receipt: Receipt) -> dict:
    data = ReceiptRead.model_validate(receipt).model_dump()
    data["receipt_items"] = [
        ReceiptItemRead.from_orm_item(it).model_dump() for it in receipt.receipt_items
    ]
    return data


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
    limit = min(limit, 1000)
    stmt = (
        select(Receipt)
        .options(selectinload(Receipt.receipt_items).selectinload(ReceiptItem.employee))
        .where(Receipt.account_id == account_id)
    )
    if not include_deleted:
        stmt = stmt.where(Receipt.is_deleted == False)
    if last_id is not None:
        stmt = stmt.where(Receipt.id < last_id)
    if q:
        stmt = stmt.where(Receipt.titlu.ilike(f"%{q}%"))
    stmt = apply_filters(stmt, Receipt, filters)
    stmt = apply_sort(stmt, Receipt, sort)
    stmt = stmt.limit(limit + 1)

    rows = (await db.execute(stmt)).scalars().all()
    has_more = len(rows) > limit
    page = rows[:limit]
    return {"items": [_serialize(r) for r in page], "next_cursor": page[-1].id if has_more else None}


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
            account_id=account_id,
            name=it.name,
            price=it.price,
            qty=it.qty,
            unit=it.unit,
            employee_id=it.employee_id,
        ))

    await db.commit()

    result = (await db.execute(
        select(Receipt)
        .options(selectinload(Receipt.receipt_items).selectinload(ReceiptItem.employee))
        .where(Receipt.id == receipt.id)
    )).scalar_one()

    await broadcaster.notify(account_id)
    return _serialize(result)


# IMPORTANT: /events must be registered before /{receipt_id}
@router.get("/events")
async def receipt_events(
    account_id: int = Depends(get_account_id_from_query),
):
    q = broadcaster.subscribe(account_id)

    async def stream():
        try:
            yield f"data: {json.dumps({'type': 'connected'})}\n\n"
            while True:
                try:
                    event_type = await asyncio.wait_for(q.get(), timeout=30.0)
                    yield f"data: {json.dumps({'type': event_type})}\n\n"
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            broadcaster.unsubscribe(account_id, q)

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/{receipt_id}", response_model=ReceiptRead)
async def get_receipt(
    receipt_id: int,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    receipt = (await db.execute(
        select(Receipt)
        .options(selectinload(Receipt.receipt_items).selectinload(ReceiptItem.employee))
        .where(Receipt.id == receipt_id)
    )).scalar_one_or_none()
    if receipt is None or receipt.account_id != account_id:
        raise HTTPException(404, "Bonul nu a fost gasit.")
    return _serialize(receipt)


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
        .options(selectinload(Receipt.receipt_items).selectinload(ReceiptItem.employee))
        .where(Receipt.id == receipt_id)
    )).scalar_one()

    await broadcaster.notify(account_id)
    return _serialize(result)


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
    await broadcaster.notify(account_id)
