from __future__ import annotations
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal
from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import set_committed_value

from app.models.employee import Employee
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


async def _insert_missing(
    db: AsyncSession, account_id: int, item_ids: list[int], location_id: int
) -> None:
    """INSERT ... ON CONFLICT DO NOTHING: doua tranzactii concurente pot crea
    acelasi rand fara IntegrityError; cine pierde cursa citeste randul celuilalt."""
    if not item_ids:
        return
    now = datetime.now(timezone.utc)
    await db.execute(
        pg_insert(Stock)
        .values([
            {"account_id": account_id, "item_id": iid, "location_id": location_id, "qty": 0, "updated_at": now}
            for iid in item_ids
        ])
        .on_conflict_do_nothing(index_elements=["item_id", "location_id"])
    )


async def _get_or_create_stock(
    db: AsyncSession, account_id: int, item_id: int, location_id: int
) -> Stock:
    """Randul de stoc, blocat (FOR UPDATE) pana la commit."""
    await _insert_missing(db, account_id, [item_id], location_id)
    return (await db.execute(
        select(Stock)
        .where(Stock.item_id == item_id, Stock.location_id == location_id)
        .with_for_update(of=Stock)
    )).scalar_one()


async def _get_or_create_stocks(
    db: AsyncSession, account_id: int, item_ids: list[int], location_id: int
) -> dict[int, Stock]:
    """Varianta batched a lui `_get_or_create_stock` — un singur SELECT pentru toate liniile."""
    await _insert_missing(db, account_id, sorted(set(item_ids)), location_id)
    rows = (await db.execute(
        select(Stock).where(Stock.item_id.in_(item_ids), Stock.location_id == location_id)
    )).scalars().all()
    return {s.item_id: s for s in rows}


async def _shift_qty(db: AsyncSession, stock: Stock, delta: int, now: datetime) -> None:
    """`qty = qty + delta` in DB (atomic), cu obiectul din sesiune adus la zi."""
    new_qty = (await db.execute(
        update(Stock)
        .where(Stock.id == stock.id)
        .values(qty=Stock.qty + delta, updated_at=now)
        .returning(Stock.qty)
        .execution_options(synchronize_session=False)
    )).scalar_one()
    set_committed_value(stock, "qty", new_qty)
    set_committed_value(stock, "updated_at", now)


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
        ).order_by(ReceiptItem.id)
    )).all()
    return [
        ReceiptLineForStock(
            item_id=r.item_id, item_name=r.name, qty=r.qty,
            unit_price=r.price, employee_id=r.employee_id,
        )
        for r in rows
    ]


async def _own_lines_with_cost(
    db: AsyncSession, account_id: int, lines: list[ReceiptLineForStock]
) -> tuple[list[ReceiptLineForStock], dict[int, Decimal | None]]:
    """Liniile al caror articol apartine contului + costul fiecarui articol.

    `ReceiptItem.item_id`/`employee_id` vin din body-ul bonului. O linie cu articolul
    altui cont e sarita cu totul: altfel i-am copia costul de achizitie in miscari
    (vizibil in rapoarte) si am crea stoc pe contul apelantului pentru un articol strain.
    Un angajat strain e scos de pe miscare, ca sa nu-i apara numele in raportul pe angajat.
    Fara filtru pe `is_deleted`: un bon vechi, cu articol sau angajat sters intre timp,
    trebuie sa poata fi platit/stornat in continuare."""
    cost_map: dict[int, Decimal | None] = {
        item_id: cost
        for item_id, cost in (await db.execute(
            select(Item.id, Item.cost_price).where(
                Item.id.in_({ln.item_id for ln in lines}),
                Item.account_id == account_id,
            )
        )).all()
    }
    own = [ln for ln in lines if ln.item_id in cost_map]
    employee_ids = {ln.employee_id for ln in own if ln.employee_id is not None}
    if employee_ids:
        own_employees = set((await db.execute(
            select(Employee.id).where(
                Employee.id.in_(employee_ids), Employee.account_id == account_id
            )
        )).scalars().all())
        for ln in own:
            if ln.employee_id not in own_employees:
                ln.employee_id = None
    return own, cost_map


@dataclass
class _OpenSale:
    """O miscare SALE a bonului, cu cat a mai ramas nestornat din ea."""
    item_id: int
    item_name: str
    location_id: int
    employee_id: int | None
    qty: int
    unit_cost: Decimal | None
    unit_price: Decimal | None


