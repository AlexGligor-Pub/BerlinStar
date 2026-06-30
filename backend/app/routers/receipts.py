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
from app.models.item import Item, ItemType
from app.models.location import Location
from app.models.register import Register
from app.models.company import Company
from app.models.disclaimer import Disclaimer
from app.models.vehicol import Vehicol
from app.models.client_vehicol import ClientVehicol
from app.models.cazare_anvelope import CazareAnvelope
from app.efactura.models import EFacturaRecord
from app.schemas.vehicol import VehicolCreate, VehicolRead
from app.schemas.common import Page
from app.utils.filter import apply_filters
from app.utils.soft_delete import soft_delete
from app.utils.sort import apply_sort
from app.services.stock import apply_sale_for_receipt, reverse_sale_for_receipt

router = APIRouter()

# Toleranta pentru recalculul de control al totalului pe factura rapida — rotunjirile
# se aplica per linie inainte de sumare; mai mult de 0.05 RON inseamna client compromis.
_TOTAL_VARIANCE_RON = Decimal("0.05")


def _verify_total_against_items(items: list, claimed_total: Decimal) -> None:
    """Recalculeaza totalul gross din linii cand fiecare linie are vat_percent setat.

    Daca cel putin o linie nu are vat_percent (cazul POS/reception clasic), sare
    peste verificare — acolo totalul se calculeaza diferit (TVA global pe firma).
    """
    if any(it.vat_percent is None for it in items):
        return
    computed = Decimal("0.00")
    for it in items:
        net = it.price * it.qty
        gross = net * (Decimal(1) + (it.vat_percent or Decimal(0)) / Decimal(100))
        computed += gross.quantize(Decimal("0.01"))
    if abs(computed - claimed_total) > _TOTAL_VARIANCE_RON:
        raise HTTPException(
            422,
            f"Total incoerent cu liniile: trimis {claimed_total}, recalculat {computed}.",
        )


async def _resolve_item_link(
    db: AsyncSession,
    account_id: int,
    name: str,
    item_id: int | None,
    item_type: ItemType | None,
) -> tuple[int | None, ItemType | None]:
    """Completează item_id și item_type din catalog dacă lipsesc din payload."""
    if item_id is not None and item_type is not None:
        return item_id, item_type
    row = (await db.execute(
        select(Item.id, Item.type).where(
            Item.account_id == account_id,
            Item.name == name,
            Item.is_deleted == False,
        ).limit(1)
    )).first()
    if row is None:
        return item_id, item_type
    return (item_id if item_id is not None else row.id,
            item_type if item_type is not None else row.type)


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
            Receipt.source != "fdl",
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


async def _ensure_client_vehicol(db: AsyncSession, account_id: int, client_id: int, vehicol: Vehicol) -> None:
    """Creează legătura ClientVehicol dacă nu există deja."""
    if not vehicol.numar_masina:
        return
    existing = (await db.execute(
        select(ClientVehicol).where(
            ClientVehicol.account_id == account_id,
            ClientVehicol.client_id == client_id,
            ClientVehicol.numar_masina == vehicol.numar_masina,
            ClientVehicol.is_deleted == False,
        )
    )).scalar_one_or_none()
    if existing is None:
        db.add(ClientVehicol(
            account_id=account_id,
            client_id=client_id,
            numar_masina=vehicol.numar_masina,
            marca=vehicol.marca,
            model=vehicol.model,
            an_fabricatie=vehicol.an_fabricatie,
            vin=vehicol.vin,
        ))


# Campuri care raman editabile pe un bon blocat (in flux ANAF). Daca `ReceiptPatch`
# creste cu un camp nou, decizia trebuie luata explicit: ori e adaugat aici, ori e
# refuzat la runtime de gardul din `patch_receipt`.
_RECEIPT_PATCH_LOCKED_ALLOWED = {"pay_method", "partial_pay"}


