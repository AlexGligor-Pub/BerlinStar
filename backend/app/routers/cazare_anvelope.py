from __future__ import annotations
from datetime import datetime, timezone, date, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, and_, delete as sql_delete, func, or_
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_account_id, get_settings_account_id
from app.models.cazare_anvelope import CazareAnvelope, CazareAnvelopaItem
from app.models.anvelopa import Anvelopa
from app.models.client import Client
from app.models.employee import Employee
from app.models.loc_cazare import LocCazare
from app.models.location import Location
from app.models.receipt import Receipt
from app.schemas.cazare_anvelope import (
    CazareCreate, CazareRead, CazareCheckoutBody, CazareUpdateBody, CazariSummary,
)
from app.schemas.common import Page
from app.utils.ownership import assert_all_owned, assert_owned
from app.utils.paginate import checked_limit
from app.utils.soft_delete import soft_delete

router = APIRouter()

# O cazare iesita din depozit (checkout efectuat) ramane editabila inca atatea
# zile dupa checkout — fereastra de corectare a greselilor. Peste acest interval
# istoricul devine read-only.
EDIT_GRACE_DAYS = 7


def _own(account_id: int, rel):
    # Legaturi salvate inainte de verificarea de apartenenta pot arata spre randuri
    # ale altui cont: id-ul ramane pe cazare, dar datele acelui cont nu se afiseaza.
    return rel if rel is not None and rel.account_id == account_id else None


def _serialize_anvelopa(a: Anvelopa | None) -> dict | None:
    if a is None:
        return None
    # Marca e nomenclator global (fara account_id); restul sunt per cont.
    dimensiune, profil, dot = _own(a.account_id, a.dimensiune), _own(a.account_id, a.profil), _own(a.account_id, a.dot)
    return {
        "id": a.id,
        "account_id": a.account_id,
        "client_id": a.client_id,
        "marca_id": a.marca_id,
        "dimensiune_id": a.dimensiune_id,
        "profil_id": a.profil_id,
        "dot_id": a.dot_id,
        "tip": a.tip,
        "adancime": a.adancime,
        "indice_viteza": a.indice_viteza,
        "indice_sarcina": a.indice_sarcina,
        "comments": a.comments,
        "marca_nume": a.marca.nume if a.marca else None,
        "dimensiune_valoare": dimensiune.valoare if dimensiune else None,
        "profil_valoare": profil.valoare if profil else None,
        "dot_valoare": dot.valoare if dot else None,
        "created_at": a.created_at,
        "updated_at": a.updated_at,
        "is_deleted": a.is_deleted,
    }


async def _fetch_successor_map(
    db: AsyncSession, account_id: int, ids: list[int]
) -> dict[int, tuple[int, bool]]:
    if not ids:
        return {}
    rows = (await db.execute(
        select(
            CazareAnvelope.referinta_cazare_id,
            CazareAnvelope.id,
            CazareAnvelope.montate_pe_masina,
        ).where(
            CazareAnvelope.account_id == account_id,
            CazareAnvelope.is_deleted == False,
            CazareAnvelope.referinta_cazare_id.in_(ids),
        )
    )).all()
    return {row[0]: (row[1], row[2]) for row in rows}


def _serialize_items(account_id: int, items) -> list[dict]:
    return [
        {
            "id": item.id,
            "anvelopa_id": item.anvelopa_id,
            "anvelopa": _serialize_anvelopa(_own(account_id, item.anvelopa)),
        }
        for item in items
    ]


