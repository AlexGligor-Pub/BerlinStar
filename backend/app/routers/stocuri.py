from __future__ import annotations
from datetime import datetime
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, and_, case
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_account_id, get_actor_username, get_advanced_account_id
from app.models.category import Category
from app.models.department import Department
from app.models.employee import Employee
from app.models.item import Item, ItemType
from app.models.location import Location
from app.models.stock import Stock
from app.models.stock_movement import StockMovement, StockMovementType
from app.schemas.stoc import (
    StocRow, ItemStocPatch, IntrareStocCreate, AjustareStocCreate,
    MiscareStocRow, StocSnapshot,
)
from app.services.stock import apply_purchase, apply_adjustment

router = APIRouter()


@router.get("", response_model=list[StocRow])
async def list_stocuri(
    location_id: int = Query(...),
    q: str | None = None,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    loc = await db.get(Location, location_id)
    if loc is None or loc.account_id != account_id or loc.is_deleted:
        raise HTTPException(404, "Locatia nu a fost gasita.")

    stmt = (
        select(
            Item.id, Item.name, Item.unit, Item.price, Item.cost_price, Item.stoc_minim,
            Category.id, Category.name,
            Department.id, Department.name,
            func.coalesce(Stock.qty, 0).label("qty"),
        )
        .join(Category, Category.id == Item.category_id)
        .join(Department, Department.id == Category.department_id)
        .outerjoin(Stock, and_(Stock.item_id == Item.id, Stock.location_id == location_id))
        .where(
            Item.account_id == account_id,
            Item.is_deleted == False,
            Item.type == ItemType.PRODUS,
            Category.is_deleted == False,
            Department.is_deleted == False,
        )
        .order_by(Department.name, Category.name, Item.name)
    )
    if q:
        stmt = stmt.where(Item.name.ilike(f"%{q}%"))

    rows = (await db.execute(stmt)).all()
    return [
        StocRow(
            item_id=r[0], name=r[1], unit=r[2], price=r[3],
            cost_price=r[4], stoc_minim=r[5],
            category_id=r[6], category_name=r[7],
            department_id=r[8], department_name=r[9],
            qty=int(r[10]),
        )
        for r in rows
    ]


@router.patch("/item/{item_id}", response_model=StocRow)
async def patch_item_stoc_meta(
    item_id: int,
    body: ItemStocPatch,
    location_id: int = Query(...),
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    item = await db.get(Item, item_id)
    if item is None or item.account_id != account_id or item.is_deleted:
        raise HTTPException(404, "Produsul nu a fost gasit.")
    if item.type != ItemType.PRODUS:
        raise HTTPException(400, "Doar produsele au stoc.")

    if body.cost_price is not None:
        item.cost_price = body.cost_price
    if body.stoc_minim is not None:
        item.stoc_minim = body.stoc_minim
    item.updated_at = datetime.utcnow()
    await db.commit()

    # Returneaza randul cu noile valori
    stock = (await db.execute(
        select(func.coalesce(Stock.qty, 0))
        .select_from(Item)
        .outerjoin(Stock, and_(Stock.item_id == Item.id, Stock.location_id == location_id))
        .where(Item.id == item_id)
    )).scalar() or 0

    cat = await db.get(Category, item.category_id)
    dept = await db.get(Department, cat.department_id)

    return StocRow(
        item_id=item.id, name=item.name, unit=item.unit, price=item.price,
        cost_price=item.cost_price, stoc_minim=item.stoc_minim,
        category_id=cat.id, category_name=cat.name,
        department_id=dept.id, department_name=dept.name,
        qty=int(stock),
    )


@router.post("/intrare", response_model=StocRow)
async def intrare_stoc(
    body: IntrareStocCreate,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
    # Cine face miscarea — se salveaza in jurnalul de stoc.
    actor: str = Depends(get_actor_username),
):
    item = await db.get(Item, body.item_id)
    if item is None or item.account_id != account_id or item.is_deleted:
        raise HTTPException(404, "Produsul nu a fost gasit.")
    if item.type != ItemType.PRODUS:
        raise HTTPException(400, "Doar produsele au stoc.")
    loc = await db.get(Location, body.location_id)
    if loc is None or loc.account_id != account_id:
        raise HTTPException(404, "Locatia nu a fost gasita.")

    await apply_purchase(
        db, account_id=account_id, item=item, location_id=body.location_id,
        qty=body.qty, unit_cost=body.unit_cost, note=body.note,
        created_by_user=actor,
    )
    await db.commit()

    return await _read_stoc_row(db, item, body.location_id)


@router.post("/ajustare", response_model=StocRow)
async def ajustare_stoc(
    body: AjustareStocCreate,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
    # Cine face miscarea — se salveaza in jurnalul de stoc.
    actor: str = Depends(get_actor_username),
):
    item = await db.get(Item, body.item_id)
    if item is None or item.account_id != account_id or item.is_deleted:
        raise HTTPException(404, "Produsul nu a fost gasit.")
    if item.type != ItemType.PRODUS:
        raise HTTPException(400, "Doar produsele au stoc.")
    loc = await db.get(Location, body.location_id)
    if loc is None or loc.account_id != account_id:
        raise HTTPException(404, "Locatia nu a fost gasita.")

    await apply_adjustment(
        db, account_id=account_id, item=item, location_id=body.location_id,
        new_qty=body.new_qty, note=body.note,
        created_by_user=actor,
    )
    await db.commit()

    return await _read_stoc_row(db, item, body.location_id)


async def _read_stoc_row(db: AsyncSession, item: Item, location_id: int) -> StocRow:
    qty = (await db.execute(
        select(func.coalesce(Stock.qty, 0))
        .select_from(Item)
        .outerjoin(Stock, and_(Stock.item_id == Item.id, Stock.location_id == location_id))
        .where(Item.id == item.id)
    )).scalar() or 0
    cat = await db.get(Category, item.category_id)
    dept = await db.get(Department, cat.department_id)
    return StocRow(
        item_id=item.id, name=item.name, unit=item.unit, price=item.price,
        cost_price=item.cost_price, stoc_minim=item.stoc_minim,
        category_id=cat.id, category_name=cat.name,
        department_id=dept.id, department_name=dept.name,
        qty=int(qty),
    )


@router.get("/miscari", response_model=list[MiscareStocRow])
async def list_miscari(
    location_id: int | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    employee_id: int | None = None,
    item_id: int | None = None,
    movement_type: StockMovementType | None = None,
    limit: int = Query(200, ge=1, le=1000),
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    stmt = (
        select(StockMovement, Employee.name)
        .outerjoin(Employee, Employee.id == StockMovement.employee_id)
        .where(StockMovement.account_id == account_id)
        .order_by(StockMovement.created_at.desc())
        .limit(limit)
    )
    if location_id is not None:
        stmt = stmt.where(StockMovement.location_id == location_id)
    if date_from is not None:
        stmt = stmt.where(StockMovement.created_at >= date_from)
    if date_to is not None:
        stmt = stmt.where(StockMovement.created_at <= date_to)
    if employee_id is not None:
        stmt = stmt.where(StockMovement.employee_id == employee_id)
    if item_id is not None:
        stmt = stmt.where(StockMovement.item_id == item_id)
    if movement_type is not None:
        stmt = stmt.where(StockMovement.movement_type == movement_type)

    rows = (await db.execute(stmt)).all()
    out: list[MiscareStocRow] = []
    for mv, emp_name in rows:
        m = MiscareStocRow.model_validate(mv)
        m.employee_name = emp_name
        out.append(m)
    return out


@router.get("/snapshot", response_model=StocSnapshot)
async def stoc_snapshot(
    location_id: int = Query(...),
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    loc = await db.get(Location, location_id)
    if loc is None or loc.account_id != account_id:
        raise HTTPException(404, "Locatia nu a fost gasita.")

    row = (await db.execute(
        select(
            func.count(Item.id),
            func.coalesce(func.sum(func.coalesce(Stock.qty, 0)), 0),
            func.coalesce(func.sum(func.coalesce(Stock.qty, 0) * func.coalesce(Item.cost_price, 0)), 0),
            func.coalesce(func.sum(func.coalesce(Stock.qty, 0) * Item.price), 0),
            func.coalesce(func.sum(
                case(
                    (and_(Item.stoc_minim > 0, func.coalesce(Stock.qty, 0) <= Item.stoc_minim), 1),
                    else_=0,
                )
            ), 0),
        )
        .select_from(Item)
        .outerjoin(Stock, and_(Stock.item_id == Item.id, Stock.location_id == location_id))
        .where(
            Item.account_id == account_id,
            Item.is_deleted == False,
            Item.type == ItemType.PRODUS,
        )
    )).one()

    return StocSnapshot(
        location_id=loc.id,
        location_name=loc.name,
        nr_produse=int(row[0]),
        qty_total=int(row[1]),
        valoare_cost=Decimal(row[2]),
        valoare_vanzare=Decimal(row[3]),
        sub_stoc_minim=int(row[4]),
    )


@router.get("/reports/top-produse")
async def report_top_produse(
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    location_ids: list[int] = Query(default=[]),
    limit: int = Query(20, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_advanced_account_id),
):
    stmt = (
        select(
            StockMovement.item_id,
            StockMovement.item_name,
            func.sum(-StockMovement.qty_delta).label("qty_total"),
            func.coalesce(func.sum(-StockMovement.qty_delta * StockMovement.unit_price), 0).label("valoare_vanzare"),
            func.coalesce(func.sum(-StockMovement.qty_delta * StockMovement.unit_cost), 0).label("valoare_cost"),
        )
        .where(
            StockMovement.account_id == account_id,
            StockMovement.movement_type == StockMovementType.SALE,
        )
        .group_by(StockMovement.item_id, StockMovement.item_name)
        .order_by(func.sum(-StockMovement.qty_delta).desc())
        .limit(limit)
    )
    if date_from is not None:
        stmt = stmt.where(StockMovement.created_at >= date_from)
    if date_to is not None:
        stmt = stmt.where(StockMovement.created_at <= date_to)
    if location_ids:
        stmt = stmt.where(StockMovement.location_id.in_(location_ids))

    rows = (await db.execute(stmt)).all()
    return [
        {
            "item_id": r.item_id,
            "item_name": r.item_name,
            "qty_total": int(r.qty_total or 0),
            "valoare_vanzare": float(r.valoare_vanzare or 0),
            "valoare_cost": float(r.valoare_cost or 0),
            "marja": float((r.valoare_vanzare or 0) - (r.valoare_cost or 0)),
        }
        for r in rows
    ]


@router.get("/reports/per-angajat")
async def report_per_angajat(
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    location_ids: list[int] = Query(default=[]),
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_advanced_account_id),
):
    stmt = (
        select(
            StockMovement.employee_id,
            Employee.name,
            StockMovement.item_id,
            StockMovement.item_name,
            func.sum(-StockMovement.qty_delta).label("qty_total"),
            func.coalesce(func.sum(-StockMovement.qty_delta * StockMovement.unit_price), 0).label("valoare"),
        )
        .outerjoin(Employee, Employee.id == StockMovement.employee_id)
        .where(
            StockMovement.account_id == account_id,
            StockMovement.movement_type == StockMovementType.SALE,
        )
        .group_by(StockMovement.employee_id, Employee.name, StockMovement.item_id, StockMovement.item_name)
        .order_by(Employee.name, func.sum(-StockMovement.qty_delta).desc())
    )
    if date_from is not None:
        stmt = stmt.where(StockMovement.created_at >= date_from)
    if date_to is not None:
        stmt = stmt.where(StockMovement.created_at <= date_to)
    if location_ids:
        stmt = stmt.where(StockMovement.location_id.in_(location_ids))

    rows = (await db.execute(stmt)).all()
    return [
        {
            "employee_id": r.employee_id,
            "employee_name": r.name or "—",
            "item_id": r.item_id,
            "item_name": r.item_name,
            "qty_total": int(r.qty_total or 0),
            "valoare": float(r.valoare or 0),
        }
        for r in rows
    ]