# Status-uri care blocheaza editarea bonului.
#
# Regula: bonul e blocat daca este "in flux ANAF" — adica modificarea lui ar putea
# duce la divergente intre datele de la noi si datele primite de ANAF.
#
# Concret:
#   - pending_upload  -> e in coada catre ANAF (background task ruleaza)
#   - in_prelucrare   -> ANAF a primit factura si o valideaza
#   - accepted        -> factura e validata si arhivata la ANAF
#   - rejected        -> respins asincron, dar are index_incarcare (cuplata cu factura)
#   - error CU index_incarcare -> caz exceptional: post-upload, dar pre-ANAF response
#     parse (rar; tratat ca locked din precautie)
#
# IMPORTANT: "error" fara index_incarcare NU blocheaza — upload-ul n-a ajuns la ANAF
# (HTTP/timeout/validare schematron), deci bonul redevine editabil pentru retry.
# Daca adaugi un status nou, decide-l aici si in `EFacturaSent.canRetry` (FE).
_EFACTURA_LOCKING_STATUSES = {"pending_upload", "in_prelucrare", "accepted", "rejected"}


def _efactura_lock_from_record(rec: EFacturaRecord | None) -> tuple[str | None, bool, str | None, int | None]:
    if rec is None:
        return None, False, None, None
    status = rec.status
    locked = status in _EFACTURA_LOCKING_STATUSES or (status == "error" and rec.index_incarcare is not None)
    return status, locked, rec.anaf_error_message, rec.index_incarcare


async def _load_efactura_records_for(db: AsyncSession, receipt_ids: list[int]) -> dict[int, EFacturaRecord]:
    if not receipt_ids:
        return {}
    rows = (await db.execute(
        select(EFacturaRecord).where(
            EFacturaRecord.receipt_id.in_(receipt_ids),
            EFacturaRecord.direction == "sent",
        )
    )).scalars().all()
    return {r.receipt_id: r for r in rows if r.receipt_id is not None}


async def _load_efactura_record_for(db: AsyncSession, receipt_id: int) -> EFacturaRecord | None:
    return (await db.execute(
        select(EFacturaRecord).where(
            EFacturaRecord.receipt_id == receipt_id,
            EFacturaRecord.direction == "sent",
        )
    )).scalar_one_or_none()


async def _assert_not_locked(db: AsyncSession, receipt_id: int) -> None:
    rec = await _load_efactura_record_for(db, receipt_id)
    status, locked, _, _ = _efactura_lock_from_record(rec)
    if locked:
        raise HTTPException(
            423,
            f"Bonul a fost trimis la ANAF (status: {status}) si nu mai poate fi modificat decat metoda de plata."
        )


def _serialize(receipt: Receipt, efactura_rec: EFacturaRecord | None = None) -> dict:
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
    v = receipt.vehicol
    data["vehicol"] = VehicolRead.model_validate(v).model_dump() if v and not v.is_deleted else None
    data["cazari_anvelope"] = [
        {
            "id": caz.id,
            "data_checkin": caz.data_checkin.isoformat(),
            "data_checkout": caz.data_checkout.isoformat() if caz.data_checkout else None,
            "numar_masina": caz.numar_masina,
        }
        for caz in (receipt.cazari_anvelope or [])
        if not caz.is_deleted
    ]
    status, locked, err, idx = _efactura_lock_from_record(efactura_rec)
    data["efactura_status"] = status
    data["efactura_locked"] = locked
    data["efactura_error"] = err
    data["efactura_index_incarcare"] = idx
    data["fdl_finalized_at"] = receipt.fdl_finalized_at
    return data