def _serialize(c: CazareAnvelope, successor: tuple[int, bool] | None = None) -> dict:
    client = _own(c.account_id, c.client)
    emp = _own(c.account_id, c.employee)
    loc = _own(c.account_id, c.loc_cazare)
    location = _own(c.account_id, c.location)
    referinta = _own(c.account_id, c.referinta_cazare)
    return {
        "id": c.id,
        "account_id": c.account_id,
        "client_id": c.client_id,
        "employee_id": c.employee_id,
        "loc_cazare_id": c.loc_cazare_id,
        "location_id": c.location_id,
        "data_checkin": c.data_checkin,
        "data_checkout": c.data_checkout,
        "comments": c.comments,
        "dep_anvelope": c.dep_anvelope,
        "dep_capace": c.dep_capace,
        "dep_roti_complete": c.dep_roti_complete,
        "dep_antifurturi": c.dep_antifurturi,
        "dep_prezoane": c.dep_prezoane,
        "referinta_cazare_id": c.referinta_cazare_id,
        "montate_pe_masina": c.montate_pe_masina,
        "successor_cazare_id": successor[0] if successor else None,
        "successor_montate_pe_masina": successor[1] if successor else None,
        "numar_masina": c.numar_masina,
        "receipt_id": c.receipt_id,
        "referinta_cazare_data_checkin": str(referinta.data_checkin) if referinta else None,
        "referinta_cazare_items": _serialize_items(c.account_id, referinta.items if referinta else []),
        "created_at": c.created_at,
        "updated_at": c.updated_at,
        "is_deleted": c.is_deleted,
        "client_nume": client.nume if client else None,
        "client_cui": client.cui if client else None,
        "client_telefon": client.telefon if client else None,
        "client_adresa": client.adresa if client else None,
        "client_reprezentant": client.reprezentant if client else None,
        "employee_name": emp.name if emp else None,
        "loc_cazare_nume": loc.nume if loc else None,
        "location_name": location.name if location else None,
        "items": _serialize_items(c.account_id, c.items),
    }


def _load_stmt(account_id: int):
    return (
        select(CazareAnvelope)
        .options(
            selectinload(CazareAnvelope.client),
            selectinload(CazareAnvelope.employee),
            selectinload(CazareAnvelope.loc_cazare),
            selectinload(CazareAnvelope.location),
            selectinload(CazareAnvelope.referinta_cazare).selectinload(CazareAnvelope.items).selectinload(CazareAnvelopaItem.anvelopa).selectinload(Anvelopa.marca),
            selectinload(CazareAnvelope.referinta_cazare).selectinload(CazareAnvelope.items).selectinload(CazareAnvelopaItem.anvelopa).selectinload(Anvelopa.dimensiune),
            selectinload(CazareAnvelope.referinta_cazare).selectinload(CazareAnvelope.items).selectinload(CazareAnvelopaItem.anvelopa).selectinload(Anvelopa.profil),
            selectinload(CazareAnvelope.referinta_cazare).selectinload(CazareAnvelope.items).selectinload(CazareAnvelopaItem.anvelopa).selectinload(Anvelopa.dot),
            selectinload(CazareAnvelope.items).selectinload(
                CazareAnvelopaItem.anvelopa
            ).selectinload(Anvelopa.marca),
            selectinload(CazareAnvelope.items).selectinload(
                CazareAnvelopaItem.anvelopa
            ).selectinload(Anvelopa.dimensiune),
            selectinload(CazareAnvelope.items).selectinload(
                CazareAnvelopaItem.anvelopa
            ).selectinload(Anvelopa.profil),
            selectinload(CazareAnvelope.items).selectinload(
                CazareAnvelopaItem.anvelopa
            ).selectinload(Anvelopa.dot),
        )
        .where(CazareAnvelope.account_id == account_id, CazareAnvelope.is_deleted == False)
    )


# Numarul de masina se scrie in fel si chip („B 12 ABC", „B-12-ABC"): comparam
# mereu forma fara spatii si fara liniute, pe ambele parti.
def _plate_sql():
    return func.upper(func.replace(func.replace(CazareAnvelope.numar_masina, " ", ""), "-", ""))


def _plate_key(raw: str) -> str:
    return (raw or "").strip().upper().replace(" ", "").replace("-", "")


def _like(term: str) -> str:
    """`%` si `_` scrise de utilizator sunt text cautat, nu jokeri."""
    return "%" + term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"


