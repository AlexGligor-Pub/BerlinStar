from __future__ import annotations
import asyncio
import json
from collections import Counter
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import select, func, extract, update, delete, or_, and_
from sqlalchemy.orm import selectinload
from sqlalchemy.orm.attributes import set_committed_value
from sqlalchemy.ext.asyncio import AsyncSession

from app.broadcaster import broadcaster
from app.database import get_db
from app.auth_context import AuthContext
from app.dependencies import get_account_id, get_account_id_from_query, get_actor_username, get_auth_context, get_settings_account_id
from app.permissions import Resource
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
from app.utils.plate import normalize_plate, normalized_plate_column
from app.utils.soft_delete import soft_delete
from app.utils.sort import apply_sort
from app.services.payments_service import resync_after_total_change, sync_from_status
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


async def _resolve_item_links(
    db: AsyncSession, account_id: int, items: list
) -> dict[str, tuple[int, ItemType]]:
    """Catalogul (id, type) pe denumire, intr-un singur SELECT, pentru liniile
    carora le lipseste item_id sau item_type din payload."""
    names = {it.name for it in items if it.item_id is None or it.item_type is None}
    if not names:
        return {}
    rows = (await db.execute(
        select(Item.name, Item.id, Item.type).where(
            Item.account_id == account_id,
            Item.name.in_(names),
            Item.is_deleted == False,
        ).order_by(Item.id)
    )).all()
    found: dict[str, tuple[int, ItemType]] = {}
    for r in rows:
        found.setdefault(r.name, (r.id, r.type))
    return found


def _resolve_item_link(
    catalog: dict[str, tuple[int, ItemType]],
    name: str,
    item_id: int | None,
    item_type: ItemType | None,
) -> tuple[int | None, ItemType | None]:
    """Completează item_id și item_type din catalog dacă lipsesc din payload."""
    if item_id is not None and item_type is not None:
        return item_id, item_type
    row = catalog.get(name)
    if row is None:
        return item_id, item_type
    return (item_id if item_id is not None else row[0],
            item_type if item_type is not None else row[1])


def _q2(v) -> Decimal | None:
    return None if v is None else Decimal(v).quantize(Decimal("0.01"))


def _line_key(name: str | None, item_id: int | None) -> tuple:
    """Identitatea unui articol pe bon: denumirea normalizata + articolul din
    catalog. Doua linii cu aceeasi cheie sunt acelasi produs vandut de doua ori
    (ex. pe angajati diferiti), deci le numaram, nu le confundam."""
    return ((name or "").strip().lower(), item_id)


DENIED_DISCOUNT = "Doar administratorul sau managerul poate acorda sau modifica reduceri."