@router.get("", response_model=Page[ReceiptRead])
async def list_receipts(
    last_id: int | None = None,
    limit: int = 20,
    q: str | None = None,
    item_q: str | None = None,
    filters: str | None = None,
    sort: str | None = None,
    include_deleted: bool = False,
    date_from: date | None = None,
    date_to: date | None = None,
    unpaid_days: int | None = None,
    location_id: int | None = None,
    client_id: int | None = None,
    source: str | None = None,
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
    if item_q:
        # Cautare avansata: doar devizele care contin macar un articol a carui
        # denumire se potriveste (ex: "Roata de cauciuc"). EXISTS pe receipt_items.
        stmt = stmt.where(Receipt.receipt_items.any(ReceiptItem.name.ilike(f"%{item_q}%")))
    if client_id is not None:
        stmt = stmt.where(Receipt.client_id == client_id)
    if source is not None:
        stmt = stmt.where(Receipt.source == source)

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
        now_utc = datetime.now(timezone.utc)
        past = now_utc - timedelta(days=unpaid_days)
        # FDL-urile sunt mereu NEPLATIT (sunt estimari, nu se incaseaza), asa ca
        # fara o fereastra mai stransa s-ar aduna la nesfarsit in lista "AZI".
        # Limitam la 5 zile pentru FDL; dupa expirare devin vizibile doar daca
        # filtrul date_from/date_to acopera explicit data lor. FDL-urile marcate
        # ca "finalizate" sunt scoase complet din fereastra "neplatit recent",
        # deci apar doar daca filtrul prinde explicit data crearii.
        fdl_past = now_utc - timedelta(days=5)
        date_conditions.append(and_(
            Receipt.pay_method.in_([PayMethod.NEPLATIT, PayMethod.PARTIAL]),
            or_(
                and_(Receipt.source != "fdl", Receipt.created_at >= past),
                and_(
                    Receipt.source == "fdl",
                    Receipt.created_at >= fdl_past,
                    Receipt.fdl_finalized_at.is_(None),
                ),
            ),
        ))
    if date_conditions:
        stmt = stmt.where(or_(*date_conditions))
    if location_id is not None:
        stmt = stmt.where(or_(Receipt.location_id == location_id, Receipt.location_id.is_(None)))
    stmt = apply_filters(stmt, Receipt, filters)
    if sort in ("-activity", "activity"):
        activity_col = func.coalesce(Receipt.updated_at, Receipt.created_at)
        order = activity_col.desc() if sort.startswith("-") else activity_col.asc()
        stmt = stmt.order_by(order, Receipt.id.desc())
    else:
        stmt = apply_sort(stmt, Receipt, sort)
    stmt = stmt.limit(limit + 1)

    rows = (await db.execute(stmt)).scalars().all()
    has_more = len(rows) > limit
    page = rows[:limit]
    efactura_map = await _load_efactura_records_for(db, [r.id for r in page])
    return {
        "items": [_serialize(r, efactura_map.get(r.id)) for r in page],
        "next_cursor": page[-1].id if has_more else None,
    }


@router.post("", response_model=ReceiptRead, status_code=201)
async def create_receipt(
    body: ReceiptCreate,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    _verify_total_against_items(body.items, body.total)
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
        source=body.source,
        due_date=body.due_date,
        constatari=body.constatari,
        sugestii=body.sugestii,
        timp_estimat_ore=body.timp_estimat_ore,
    )
    db.add(receipt)
    await db.flush()

    for it in body.items:
        item_id, item_type = await _resolve_item_link(
            db, account_id, it.name, it.item_id, it.item_type
        )
        db.add(ReceiptItem(
            receipt_id=receipt.id,
            account_id=account_id,
            name=it.name,
            price=it.price,
            qty=it.qty,
            unit=it.unit,
            employee_id=it.employee_id,
            item_id=item_id,
            item_type=item_type,
            vat_percent=it.vat_percent,
        ))

    await db.commit()

    emp_ids = {it.employee_id for it in body.items if it.employee_id}
    await _refresh_accumulations(db, account_id, emp_ids)
    await db.commit()

    result = (await db.execute(
        select(Receipt)
        .options(
            selectinload(Receipt.receipt_items).selectinload(ReceiptItem.employee),
            selectinload(Receipt.client),
        )
        .where(Receipt.id == receipt.id)
    )).scalar_one()

    broadcaster.notify(account_id)
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
        broadcaster.notify_pos_count(account_id)

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
                broadcaster.notify_pos_count(account_id)

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
        .options(
            selectinload(Receipt.receipt_items).selectinload(ReceiptItem.employee),
            selectinload(Receipt.cazari_anvelope),
        )
        .where(Receipt.id == receipt_id)
    )).scalar_one_or_none()
    if receipt is None or receipt.account_id != account_id:
        raise HTTPException(404, "Bonul nu a fost gasit.")
    rec = await _load_efactura_record_for(db, receipt.id)
    return _serialize(receipt, rec)


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

    # Pe bon blocat in ANAF, permitem doar campurile din `_RECEIPT_PATCH_LOCKED_ALLOWED`.
    # Asta protejeaza enforcement-ul daca cineva extinde `ReceiptPatch` cu un camp nou
    # fara sa se gandeasca la lock — request-ul va fi respins explicit cu 423.
    efac_rec = await _load_efactura_record_for(db, receipt_id)
    _, locked, _, _ = _efactura_lock_from_record(efac_rec)
    if locked:
        provided = set(body.model_fields_set)
        forbidden = provided - _RECEIPT_PATCH_LOCKED_ALLOWED
        if forbidden:
            raise HTTPException(
                423,
                f"Bonul e in flux ANAF; aceste campuri nu pot fi modificate: {sorted(forbidden)}",
            )

    emp_id_rows = (await db.execute(
        select(ReceiptItem.employee_id).where(ReceiptItem.receipt_id == receipt_id)
    )).scalars().all()
    emp_ids = {eid for eid in emp_id_rows if eid}

    old_pay = receipt.pay_method
    new_pay = body.pay_method
    if old_pay == PayMethod.NEPLATIT and new_pay != PayMethod.NEPLATIT:
        await apply_sale_for_receipt(db, account_id, receipt)
    elif old_pay != PayMethod.NEPLATIT and new_pay == PayMethod.NEPLATIT:
        await reverse_sale_for_receipt(db, account_id, receipt)

    receipt.pay_method = body.pay_method
    receipt.partial_pay = body.partial_pay
    receipt.updated_at = datetime.now(timezone.utc)
    await db.commit()

    await _refresh_accumulations(db, account_id, emp_ids)
    await db.commit()

    result = (await db.execute(
        select(Receipt)
        .options(
            selectinload(Receipt.receipt_items).selectinload(ReceiptItem.employee),
            selectinload(Receipt.client),
            selectinload(Receipt.cazari_anvelope),
        )
        .where(Receipt.id == receipt_id)
    )).scalar_one()

    broadcaster.notify(account_id)
    # Reuse efac_rec citit la inceput pt lock check — pay_method nu schimba record-ul efactura.
    return _serialize(result, efac_rec)


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
    await _assert_not_locked(db, receipt_id)

    _verify_total_against_items(body.items, body.total)

    old_emp_ids = {
        eid for eid in
        (await db.execute(select(ReceiptItem.employee_id).where(ReceiptItem.receipt_id == receipt_id))).scalars().all()
        if eid
    }

    # Daca bonul e platit, intoarcem stocul pentru liniile vechi inainte de a le sterge,
    # apoi vom reaplica scaderea pentru liniile noi mai jos.
    was_paid = receipt.pay_method != PayMethod.NEPLATIT
    if was_paid:
        await reverse_sale_for_receipt(db, account_id, receipt)

    receipt.titlu = body.titlu
    receipt.descriere = body.descriere
    receipt.date_tehn = body.date_tehn
    receipt.total = body.total
    if body.due_date is not None:
        receipt.due_date = body.due_date

    # Comutare FDL <-> deviz din POS la salvare. Revenirea la FDL e blocată dacă
    # bonul are deja numere de document alocate (deviz/factură/chitanță).
    # Un deviz creat normal are source="reception" (default-ul), nu "pos" — doar
    # un FDL convertit înapoi ajunge "pos". Gate-ul vechi cerea ambele capete în
    # {"fdl","pos"}, deci comutarea reception->fdl era ignorată în tăcere și
    # devizele obișnuite nu puteau deveni Fișă de Lucru. Acceptăm orice sursă de
    # deviz ("reception"/"pos"/"rapida") ca punct de plecare către FDL și înapoi.
    DEVIZ_SOURCES = {"pos", "reception", "rapida"}
    if body.source is not None and body.source != receipt.source:
        to_fdl = body.source == "fdl" and receipt.source in DEVIZ_SOURCES
        to_deviz = receipt.source == "fdl" and body.source in DEVIZ_SOURCES
        if to_fdl or to_deviz:
            if to_fdl and (receipt.deviz_nr or receipt.factura_nr or receipt.chitanta_nr):
                raise HTTPException(400, "Devizul are deja numere alocate; nu mai poate redeveni Fișă de Lucru.")
            if to_fdl:
                # FDL pornit dintr-un deviz: resetăm marcajul de finalizare, altfel un
                # FDL finalizat în trecut -> deviz -> FDL ar rămâne ascuns din lista
                # „neplatit recent" din Recepție (care exclude fdl_finalized_at != NULL).
                receipt.fdl_finalized_at = None
            # Re-stampăm created_at în AMBELE sensuri ale comutării (la fel ca în
            # `convert_fdl_to_deviz`): scheduler-ul de rapoarte agreghează incremental
            # pe ziua curentă și nu reia zilele trecute, iar fereastra de recență a
            # FDL-urilor din Recepție e doar 5 zile — fără re-stamp, un deviz mai vechi
            # convertit în FDL ar dispărea din lista „AZI".
            receipt.created_at = datetime.now(timezone.utc)
            receipt.source = body.source

    # Câmpurile FDL se editează DOAR pe bonuri cu source='fdl'. Pe un deviz
    # normal (inclusiv unul convertit din FDL), payload-ul poate trimite null,
    # dar le păstrăm istoric — nu le ștergem la fiecare edit ulterior.
    if receipt.source == "fdl":
        receipt.constatari = body.constatari
        receipt.sugestii = body.sugestii
        receipt.timp_estimat_ore = body.timp_estimat_ore
    receipt.updated_at = datetime.now(timezone.utc)

    await db.execute(delete(ReceiptItem).where(ReceiptItem.receipt_id == receipt_id))
    await db.flush()

    new_emp_ids: set[int] = set()
    for item in body.items:
        item_id, item_type = await _resolve_item_link(
            db, account_id, item.name, item.item_id, item.item_type
        )
        db.add(ReceiptItem(
            account_id=account_id,
            receipt_id=receipt_id,
            name=item.name,
            price=item.price,
            qty=item.qty,
            unit=item.unit,
            employee_id=item.employee_id,
            item_id=item_id,
            item_type=item_type,
            vat_percent=item.vat_percent,
        ))
        if item.employee_id:
            new_emp_ids.add(item.employee_id)

    await db.flush()
    # Reaplica scaderea pentru liniile noi daca bonul era platit
    if was_paid:
        await apply_sale_for_receipt(db, account_id, receipt)

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

    broadcaster.notify(account_id)
    rec = await _load_efactura_record_for(db, receipt_id)
    return _serialize(result, rec)


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
    await _assert_not_locked(db, receipt_id)
    receipt.client_id = body.client_id
    if body.client_id:
        vehicol = (await db.execute(
            select(Vehicol).where(Vehicol.receipt_id == receipt_id, Vehicol.is_deleted == False)
        )).scalar_one_or_none()
        if vehicol:
            await _ensure_client_vehicol(db, account_id, body.client_id, vehicol)
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
    rec = await _load_efactura_record_for(db, receipt_id)
    return _serialize(receipt, rec)


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

    # FDL e doar o estimare; nu primește nr de deviz/factura/chitanta. Utilizatorul
    # trebuie întâi să apeleze /convert-to-deviz pentru a o transforma în deviz real.
    if receipt.source == "fdl":
        raise HTTPException(400, "Fișa de Lucru trebuie transformată întâi în deviz.")

    # Determinam nr-ul curent INAINTE de lock check: re-emiterea PDF-ului unei facturi
    # DEJA numerotate e read-only (nu aloca nimic, nu schimba datele bonului) si trebuie
    # permisa chiar daca bonul e blocat la ANAF — altfel butonul "Factura" nu mai descarca
    # dupa trimiterea in SPV. Blocam DOAR alocarea unui nr NOU de factura (current_nr == 0).
    serie_field = f"{doc_type}_serie"
    nr_field = f"{doc_type}_nr"
    current_nr = getattr(receipt, nr_field, 0)

    if doc_type == "factura" and current_nr == 0:
        await _assert_not_locked(db, receipt_id)

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

        # Asociere automată client-vehicul dacă lipsește
        if receipt.client_id:
            vehicol = (await db.execute(
                select(Vehicol).where(Vehicol.receipt_id == receipt_id, Vehicol.is_deleted == False)
            )).scalar_one_or_none()
            if vehicol:
                await _ensure_client_vehicol(db, account_id, receipt.client_id, vehicol)

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