def _filtered(
    stmt, *, activa=None, client_id=None, receipt_id=None, location_id=None,
    loc_cazare_id=None, numar_masina=None, q=None, date_from=None, date_to=None,
):
    """Filtrele comune listei si sumarului — ca numaratoarea de jos sa nu poata
    ajunge sa spuna altceva decat arata lista."""
    if activa is True:
        stmt = stmt.where(CazareAnvelope.data_checkout.is_(None))
    elif activa is False:
        stmt = stmt.where(CazareAnvelope.data_checkout.isnot(None))
    if client_id is not None:
        stmt = stmt.where(CazareAnvelope.client_id == client_id)
    if receipt_id is not None:
        stmt = stmt.where(CazareAnvelope.receipt_id == receipt_id)
    if location_id is not None:
        stmt = stmt.where(CazareAnvelope.location_id == location_id)
    if loc_cazare_id is not None:
        stmt = stmt.where(CazareAnvelope.loc_cazare_id == loc_cazare_id)
    if numar_masina is not None:
        plate = _plate_key(numar_masina)
        if plate:
            stmt = stmt.where(_plate_sql() == plate)
    if q and q.strip():
        # O singura caseta de cautare: numele clientului SAU numarul de masina.
        term = q.strip()
        conditions = [Client.nume.ilike(_like(term), escape="\\")]
        # „-" sau „ - " nu lasa nimic din numar dupa normalizare; un LIKE '%%'
        # ar potrivi toate cazarile cu numar de masina.
        plate = _plate_key(term)
        if plate:
            conditions.append(_plate_sql().like(_like(plate), escape="\\"))
        # Join doar pe clientii contului: o legatura veche spre clientul altui cont
        # nu trebuie sa poata fi gasita dupa numele lui.
        stmt = stmt.outerjoin(
            Client,
            and_(Client.id == CazareAnvelope.client_id, Client.account_id == CazareAnvelope.account_id),
        ).where(or_(*conditions))
    if date_from:
        stmt = stmt.where(CazareAnvelope.data_checkin >= date_from)
    if date_to:
        stmt = stmt.where(CazareAnvelope.data_checkin <= date_to)
    return stmt