async def _open_sales(db: AsyncSession, account_id: int, receipt_id: int) -> list[_OpenSale]:
    """Vanzarile bonului care sunt ACUM scazute din stoc, citite din jurnal.

    Jurnalul e sursa de adevar, nu statusul de plata: fiecare SALE_REVERSE stinge,
    in ordine, cele mai vechi SALE ramase deschise pe acelasi articol si aceeasi
    locatie. O stornare fara vanzare in urma ei (scrisa de versiunile vechi) nu
    stinge nimic si nu „crediteaza" o vanzare viitoare.
    """
    rows = (await db.execute(
        select(
            StockMovement.item_id, StockMovement.item_name, StockMovement.location_id,
            StockMovement.employee_id, StockMovement.movement_type, StockMovement.qty_delta,
            StockMovement.unit_cost, StockMovement.unit_price,
        ).where(
            StockMovement.receipt_id == receipt_id,
            StockMovement.account_id == account_id,
            StockMovement.movement_type.in_(
                (StockMovementType.SALE, StockMovementType.SALE_REVERSE)
            ),
        ).order_by(StockMovement.id)
    )).all()
    opened: list[_OpenSale] = []
    for r in rows:
        # Articol sau locatie sterse definitiv: randul de stoc a disparut odata cu ele.
        if r.item_id is None or r.location_id is None:
            continue
        if r.movement_type == StockMovementType.SALE:
            if r.qty_delta < 0:
                opened.append(_OpenSale(
                    item_id=r.item_id, item_name=r.item_name, location_id=r.location_id,
                    employee_id=r.employee_id, qty=-r.qty_delta,
                    unit_cost=r.unit_cost, unit_price=r.unit_price,
                ))
            continue
        left = r.qty_delta
        for sale in opened:
            if left <= 0:
                break
            if sale.item_id == r.item_id and sale.location_id == r.location_id and sale.qty > 0:
                taken = min(sale.qty, left)
                sale.qty -= taken
                left -= taken
    return [sale for sale in opened if sale.qty > 0]


async def _reverse_open_sales(
    db: AsyncSession, account_id: int, receipt: Receipt,
    open_sales: list[_OpenSale], created_by_user: str | None,
) -> None:
    """Readuce in stoc exact ce e inca scazut, cu costul si pretul vanzarii stornate."""
    # Aceeasi izolare ca la vanzare: o miscare veche pe articolul altui cont nu se
    # atinge, iar angajatul altui cont nu ajunge pe stornare.
    own_items = set((await db.execute(
        select(Item.id).where(
            Item.id.in_({s.item_id for s in open_sales}), Item.account_id == account_id
        )
    )).scalars().all())
    open_sales = [s for s in open_sales if s.item_id in own_items]
    if not open_sales:
        return
    employee_ids = {s.employee_id for s in open_sales if s.employee_id is not None}
    own_employees: set[int] = set()
    if employee_ids:
        own_employees = set((await db.execute(
            select(Employee.id).where(
                Employee.id.in_(employee_ids), Employee.account_id == account_id
            )
        )).scalars().all())

    now = datetime.now(timezone.utc)
    for location_id in sorted({s.location_id for s in open_sales}):
        here = [s for s in open_sales if s.location_id == location_id]
        stocks = await _get_or_create_stocks(db, account_id, [s.item_id for s in here], location_id)
        for sale in here:
            await _shift_qty(db, stocks[sale.item_id], sale.qty, now)
            await _movement(
                db,
                account_id=account_id,
                item_id=sale.item_id,
                item_name=sale.item_name,
                location_id=location_id,
                employee_id=sale.employee_id if sale.employee_id in own_employees else None,
                receipt_id=receipt.id,
                movement_type=StockMovementType.SALE_REVERSE,
                qty_delta=sale.qty,
                unit_cost=sale.unit_cost,
                unit_price=sale.unit_price,
                note=None,
                created_by_user=created_by_user,
            )


async def _own_produs_lines(
    db: AsyncSession, account_id: int, receipt: Receipt
) -> tuple[list[ReceiptLineForStock], dict[int, Decimal | None]]:
    """Liniile bonului care misca stocul (PRODUS, articol al contului, bon cu locatie)."""
    if receipt.location_id is None:
        return [], {}
    lines = await _collect_produs_lines(db, account_id, receipt.id)
    if not lines:
        return [], {}
    return await _own_lines_with_cost(db, account_id, lines)


def _applied_per_item(open_sales: list[_OpenSale], location_id: int | None) -> dict[int, int]:
    applied: dict[int, int] = {}
    for sale in open_sales:
        if sale.location_id == location_id:
            applied[sale.item_id] = applied.get(sale.item_id, 0) + sale.qty
    return applied