async def _assert_may_change_prices(
    db: AsyncSession,
    account_id: int,
    receipt_id: int | None,
    new_items: list,
    ctx: AuthContext,
) -> None:
    """Reducerile explicite (`original_price`) rămân pe admin/manager.

    Pretul pe linie e liber pentru toate rolurile — operatorul de la tejghea
    negociaza preturi, deci un `worker` poate tasta orice valoare, si sub cea
    din catalog. Ce nu poate e sa acorde, sa adanceasca sau sa stearga o
    reducere marcata ca atare, fiindca aceea apare pe deviz si in rapoarte.
    """
    if ctx.can(Resource.SETTINGS):
        return

    existing: list[ReceiptItem] = []
    if receipt_id is not None:
        existing = list((await db.execute(
            select(ReceiptItem).where(ReceiptItem.receipt_id == receipt_id)
        )).scalars().all())

    # ── 1. Reducerile explicite ───────────────────────────────────────────────
    # Multiset, nu multime: doua linii identice reduse trebuie sa rămână doua,
    # iar o a treia adaugata de worker sa fie respinsa.
    def _disc_counter(items) -> Counter:
        return Counter(
            (_line_key(it.name, it.item_id), _q2(it.price), _q2(it.original_price))
            for it in items if it.original_price is not None
        )

    old_disc, new_disc = _disc_counter(existing), _disc_counter(new_items)
    if new_disc - old_disc:
        # Exista o reducere trimisa care nu se regaseste in cele existente:
        # ori e noua, ori i s-a schimbat suma.
        raise HTTPException(403, DENIED_DISCOUNT)

    # Reducerea nu poate fi nici *stearsa* de pe o linie care rămâne pe bon.
    # Numaram pe cheie, ca doua articole cu acelasi nume (unul redus, unul nu)
    # sa nu se blocheze reciproc.
    old_total, old_disc_n = Counter(), Counter()
    for it in existing:
        old_total[_line_key(it.name, it.item_id)] += 1
        if it.original_price is not None:
            old_disc_n[_line_key(it.name, it.item_id)] += 1
    new_total, new_disc_n = Counter(), Counter()
    for it in new_items:
        new_total[_line_key(it.name, it.item_id)] += 1
        if it.original_price is not None:
            new_disc_n[_line_key(it.name, it.item_id)] += 1
    for key, n_old in old_disc_n.items():
        # Cate linii reduse trebuie sa supravietuiasca: cele existente, dar nu
        # mai multe decat liniile pastrate (stergerea unei linii reduse e ok).
        must_keep = min(n_old, new_total.get(key, 0))
        if new_disc_n.get(key, 0) < must_keep:
            raise HTTPException(403, DENIED_DISCOUNT)


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


# Campurile pe care snapshotul de pe bon le propaga in garajul clientului.
_VEHICOL_SYNC_FIELDS = ("marca", "model", "numar_kilometrii", "an_fabricatie", "vin", "observatii")