@router.post("/{receipt_id}/finalize-fdl", response_model=ReceiptRead)
async def finalize_fdl(
    receipt_id: int,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    """Marcheaza o Fisa de Lucru ca finalizata. Dupa finalizare, FDL-ul nu mai
    apare in lista "AZI" prin fereastra "neplatit recent" — devine vizibil
    doar daca filtrul de data acopera explicit ziua crearii.

    Spre deosebire de `convert_to_deviz`, NU actualizam `updated_at`: scopul
    finalizarii e tocmai sa scoatem FDL-ul din vizor, nu sa-l aducem la varful
    sort-ului `-activity`. Data crearii ramane neschimbata pentru ca filtrele
    explicite de data (date_from/date_to) sa-l prinda pe ziua corecta.
    """
    receipt = (await db.execute(
        select(Receipt)
        .options(
            selectinload(Receipt.receipt_items).selectinload(ReceiptItem.employee),
            selectinload(Receipt.client),
            selectinload(Receipt.cazari_anvelope),
        )
        .where(Receipt.id == receipt_id)
    )).scalar_one_or_none()
    if receipt is None or receipt.account_id != account_id or receipt.is_deleted:
        raise HTTPException(404, "Bonul nu a fost gasit.")
    if receipt.source != "fdl":
        raise HTTPException(400, "Doar Fisele de Lucru pot fi finalizate.")
    if receipt.fdl_finalized_at is None:
        receipt.fdl_finalized_at = datetime.now(timezone.utc)
        await db.commit()

    broadcaster.notify(account_id)
    rec = await _load_efactura_record_for(db, receipt_id)
    return _serialize(receipt, rec)


@router.post("/{receipt_id}/convert-to-deviz", response_model=ReceiptRead)
async def convert_fdl_to_deviz(
    receipt_id: int,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    """Transformă o Fișă de Lucru (FDL) într-un deviz normal.

    Schimbă `source` din "fdl" în "pos" (intră în rapoarte/totaluri ca deviz
    obișnuit). Nu asignează automat `deviz_nr` — utilizatorul îl alocă din
    Recepție prin butonul „Deviz" (assign-number) sau direct prin „Facturează".
    """
    receipt = await db.get(Receipt, receipt_id)
    if receipt is None or receipt.account_id != account_id or receipt.is_deleted:
        raise HTTPException(404, "Bonul nu a fost găsit.")
    if receipt.source != "fdl":
        raise HTTPException(400, "Doar Fișele de Lucru pot fi transformate în deviz.")

    now = datetime.now(timezone.utc)
    receipt.source = "pos"
    # Un deviz nu mai poartă marcaj de finalizare FDL; îl curățăm ca un eventual
    # round-trip deviz -> FDL să nu redevină ascuns din lista „neplatit recent".
    receipt.fdl_finalized_at = None
    # Re-stampăm created_at la momentul conversiei: scheduler-ul de rapoarte
    # agreghează incremental pe ziua curentă și nu reia zilele trecute. Fără
    # re-stamp, devizul rămas „suspendat" pe ziua FDL-ului ar lipsi pentru
    # totdeauna din rapoartele zilei respective.
    receipt.created_at = now
    receipt.updated_at = now
    await db.commit()

    result = (await db.execute(
        select(Receipt)
        .options(
            selectinload(Receipt.receipt_items).selectinload(ReceiptItem.employee),
            selectinload(Receipt.client),
            selectinload(Receipt.cazari_anvelope),
        )
        .where(Receipt.id == receipt_id)
    )).scalar_one()

    # Refresh totaluri lunare/anuale pentru angajații implicați — bonul intră
    # acum în scope (sursa != 'fdl').
    emp_ids: set[int] = {ri.employee_id for ri in result.receipt_items if ri.employee_id}
    await _refresh_accumulations(db, account_id, emp_ids)

    broadcaster.notify(account_id)
    rec = await _load_efactura_record_for(db, receipt_id)
    return _serialize(result, rec)


@router.put("/{receipt_id}/vehicol", response_model=VehicolRead)
async def upsert_vehicol(
    receipt_id: int,
    body: VehicolCreate,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    receipt = await db.get(Receipt, receipt_id)
    if receipt is None or receipt.account_id != account_id or receipt.is_deleted:
        raise HTTPException(404, "Bonul nu a fost gasit.")
    await _assert_not_locked(db, receipt_id)

    existing = (await db.execute(
        select(Vehicol).where(Vehicol.receipt_id == receipt_id)
    )).scalar_one_or_none()

    if existing and not existing.is_deleted:
        for k, v in body.model_dump().items():
            setattr(existing, k, v)
        existing.updated_at = datetime.now(timezone.utc)
        if receipt.client_id:
            await _ensure_client_vehicol(db, account_id, receipt.client_id, existing)
        await db.commit()
        await db.refresh(existing)
        broadcaster.notify(account_id)
        return existing
    else:
        vehicol = Vehicol(
            account_id=account_id,
            receipt_id=receipt_id,
            **body.model_dump(),
        )
        db.add(vehicol)
        if receipt.client_id:
            await _ensure_client_vehicol(db, account_id, receipt.client_id, vehicol)
        await db.commit()
        await db.refresh(vehicol)
        broadcaster.notify(account_id)
        return vehicol


@router.delete("/{receipt_id}", status_code=204)
async def delete_receipt(
    receipt_id: int,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    receipt = await db.get(Receipt, receipt_id)
    if receipt is None or receipt.account_id != account_id:
        raise HTTPException(404, "Bonul nu a fost gasit.")
    await _assert_not_locked(db, receipt_id)

    emp_id_rows = (await db.execute(
        select(ReceiptItem.employee_id).where(ReceiptItem.receipt_id == receipt_id)
    )).scalars().all()
    emp_ids = {eid for eid in emp_id_rows if eid}

    # Storno stoc daca bonul era platit (marfa revine in stoc).
    if receipt.pay_method != PayMethod.NEPLATIT:
        await reverse_sale_for_receipt(db, account_id, receipt)

    await soft_delete(db, Receipt, receipt_id)
    await _refresh_accumulations(db, account_id, emp_ids)
    await db.commit()
    broadcaster.notify(account_id)
