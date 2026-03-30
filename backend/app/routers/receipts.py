from __future__ import annotations
import asyncio
import json
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import select, func, extract, update, delete, or_, and_
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.broadcaster import broadcaster
from app.database import get_db
from app.dependencies import get_account_id, get_account_id_from_query
from app.models.employee import Employee
from app.models.receipt import Receipt, ReceiptItem, PayMethod
from app.schemas.receipt import ReceiptCreate, ReceiptPatch, ReceiptContentPatch, ReceiptRead, ReceiptItemRead, ReceiptClientPatch, AssignNumberRequest, AssignNumberResponse
from app.models.client import Client
from app.models.location import Location
from app.models.register import Register
from app.models.company import Company
from app.models.disclaimer import Disclaimer
from app.schemas.common import Page
from app.utils.filter import apply_filters
from app.utils.soft_delete import soft_delete
from app.utils.sort import apply_sort

router = APIRouter()


async def _refresh_accumulations(db: AsyncSession, account_id: int, employee_ids: set[int]) -> None:
    """Recalculează current_target_accumulation pentru angajații afectați (luna curentă)."""
    if not employee_ids:
        return
    now = datetime.now(timezone.utc)
    rows = (await db.execute(
        select(ReceiptItem.employee_id, func.coalesce(func.sum(ReceiptItem.price * ReceiptItem.qty), 0))
        .join(Receipt, Receipt.id == ReceiptItem.receipt_id)
        .where(
            ReceiptItem.employee_id.in_(employee_ids),
            Receipt.account_id == account_id,
            Receipt.is_deleted == False,
            Receipt.pay_method != PayMethod.NEPLATIT,
            extract("year",  Receipt.created_at) == now.year,
            extract("month", Receipt.created_at) == now.month,
        )
        .group_by(ReceiptItem.employee_id)
    )).all()

    totals = {emp_id: Decimal(str(total)) for emp_id, total in rows}

    for emp_id in employee_ids:
        await db.execute(
            update(Employee)
            .where(Employee.id == emp_id)
            .values(current_target_accumulation=totals.get(emp_id, Decimal("0.00")))
        )


def _serialize(receipt: Receipt) -> dict:
    data = ReceiptRead.model_validate(receipt).model_dump()
    data["receipt_items"] = [
        ReceiptItemRead.from_orm_item(it).model_dump() for it in receipt.receipt_items
    ]
    c = receipt.client
    data["client_nume"]         = c.nume          if c else None
    data["client_cui"]          = c.cui           if c else None
    data["client_adresa"]       = c.adresa        if c else None
    data["client_telefon"]      = c.telefon       if c else None
    data["client_tip"]          = c.tip           if c else None
    data["client_reprezentant"]  = c.reprezentant  if c else None
    data["client_numar_masina"]  = c.numar_masina  if c else None
    return data