async def _apply_missing_sales(
    db: AsyncSession, account_id: int, receipt: Receipt,
    open_sales: list[_OpenSale], keep_unapplied: dict[int, int] | None,
    created_by_user: str | None,
) -> None:
    """Scade din stoc doar ce nu e deja scazut pentru liniile curente ale bonului."""
    lines, cost_map = await _own_produs_lines(db, account_id, receipt)
    if not lines:
        return
    covered = _applied_per_item(open_sales, receipt.location_id)
    for item_id, qty in (keep_unapplied or {}).items():
        covered[item_id] = covered.get(item_id, 0) + qty

    todo: list[tuple[ReceiptLineForStock, int]] = []
    for ln in lines:
        skipped = min(covered.get(ln.item_id, 0), ln.qty)
        if skipped:
            covered[ln.item_id] -= skipped
        if ln.qty > skipped:
            todo.append((ln, ln.qty - skipped))
    if not todo:
        return

    now = datetime.now(timezone.utc)
    stocks = await _get_or_create_stocks(
        db, account_id, [ln.item_id for ln, _ in todo], receipt.location_id
    )
    for ln, qty in todo:
        await _shift_qty(db, stocks[ln.item_id], -qty, now)
        await _movement(
            db,
            account_id=account_id,
            item_id=ln.item_id,
            item_name=ln.item_name,
            location_id=receipt.location_id,
            employee_id=ln.employee_id,
            receipt_id=receipt.id,
            movement_type=StockMovementType.SALE,
            qty_delta=-qty,
            unit_cost=cost_map.get(ln.item_id),
            unit_price=ln.unit_price,
            note=None,
            created_by_user=created_by_user,
        )


async def reconcile_sale_for_receipt(
    db: AsyncSession, account_id: int, receipt: Receipt, *,
    paid: bool,
    created_by_user: str | None = None,
    keep_unapplied: dict[int, int] | None = None,
) -> None:
    """Singura regula stoc <-> stare de plata: aduce jurnalul de stoc la starea ceruta.

    `paid` = bonul trebuie sa aiba marfa scazuta (orice status in afara de
    Neplatit, bon nesters). Decizia se ia din miscarile deja inregistrate pentru
    bon, nu din tranzitia de status:

      - paid=False -> storneaza exact ce e inca scazut; daca nu e nimic, nu scrie
        nimic. Bonurile ajunse „platite" fara SALE (create direct platite sau
        incasate prin registru de versiunile vechi) nu mai adauga marfa in stoc.
      - paid=True  -> scade doar ce lipseste fata de liniile curente; un al doilea
        apel nu mai scade nimic.

    `keep_unapplied` (articol -> cantitate) lasa nescazuta o parte din linii; e
    folosit la editarea continutului, vezi `unapplied_sale_qty`.

    Apelantul tine bonul blocat (FOR UPDATE), deci doua cereri simultane pe
    acelasi bon nu citesc acelasi jurnal.
    """
    open_sales = await _open_sales(db, account_id, receipt.id)
    if not paid:
        if open_sales:
            await _reverse_open_sales(db, account_id, receipt, open_sales, created_by_user)
        return
    await _apply_missing_sales(
        db, account_id, receipt, open_sales, keep_unapplied, created_by_user
    )


async def unapplied_sale_qty(
    db: AsyncSession, account_id: int, receipt: Receipt
) -> dict[int, int]:
    """Cat din liniile PRODUS ale bonului NU e scazut din stoc, pe articol.

    Pe un bon platit corect e gol. E nenul doar pe bonurile vechi ramase platite
    fara SALE. La editarea continutului diferenta se pastreaza: editarea misca
    stocul doar cu ce s-a schimbat pe linii, nu scade retroactiv o vanzare veche
    peste un stoc care intre timp poate sa fi fost inventariat.
    """
    lines, _ = await _own_produs_lines(db, account_id, receipt)
    if not lines:
        return {}
    wanted: dict[int, int] = {}
    for ln in lines:
        wanted[ln.item_id] = wanted.get(ln.item_id, 0) + ln.qty
    applied = _applied_per_item(
        await _open_sales(db, account_id, receipt.id), receipt.location_id
    )
    return {
        item_id: qty - applied.get(item_id, 0)
        for item_id, qty in wanted.items()
        if qty > applied.get(item_id, 0)
    }


async def apply_sale_for_receipt(
    db: AsyncSession, account_id: int, receipt: Receipt,
    created_by_user: str | None = None,
) -> None:
    """Tranzitie NEPLATIT → platit. Scade stocul si logheaza SALE pentru fiecare linie PRODUS.

    Idempotent: ce e deja scazut pentru bon nu se mai scade o data."""
    await reconcile_sale_for_receipt(
        db, account_id, receipt, paid=True, created_by_user=created_by_user
    )


async def reverse_sale_for_receipt(
    db: AsyncSession, account_id: int, receipt: Receipt,
    created_by_user: str | None = None,
) -> None:
    """Tranzitie platit → NEPLATIT sau stergere bon. Readuce stocul si logheaza SALE_REVERSE.

    Idempotent: storneaza doar vanzarile inca aplicate, nimic daca nu exista."""
    await reconcile_sale_for_receipt(
        db, account_id, receipt, paid=False, created_by_user=created_by_user
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
    await _shift_qty(db, stock, qty, datetime.now(timezone.utc))
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
    await _shift_qty(db, stock, delta, datetime.now(timezone.utc))
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