@router.get("", response_model=Page[CazareRead])
async def list_cazari(
    activa: bool | None = None,
    client_id: int | None = None,
    receipt_id: int | None = None,
    location_id: int | None = None,
    loc_cazare_id: int | None = None,
    numar_masina: str | None = None,
    q: str | None = None,
    # `date`, nu `str`: comparat cu o coloana DATE, un text dadea eroare 500 in
    # asyncpg; asa FastAPI il valideaza si raspunde 422 la o data gresita.
    date_from: date | None = None,
    date_to: date | None = None,
    last_id: int | None = None,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    limit = min(checked_limit(limit), 200)
    stmt = _filtered(
        _load_stmt(account_id), activa=activa, client_id=client_id, receipt_id=receipt_id,
        location_id=location_id, loc_cazare_id=loc_cazare_id, numar_masina=numar_masina, q=q,
        date_from=date_from, date_to=date_to,
    )
    if last_id is not None:
        stmt = stmt.where(CazareAnvelope.id < last_id)
    stmt = stmt.order_by(CazareAnvelope.id.desc()).limit(limit + 1)
    rows = (await db.execute(stmt)).scalars().all()
    has_more = len(rows) > limit
    page = rows[:limit]
    succ_map = await _fetch_successor_map(db, account_id, [r.id for r in page])
    return Page(
        items=[_serialize(r, succ_map.get(r.id)) for r in page],
        next_cursor=page[-1].id if has_more else None,
    )


@router.get("/summary", response_model=CazariSummary)
async def cazari_summary(
    activa: bool | None = None,
    client_id: int | None = None,
    receipt_id: int | None = None,
    location_id: int | None = None,
    loc_cazare_id: int | None = None,
    numar_masina: str | None = None,
    q: str | None = None,
    # `date`, nu `str`: comparat cu o coloana DATE, un text dadea eroare 500 in
    # asyncpg; asa FastAPI il valideaza si raspunde 422 la o data gresita.
    date_from: date | None = None,
    date_to: date | None = None,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    """Cate cazari (si cate anvelope, si cati clienti) intra in filtrul curent.

    Lista vine pe pagini de cate 200, cu derulare infinita, deci numaratoarea nu
    se poate face pe ce e incarcat in pagina: la 1.500 de cazari ar minti. Aici
    sunt doua COUNT-uri pe aceleasi conditii ca lista.
    """
    base = _filtered(
        select(CazareAnvelope.id, CazareAnvelope.client_id).where(
            CazareAnvelope.account_id == account_id, CazareAnvelope.is_deleted == False,
        ),
        activa=activa, client_id=client_id, receipt_id=receipt_id, location_id=location_id,
        loc_cazare_id=loc_cazare_id, numar_masina=numar_masina, q=q, date_from=date_from, date_to=date_to,
    ).subquery()
    cazari, clienti = (await db.execute(
        select(func.count(), func.count(func.distinct(base.c.client_id))).select_from(base)
    )).one()
    anvelope = await db.scalar(
        select(func.count(CazareAnvelopaItem.id)).where(CazareAnvelopaItem.cazare_id.in_(select(base.c.id)))
    )
    return CazariSummary(cazari=cazari, anvelope=anvelope or 0, clienti=clienti)


async def _assert_owned_or_reused(
    db: AsyncSession, model, column, obj_id: int | None, account_id: int, *, what: str,
) -> None:
    """Ca `assert_owned`, dar un rand STERS al contului ramane acceptat daca apare
    deja pe o cazare a contului.

    „Scoatere + cazare noua" preia clientul, angajatul si locul de pe cazarea
    veche; daca unul a fost sters intre timp, cazarea noua ar fi refuzata DUPA
    ce scoaterea s-a salvat deja. Un id sters care nu e pe nicio cazare a
    contului, si orice id al altui cont, raman refuzate.
    """
    try:
        await assert_owned(db, model, obj_id, account_id, what=what)
    except HTTPException:
        reused = await db.scalar(
            select(CazareAnvelope.id)
            .where(CazareAnvelope.account_id == account_id, column == obj_id)
            .limit(1)
        )
        if reused is None:
            raise
        await assert_owned(db, model, obj_id, account_id, what=what, allow_deleted=True)


async def _assert_not_in_active_cazare(
    db: AsyncSession, account_id: int, anvelopa_ids: list[int],
) -> None:
    """O anvelopa poate sta intr-o singura cazare activa (fara checkout)."""
    if not anvelopa_ids:
        return
    # Blocam randurile anvelopelor (in ordinea id-urilor, ca doua cereri sa nu se
    # astepte reciproc): fara asta, doua salvari simultane trec amandoua de
    # verificare si aceeasi anvelopa ajunge in doua cazari active.
    await db.execute(
        select(Anvelopa.id)
        .where(Anvelopa.account_id == account_id, Anvelopa.id.in_(anvelopa_ids))
        .order_by(Anvelopa.id)
        .with_for_update()
    )
    active_item = await db.scalar(
        select(CazareAnvelopaItem.id)
        .join(CazareAnvelope, CazareAnvelope.id == CazareAnvelopaItem.cazare_id)
        .where(
            CazareAnvelopaItem.anvelopa_id.in_(anvelopa_ids),
            CazareAnvelope.account_id == account_id,
            CazareAnvelope.is_deleted == False,
            CazareAnvelope.data_checkout.is_(None),
        )
        .limit(1)
    )
    if active_item is not None:
        raise HTTPException(400, "Una sau mai multe anvelope sunt deja în cazare activă.")


@router.post("", response_model=CazareRead, status_code=201)
async def create_cazare(
    body: CazareCreate,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    # Id-urile din body trebuie sa fie ale contului: relatiile nu filtreaza pe
    # account_id, deci un id strain ar fi salvat si apoi afisat in raspuns.
    await _assert_owned_or_reused(
        db, Client, CazareAnvelope.client_id, body.client_id, account_id, what="Clientul",
    )
    await _assert_owned_or_reused(
        db, Employee, CazareAnvelope.employee_id, body.employee_id, account_id, what="Angajatul",
    )
    await _assert_owned_or_reused(
        db, LocCazare, CazareAnvelope.loc_cazare_id, body.loc_cazare_id, account_id, what="Locul de cazare",
    )
    # Locatia vine de la dispozitiv, nu dintr-o alegere a utilizatorului, iar
    # stergerea locatiei nu dezleaga dispozitivele: cea proprie ramane acceptata
    # si dupa stergere, ca la bonuri. Filtrul pe cont se aplica oricum.
    await assert_owned(db, Location, body.location_id, account_id, what="Locatia", allow_deleted=True)
    await assert_owned(db, CazareAnvelope, body.referinta_cazare_id, account_id, what="Cazarea de referinta")
    await assert_owned(db, Receipt, body.receipt_id, account_id, what="Bonul")
    await assert_all_owned(db, Anvelopa, body.anvelopa_ids, account_id, what="Anvelopele")

    # validare: anvelopele nu trebuie să fie în cazare activă
    await _assert_not_in_active_cazare(db, account_id, body.anvelopa_ids)

    cazare = CazareAnvelope(
        account_id=account_id,
        client_id=body.client_id,
        employee_id=body.employee_id,
        loc_cazare_id=body.loc_cazare_id,
        location_id=body.location_id,
        data_checkin=body.data_checkin,
        comments=body.comments,
        dep_anvelope=body.dep_anvelope,
        dep_capace=body.dep_capace,
        dep_roti_complete=body.dep_roti_complete,
        dep_antifurturi=body.dep_antifurturi,
        dep_prezoane=body.dep_prezoane,
        referinta_cazare_id=body.referinta_cazare_id,
        montate_pe_masina=body.montate_pe_masina,
        numar_masina=body.numar_masina,
        receipt_id=body.receipt_id,
    )
    db.add(cazare)
    await db.flush()

    for anv_id in body.anvelopa_ids:
        item = CazareAnvelopaItem(
            account_id=account_id,
            cazare_id=cazare.id,
            anvelopa_id=anv_id,
        )
        db.add(item)

    await db.commit()

    result = await db.execute(_load_stmt(account_id).where(CazareAnvelope.id == cazare.id))
    cazare = result.scalar_one()
    succ_map = await _fetch_successor_map(db, account_id, [cazare.id])
    return _serialize(cazare, succ_map.get(cazare.id))


@router.get("/{cazare_id}", response_model=CazareRead)
async def get_cazare(
    cazare_id: int,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    result = await db.execute(
        _load_stmt(account_id).where(CazareAnvelope.id == cazare_id)
    )
    cazare = result.scalar_one_or_none()
    if cazare is None:
        raise HTTPException(404, "Cazarea nu a fost găsită.")
    succ_map = await _fetch_successor_map(db, account_id, [cazare.id])
    return _serialize(cazare, succ_map.get(cazare.id))


@router.patch("/{cazare_id}", response_model=CazareRead)
async def update_cazare(
    cazare_id: int,
    body: CazareUpdateBody,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    cazare = await db.get(CazareAnvelope, cazare_id)
    if cazare is None or cazare.account_id != account_id or cazare.is_deleted:
        raise HTTPException(404, "Cazarea nu a fost găsită.")
    if cazare.data_checkout is not None and (date.today() - cazare.data_checkout) > timedelta(days=EDIT_GRACE_DAYS):
        raise HTTPException(
            400,
            f"Cazarea a fost închisă acum mai mult de {EDIT_GRACE_DAYS} zile și nu mai poate fi editată.",
        )
    # Verificam doar id-urile care se schimba: o cazare veche, legata de un
    # angajat/loc/bon sters intre timp, trebuie sa ramana editabila.
    if body.employee_id != cazare.employee_id:
        await assert_owned(db, Employee, body.employee_id, account_id, what="Angajatul")
    if body.loc_cazare_id != cazare.loc_cazare_id:
        await assert_owned(db, LocCazare, body.loc_cazare_id, account_id, what="Locul de cazare")
    if body.referinta_cazare_id != cazare.referinta_cazare_id:
        if body.referinta_cazare_id == cazare_id:
            raise HTTPException(400, "Cazarea de referinta nu exista.")
        await assert_owned(db, CazareAnvelope, body.referinta_cazare_id, account_id, what="Cazarea de referinta")
    if body.receipt_id != cazare.receipt_id:
        await assert_owned(db, Receipt, body.receipt_id, account_id, what="Bonul")
    if body.anvelopa_ids is not None:
        # Anvelopele aflate deja pe cazare raman acceptate, chiar daca au fost sterse intre timp.
        existing = set((await db.execute(
            select(CazareAnvelopaItem.anvelopa_id).where(CazareAnvelopaItem.cazare_id == cazare_id)
        )).scalars().all())
        added = [i for i in body.anvelopa_ids if i not in existing]
        await assert_all_owned(db, Anvelopa, added, account_id, what="Anvelopele")
        # Ca la creare, dar doar pentru anvelopele ADAUGATE si doar pe o cazare
        # activa: dupa „scoatere + cazare noua", cazarea veche (inchisa) are
        # aceleasi anvelope ca cea noua si trebuie sa ramana editabila.
        if cazare.data_checkout is None:
            await _assert_not_in_active_cazare(db, account_id, added)
    cazare.employee_id = body.employee_id
    cazare.loc_cazare_id = body.loc_cazare_id
    if body.data_checkin is not None:
        cazare.data_checkin = body.data_checkin
    cazare.comments = body.comments
    if body.dep_anvelope is not None:
        cazare.dep_anvelope = body.dep_anvelope
    if body.dep_capace is not None:
        cazare.dep_capace = body.dep_capace
    if body.dep_roti_complete is not None:
        cazare.dep_roti_complete = body.dep_roti_complete
    if body.dep_antifurturi is not None:
        cazare.dep_antifurturi = body.dep_antifurturi
    if body.dep_prezoane is not None:
        cazare.dep_prezoane = body.dep_prezoane
    cazare.referinta_cazare_id = body.referinta_cazare_id
    if body.montate_pe_masina is not None:
        cazare.montate_pe_masina = body.montate_pe_masina
    cazare.numar_masina = body.numar_masina
    if body.receipt_id is not None:
        cazare.receipt_id = body.receipt_id
    cazare.updated_at = datetime.now(timezone.utc)

    if body.anvelopa_ids is not None:
        # șterge itemele existente și adaugă cele noi (bulk delete evită lazy-load pe back-ref)
        await db.execute(sql_delete(CazareAnvelopaItem).where(CazareAnvelopaItem.cazare_id == cazare_id))
        await db.flush()
        for anv_id in body.anvelopa_ids:
            db.add(CazareAnvelopaItem(
                account_id=account_id,
                cazare_id=cazare_id,
                anvelopa_id=anv_id,
            ))

    await db.commit()
    db.expire_all()
    result = await db.execute(_load_stmt(account_id).where(CazareAnvelope.id == cazare_id))
    cazare = result.scalar_one()
    succ_map = await _fetch_successor_map(db, account_id, [cazare.id])
    return _serialize(cazare, succ_map.get(cazare.id))


@router.patch("/{cazare_id}/checkout", response_model=CazareRead)
async def checkout_cazare(
    cazare_id: int,
    body: CazareCheckoutBody,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    cazare = await db.get(CazareAnvelope, cazare_id)
    if cazare is None or cazare.account_id != account_id or cazare.is_deleted:
        raise HTTPException(404, "Cazarea nu a fost găsită.")
    if cazare.data_checkout is not None:
        raise HTTPException(400, "Cazarea a fost deja închisă (checkout efectuat).")
    if body.receipt_id != cazare.receipt_id:
        await assert_owned(db, Receipt, body.receipt_id, account_id, what="Bonul")
    cazare.data_checkout = body.data_checkout
    if body.comments is not None:
        cazare.comments = body.comments
    if body.receipt_id is not None:
        cazare.receipt_id = body.receipt_id
    if body.montate_pe_masina is not None:
        cazare.montate_pe_masina = body.montate_pe_masina
    cazare.updated_at = datetime.now(timezone.utc)
    await db.commit()

    result = await db.execute(_load_stmt(account_id).where(CazareAnvelope.id == cazare_id))
    cazare = result.scalar_one()
    succ_map = await _fetch_successor_map(db, account_id, [cazare.id])
    return _serialize(cazare, succ_map.get(cazare.id))


@router.delete("/{cazare_id}", status_code=204)
async def delete_cazare(
    cazare_id: int,
    db: AsyncSession = Depends(get_db),
    # Stergerea e actiune privilegiata (admin + manager): butonul e ascuns
    # pentru `worker` in UI, iar aici o refuzam si pe server.
    account_id: int = Depends(get_settings_account_id),
):
    cazare = await db.get(CazareAnvelope, cazare_id)
    if cazare is None or cazare.account_id != account_id:
        raise HTTPException(404, "Cazarea nu a fost găsită.")
    await soft_delete(db, CazareAnvelope, cazare_id)