async def _sync_client_vehicol(
    db: AsyncSession, account_id: int, client_id: int, vehicol: Vehicol
) -> None:
    """Tine masina din garajul clientului in pas cu ce s-a editat pe bon.

    Inainte, potrivirea se facea doar pe numarul de inmatriculare, comparat ca
    sir exact, si functia doar INSERA. Doua consecinte, amandoua raportate din
    POS: o corectura a numarului pe un deviz salvat crea o masina noua in loc sa
    o redenumeasca pe cea existenta, iar completarea marcii/VIN-ului nu ajungea
    niciodata in garaj, fiindca randul „exista deja".

    Ordinea de rezolvare a tintei conteaza:
      1. o masina a ACESTUI client cu numarul nou — atunci bonul a fost mutat pe
         alta masina a lui, nu e o redenumire; ne legam de ea si nu stricam nimic;
      2. masina la care bonul era deja legat — asta e cazul obisnuit de editare,
         inclusiv schimbarea numarului, deci o actualizam pe loc;
      3. nimic — masina chiar e noua pentru client.
    """
    plate = (vehicol.numar_masina or "").strip()
    if not plate:
        return

    target = (await db.execute(
        select(ClientVehicol).where(
            ClientVehicol.account_id == account_id,
            ClientVehicol.client_id == client_id,
            ClientVehicol.is_deleted == False,
            normalized_plate_column(ClientVehicol.numar_masina) == normalize_plate(plate),
        ).order_by(ClientVehicol.id)
    )).scalars().first()

    if target is None and vehicol.client_vehicol_id is not None:
        linked = await db.get(ClientVehicol, vehicol.client_vehicol_id)
        # Legatura nu se refoloseste daca masina a fost stearsa intre timp sau
        # daca bonul a fost mutat pe alt client — altfel am edita masina altcuiva.
        if (
            linked is not None
            and not linked.is_deleted
            and linked.account_id == account_id
            and linked.client_id == client_id
        ):
            target = linked

    if target is None:
        target = ClientVehicol(account_id=account_id, client_id=client_id, numar_masina=plate)
        db.add(target)

    target.numar_masina = plate
    # Doar valorile completate se propaga. Un bon rapid, pe care s-a trecut doar
    # numarul, nu are voie sa stearga marca si VIN-ul stranse anterior in fisa
    # masinii; corectiile explicite se fac din Clienti.
    for field in _VEHICOL_SYNC_FIELDS:
        value = getattr(vehicol, field, None)
        if value is not None and value != "":
            setattr(target, field, value)
    target.updated_at = datetime.now(timezone.utc)

    # `flush` ca sa avem id-ul cand masina tocmai a fost creata.
    await db.flush()
    vehicol.client_vehicol_id = target.id


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
    ctx: AuthContext = Depends(get_auth_context),
):
    # Un bon nou nu poate porni nici cu reducere, nici cu preturi sub catalog,
    # daca rolul nu are dreptul — altfel restrictia de la editare s-ar ocoli
    # creand bonul direct ieftinit. `receipt_id=None`: nu exista linii anterioare,
    # deci referinta e strict catalogul.
    await _assert_may_change_prices(db, account_id, None, body.items, ctx)
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

    catalog = await _resolve_item_links(db, account_id, body.items)
    for it in body.items:
        item_id, item_type = _resolve_item_link(catalog, it.name, it.item_id, it.item_type)
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
            original_price=it.original_price,
        ))

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
    # Cine face actiunea — pentru jurnalul de stoc (SALE / SALE_REVERSE).
    actor: str = Depends(get_actor_username),
):
    receipt = await db.get(Receipt, receipt_id, with_for_update=True)
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
    # Valoarea de dinainte de modificare — necesara pentru bonurile vechi care au
    # `partial_pay` dar nu au inca inregistrari in registrul de plati.
    old_partial = receipt.partial_pay
    if old_pay == PayMethod.NEPLATIT and new_pay != PayMethod.NEPLATIT:
        await apply_sale_for_receipt(db, account_id, receipt, created_by_user=actor)
    elif old_pay != PayMethod.NEPLATIT and new_pay == PayMethod.NEPLATIT:
        await reverse_sale_for_receipt(db, account_id, receipt, created_by_user=actor)

    receipt.pay_method = body.pay_method
    receipt.partial_pay = body.partial_pay
    receipt.updated_at = datetime.now(timezone.utc)
    # Oglindim schimbarea de status in "Situatie plati": inregistram automat
    # diferenta de bani, ca registrul sa arate complet cat s-a incasat si cat a
    # mai rămas de plata.
    await sync_from_status(db, account_id, receipt, legacy_partial=old_partial)
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
    # Cine face actiunea — pentru jurnalul de stoc (SALE / SALE_REVERSE).
    actor: str = Depends(get_actor_username),
    ctx: AuthContext = Depends(get_auth_context),
):
    receipt = await db.get(Receipt, receipt_id, with_for_update=True)
    if receipt is None or receipt.account_id != account_id:
        raise HTTPException(404, "Bonul nu a fost gasit.")
    await _assert_not_locked(db, receipt_id)
    await _assert_may_change_prices(db, account_id, receipt_id, body.items, ctx)

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
        await reverse_sale_for_receipt(db, account_id, receipt, created_by_user=actor)

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
    catalog = await _resolve_item_links(db, account_id, body.items)
    for item in body.items:
        item_id, item_type = _resolve_item_link(catalog, item.name, item.item_id, item.item_type)
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
            original_price=item.original_price,
        ))
        if item.employee_id:
            new_emp_ids.add(item.employee_id)

    await db.flush()
    # Reaplica scaderea pentru liniile noi daca bonul era platit
    if was_paid:
        await apply_sale_for_receipt(db, account_id, receipt, created_by_user=actor)

    # Totalul s-a schimbat (ex. s-a aplicat o reducere): restul de plata si
    # statusul trebuie recitite din registru, nu lasate pe valorile vechi.
    await resync_after_total_change(db, account_id, receipt)

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
            await _sync_client_vehicol(db, account_id, body.client_id, vehicol)
    await db.commit()
    # Receipt.client e lazy="selectin", deci era deja incarcat cu clientul VECHI;
    # cu expire_on_commit=False reincarcarea de mai jos ar returna acelasi obiect
    # din identity map, cu relatia nereimprospatata.
    db.expire_all()
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
    receipt = await db.get(Receipt, receipt_id, with_for_update=True)
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
        reg_numar_col = getattr(Register, reg_numar_field)
        # Incrementare atomica in DB: doua alocari concurente nu pot citi acelasi numar.
        new_nr = (await db.execute(
            update(Register)
            .where(Register.id == register.id)
            .values({reg_numar_field: reg_numar_col + 1})
            .returning(reg_numar_col)
            .execution_options(synchronize_session=False)
        )).scalar_one()
        set_committed_value(register, reg_numar_field, new_nr)
        setattr(receipt, serie_field, reg_serie)
        setattr(receipt, nr_field, new_nr)
        receipt.updated_at = datetime.now(timezone.utc)

        # Asociere automată client-vehicul dacă lipsește
        if receipt.client_id:
            vehicol = (await db.execute(
                select(Vehicol).where(Vehicol.receipt_id == receipt_id, Vehicol.is_deleted == False)
            )).scalar_one_or_none()
            if vehicol:
                await _sync_client_vehicol(db, account_id, receipt.client_id, vehicol)

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
    receipt = await db.get(Receipt, receipt_id, with_for_update=True)
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

    # `receipt_id` e unic in `vehicole`, deci un rand sters logic tot ocupa locul:
    # il refolosim in loc sa inseram unul nou, care ar pica pe constrangere.
    vehicol = (await db.execute(
        select(Vehicol).where(Vehicol.receipt_id == receipt_id)
    )).scalar_one_or_none()

    if vehicol is None:
        vehicol = Vehicol(account_id=account_id, receipt_id=receipt_id, numar_masina="")
        db.add(vehicol)
    elif vehicol.is_deleted:
        vehicol.is_deleted = False
        vehicol.deleted_at = None
        # Legatura veche nu se mai aplica: masina a fost scoasa de pe bon, iar
        # acum se trece alta. O redescoperim mai jos, din numarul curent.
        vehicol.client_vehicol_id = None

    for k, v in body.model_dump().items():
        setattr(vehicol, k, v)
    vehicol.updated_at = datetime.now(timezone.utc)

    # Sincronizarea ruleaza DUPA ce s-au aplicat valorile noi: ea trebuie sa vada
    # numarul editat, ca sa redenumeasca masina clientului in loc sa creeze una.
    if receipt.client_id:
        await _sync_client_vehicol(db, account_id, receipt.client_id, vehicol)

    await db.commit()
    await db.refresh(vehicol)
    broadcaster.notify(account_id)
    return vehicol