@router.get("", response_model=Page[ReceiptRead])
async def list_receipts(
    last_id: int | None = None,
    limit: int = 20,
    q: str | None = None,
    filters: str | None = None,
    sort: str | None = None,
    include_deleted: bool = False,
    date_from: date | None = None,
    date_to: date | None = None,
    unpaid_days: int | None = None,
    location_id: int | None = None,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    limit = min(limit, 1000)
    stmt = (
        select(Receipt)
        .options(
            selectinload(Receipt.receipt_items).selectinload(ReceiptItem.employee),
            selectinload(Receipt.client),
        )
        .where(Receipt.account_id == account_id)
    )
    if not include_deleted:
        stmt = stmt.where(Receipt.is_deleted == False)
    if last_id is not None:
        stmt = stmt.where(Receipt.id < last_id)
    if q:
        stmt = stmt.where(Receipt.titlu.ilike(f"%{q}%"))

    # Filtru dupa data cu OR pentru neplatite recente
    date_conditions = []
    if date_from is not None or date_to is not None:
        range_clauses = []
        if date_from is not None:
            range_clauses.append(Receipt.created_at >= datetime(date_from.year, date_from.month, date_from.day, 0, 0, 0, tzinfo=timezone.utc))
        if date_to is not None:
            dt_to = datetime(date_to.year, date_to.month, date_to.day, 0, 0, 0, tzinfo=timezone.utc) + timedelta(days=1)
            range_clauses.append(Receipt.created_at < dt_to)
        date_conditions.append(and_(*range_clauses))
    if unpaid_days is not None and unpaid_days > 0:
        past = datetime.now(timezone.utc) - timedelta(days=unpaid_days)
        date_conditions.append(and_(Receipt.created_at >= past, Receipt.pay_method == PayMethod.NEPLATIT))
    if date_conditions:
        stmt = stmt.where(or_(*date_conditions))
    if location_id is not None:
        stmt = stmt.where(or_(Receipt.location_id == location_id, Receipt.location_id.is_(None)))
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
        titlu=body.titlu,
        client_id=body.client_id,
        programare_id=body.programare_id,
        location_id=body.location_id,
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

    emp_ids = {it.employee_id for it in body.items if it.employee_id}
    await _refresh_accumulations(db, account_id, emp_ids)
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
    request: Request,
    account_id: int = Depends(get_account_id_from_query),
    client_type: str = "reception",
):
    if client_type == "pos":
        broadcaster.pos_connect(account_id)
        await broadcaster.notify_pos_count(account_id)

        async def pos_stream():
            try:
                yield f"data: {json.dumps({'type': 'connected'})}\n\n"
                while True:
                    await asyncio.sleep(5)
                    if await request.is_disconnected():
                        break
                    yield ": keepalive\n\n"
            finally:
                broadcaster.pos_disconnect(account_id)
                await broadcaster.notify_pos_count(account_id)

        return StreamingResponse(
            pos_stream(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    q = broadcaster.subscribe(account_id)

    async def stream():
        try:
            yield f"data: {json.dumps({'type': 'connected', 'pos_count': broadcaster.get_pos_count(account_id)})}\n\n"
            while True:
                try:
                    event_data = await asyncio.wait_for(q.get(), timeout=30.0)
                    yield f"data: {json.dumps(event_data)}\n\n"
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

    emp_id_rows = (await db.execute(
        select(ReceiptItem.employee_id).where(ReceiptItem.receipt_id == receipt_id)
    )).scalars().all()
    emp_ids = {eid for eid in emp_id_rows if eid}

    receipt.pay_method = body.pay_method
    receipt.partial_pay = body.partial_pay
    receipt.updated_at = datetime.now(timezone.utc)
    await db.commit()

    await _refresh_accumulations(db, account_id, emp_ids)
    await db.commit()

    result = (await db.execute(
        select(Receipt)
        .options(selectinload(Receipt.receipt_items).selectinload(ReceiptItem.employee))
        .where(Receipt.id == receipt_id)
    )).scalar_one()

    await broadcaster.notify(account_id)
    return _serialize(result)


@router.patch("/{receipt_id}/content", response_model=ReceiptRead)
async def patch_receipt_content(
    receipt_id: int,
    body: ReceiptContentPatch,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    receipt = await db.get(Receipt, receipt_id)
    if receipt is None or receipt.account_id != account_id:
        raise HTTPException(404, "Bonul nu a fost gasit.")

    old_emp_ids = {
        eid for eid in
        (await db.execute(select(ReceiptItem.employee_id).where(ReceiptItem.receipt_id == receipt_id))).scalars().all()
        if eid
    }

    receipt.titlu = body.titlu
    receipt.descriere = body.descriere
    receipt.date_tehn = body.date_tehn
    receipt.total = body.total
    receipt.updated_at = datetime.now(timezone.utc)

    await db.execute(delete(ReceiptItem).where(ReceiptItem.receipt_id == receipt_id))
    await db.flush()

    new_emp_ids: set[int] = set()
    for item in body.items:
        db.add(ReceiptItem(
            account_id=account_id,
            receipt_id=receipt_id,
            name=item.name,
            price=item.price,
            qty=item.qty,
            unit=item.unit,
            employee_id=item.employee_id,
        ))
        if item.employee_id:
            new_emp_ids.add(item.employee_id)

    await db.commit()
    await _refresh_accumulations(db, account_id, old_emp_ids | new_emp_ids)
    await db.commit()

    db.expire_all()
    result = (await db.execute(
        select(Receipt)
        .options(
            selectinload(Receipt.receipt_items).selectinload(ReceiptItem.employee),
            selectinload(Receipt.client),
        )
        .where(Receipt.id == receipt_id)
    )).scalar_one()

    await broadcaster.notify(account_id)
    return _serialize(result)


@router.patch("/{receipt_id}/client", response_model=ReceiptRead)
async def patch_receipt_client(
    receipt_id: int,
    body: ReceiptClientPatch,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    receipt = await db.get(Receipt, receipt_id)
    if receipt is None or receipt.account_id != account_id or receipt.is_deleted:
        raise HTTPException(404, "Bonul nu a fost găsit.")
    receipt.client_id = body.client_id
    await db.commit()
    result = await db.execute(
        select(Receipt)
        .options(
            selectinload(Receipt.receipt_items).selectinload(ReceiptItem.employee),
            selectinload(Receipt.client),
        )
        .where(Receipt.id == receipt_id)
    )
    receipt = result.scalar_one()
    return _serialize(receipt)


@router.post("/{receipt_id}/assign-number", response_model=AssignNumberResponse)
async def assign_number(
    receipt_id: int,
    body: AssignNumberRequest,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    from datetime import datetime, timezone
    receipt = await db.get(Receipt, receipt_id)
    if receipt is None or receipt.account_id != account_id or receipt.is_deleted:
        raise HTTPException(404, "Bonul nu a fost găsit.")

    doc_type = body.doc_type
    if doc_type not in ("deviz", "factura", "chitanta"):
        raise HTTPException(400, "doc_type invalid.")

    # Load location
    location = (await db.execute(
        select(Location).where(Location.id == body.location_id, Location.account_id == account_id)
    )).scalar_one_or_none()
    if location is None:
        raise HTTPException(404, "Locația nu a fost găsită.")

    # Load register
    register = None
    if location.register_id:
        register = await db.get(Register, location.register_id)

    # Determine current nr on receipt
    serie_field = f"{doc_type}_serie"
    nr_field = f"{doc_type}_nr"
    current_nr = getattr(receipt, nr_field, 0)

    if current_nr == 0:
        # Assign new number from register
        if register is None:
            raise HTTPException(400, "Locația nu are un registru configurat.")
        reg_serie = getattr(register, f"{doc_type}_serie")
        reg_numar_field = f"{doc_type}_numar"
        reg_numar = getattr(register, reg_numar_field)
        new_nr = reg_numar + 1
        setattr(register, reg_numar_field, new_nr)
        setattr(receipt, serie_field, reg_serie)
        setattr(receipt, nr_field, new_nr)
        receipt.updated_at = datetime.now(timezone.utc)
        await db.commit()
        serie = reg_serie
        nr = new_nr
    else:
        serie = getattr(receipt, serie_field)
        nr = current_nr

    # Load company
    company_data = None
    company_id = location.company_id
    if company_id:
        company = await db.get(Company, company_id)
        if company:
            company_data = {
                "id": company.id,
                "name": company.name,
                "cui": company.cui,
                "address": company.address,
                "nr_reg_com": company.nr_reg_com,
                "phone": company.phone,
                "tva_percentage": company.tva_percentage,
                "logo_path": company.logo_path,
                "background_path": company.background_path,
                "website": company.website,
                "bank_name": company.bank_name,
                "iban": company.iban,
                "capital_social": company.capital_social,
            }

    # Load disclaimer
    disclaimer_data = None
    if location.disclaimer_id:
        disclaimer = await db.get(Disclaimer, location.disclaimer_id)
        if disclaimer:
            disclaimer_data = {"title": disclaimer.title, "text": disclaimer.text}

    return AssignNumberResponse(serie=serie, nr=nr, company=company_data, disclaimer=disclaimer_data)


@router.delete("/{receipt_id}", status_code=204)
async def delete_receipt(
    receipt_id: int,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    receipt = await db.get(Receipt, receipt_id)
    if receipt is None or receipt.account_id != account_id:
        raise HTTPException(404, "Bonul nu a fost gasit.")

    emp_id_rows = (await db.execute(
        select(ReceiptItem.employee_id).where(ReceiptItem.receipt_id == receipt_id)
    )).scalars().all()
    emp_ids = {eid for eid in emp_id_rows if eid}

    await soft_delete(db, Receipt, receipt_id)
    await _refresh_accumulations(db, account_id, emp_ids)
    await db.commit()
    await broadcaster.notify(account_id)
