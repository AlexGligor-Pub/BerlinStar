from __future__ import annotations
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.item import Item, ItemType
from app.models.receipt import Receipt, ReceiptItem
from app.models.stock import Stock
from app.models.stock_movement import StockMovement, StockMovementType


@dataclass
class ReceiptLineForStock:
    item_id: int
    item_name: str
    qty: int
    unit_price: Decimal
    employee_id: int | None


async def _get_or_create_stock(
    db: AsyncSession, account_id: int, item_id: int, location_id: int
) -> Stock:
    row = (await db.execute(
        select(Stock).where(Stock.item_id == item_id, Stock.location_id == location_id)
    )).scalar_one_or_none()
    if row is None:
        row = Stock(account_id=account_id, item_id=item_id, location_id=location_id, qty=0)
        db.add(row)
        await db.flush()
    return row


async def _movement(
    db: AsyncSession,
    *,
    account_id: int,
    item_id: int | None,
    item_name: str,
    location_id: int | None,
    employee_id: int | None,
    receipt_id: int | None,
    movement_type: StockMovementType,
    qty_delta: int,
    unit_cost: Decimal | None,
    unit_price: Decimal | None,
    note: str | None,
    created_by_user: str | None = None,
) -> None:
    mv = StockMovement(
        account_id=account_id,
        item_id=item_id,
        item_name=item_name,
        location_id=location_id,
        employee_id=employee_id,
        receipt_id=receipt_id,
        movement_type=movement_type,
        qty_delta=qty_delta,
        unit_cost=unit_cost,
        unit_price=unit_price,
        note=note,
        created_by_user=created_by_user,
    )
    db.add(mv)


async def _collect_produs_lines(
    db: AsyncSession, account_id: int, receipt_id: int
) -> list[ReceiptLineForStock]:
    """Returneaza doar liniile de tip PRODUS, legate de un Item existent."""
    rows = (await db.execute(
        select(
            ReceiptItem.item_id,
            ReceiptItem.name,
            ReceiptItem.qty,
            ReceiptItem.price,
            ReceiptItem.employee_id,
        ).where(
            ReceiptItem.receipt_id == receipt_id,
            ReceiptItem.account_id == account_id,
            ReceiptItem.item_type == ItemType.PRODUS,
            ReceiptItem.item_id.is_not(None),
        )
    )).all()
    return [
        ReceiptLineForStock(
            item_id=r.item_id, item_name=r.name, qty=r.qty,
            unit_price=r.price, employee_id=r.employee_id,
        )
        for r in rows
    ]


async def apply_sale_for_receipt(
    db: AsyncSession, account_id: int, receipt: Receipt,
    created_by_user: str | None = None,
) -> None:
    """Tranzitie NEPLATIT → platit. Scade stocul si logheaza SALE pentru fiecare linie PRODUS."""
    if receipt.location_id is None:
        return
    lines = await _collect_produs_lines(db, account_id, receipt.id)
    if not lines:
        return

    item_ids = [ln.item_id for ln in lines]
    cost_map = dict((await db.execute(
        select(Item.id, Item.cost_price).where(Item.id.in_(item_ids))
    )).all())

    now = datetime.now(timezone.utc)
    for ln in lines:
        stock = await _get_or_create_stock(db, account_id, ln.item_id, receipt.location_id)
        stock.qty = stock.qty - ln.qty
        stock.updated_at = now
        await _movement(
            db,
            account_id=account_id,
            item_id=ln.item_id,
            item_name=ln.item_name,
            location_id=receipt.location_id,
            employee_id=ln.employee_id,
            receipt_id=receipt.id,
            movement_type=StockMovementType.SALE,
            qty_delta=-ln.qty,
            unit_cost=cost_map.get(ln.item_id),
            unit_price=ln.unit_price,
            note=None,
            created_by_user=created_by_user,
        )


async def reverse_sale_for_receipt(
    db: AsyncSession, account_id: int, receipt: Receipt,
    created_by_user: str | None = None,
) -> None:
    """Tranzitie platit → NEPLATIT sau stergere bon platit. Readuce stocul si logheaza SALE_REVERSE."""
    if receipt.location_id is None:
        return
    lines = await _collect_produs_lines(db, account_id, receipt.id)
    if not lines:
        return

    item_ids = [ln.item_id for ln in lines]
    cost_map = dict((await db.execute(
        select(Item.id, Item.cost_price).where(Item.id.in_(item_ids))
    )).all())

    now = datetime.now(timezone.utc)
    for ln in lines:
        stock = await _get_or_create_stock(db, account_id, ln.item_id, receipt.location_id)
        stock.qty = stock.qty + ln.qty
        stock.updated_at = now
        await _movement(
            db,
            account_id=account_id,
            item_id=ln.item_id,
            item_name=ln.item_name,
            location_id=receipt.location_id,
            employee_id=ln.employee_id,
            receipt_id=receipt.id,
            movement_type=StockMovementType.SALE_REVERSE,
            qty_delta=ln.qty,
            unit_cost=cost_map.get(ln.item_id),
            unit_price=ln.unit_price,
            note=None,
            created_by_user=created_by_user,
        )


async def apply_purchase(
    db: AsyncSession,
    *,
    account_id: int,
    item: Item,
    location_id: int,
    qty: int,
    unit_cost: Decimal | None,
    note: str | None,
    created_by_user: str | None = None,
) -> Stock:
    """Intrare de marfa. qty > 0."""
    stock = await _get_or_create_stock(db, account_id, item.id, location_id)
    stock.qty = stock.qty + qty
    stock.updated_at = datetime.now(timezone.utc)
    await _movement(
        db,
        account_id=account_id,
        item_id=item.id,
        item_name=item.name,
        location_id=location_id,
        employee_id=None,
        receipt_id=None,
        movement_type=StockMovementType.PURCHASE,
        qty_delta=qty,
        unit_cost=unit_cost if unit_cost is not None else item.cost_price,
        unit_price=item.price,
        note=note,
        created_by_user=created_by_user,
    )
    return stock


async def apply_adjustment(
    db: AsyncSession,
    *,
    account_id: int,
    item: Item,
    location_id: int,
    new_qty: int,
    note: str | None,
    created_by_user: str | None = None,
) -> Stock:
    """Ajustare manuala (ex. inventar): seteaza qty la new_qty si logheaza delta."""
    stock = await _get_or_create_stock(db, account_id, item.id, location_id)
    delta = new_qty - stock.qty
    stock.qty = new_qty
    stock.updated_at = datetime.now(timezone.utc)
    if delta != 0:
        await _movement(
            db,
            account_id=account_id,
            item_id=item.id,
            item_name=item.name,
            location_id=location_id,
            employee_id=None,
            receipt_id=None,
            movement_type=StockMovementType.ADJUSTMENT,
            qty_delta=delta,
            unit_cost=item.cost_price,
            unit_price=item.price,
            note=note,
            created_by_user=created_by_user,
        )
    return stock