@router.delete("/{receipt_id}", status_code=204)
async def delete_receipt(
    receipt_id: int,
    db: AsyncSession = Depends(get_db),
    # Stergerea e actiune privilegiata (admin + manager): butonul e ascuns
    # pentru `worker` in UI, iar aici o refuzam si pe server.
    account_id: int = Depends(get_settings_account_id),
    # Cine face actiunea — pentru jurnalul de stoc (SALE / SALE_REVERSE).
    actor: str = Depends(get_actor_username),
):
    receipt = await db.get(Receipt, receipt_id, with_for_update=True)
    if receipt is None or receipt.account_id != account_id:
        raise HTTPException(404, "Bonul nu a fost gasit.")
    await _assert_not_locked(db, receipt_id)

    emp_id_rows = (await db.execute(
        select(ReceiptItem.employee_id).where(ReceiptItem.receipt_id == receipt_id)
    )).scalars().all()
    emp_ids = {eid for eid in emp_id_rows if eid}

    # Storno stoc daca bonul era platit (marfa revine in stoc).
    if receipt.pay_method != PayMethod.NEPLATIT:
        await reverse_sale_for_receipt(db, account_id, receipt, created_by_user=actor)

    await soft_delete(db, Receipt, receipt_id)
    await _refresh_accumulations(db, account_id, emp_ids)
    await db.commit()
    broadcaster.notify(account_id)
