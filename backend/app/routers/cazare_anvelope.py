from __future__ import annotations
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, and_, delete as sql_delete
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_account_id
from app.models.cazare_anvelope import CazareAnvelope, CazareAnvelopaItem
from app.models.anvelopa import Anvelopa
from app.schemas.cazare_anvelope import CazareCreate, CazareRead, CazareCheckoutBody, CazareUpdateBody
from app.schemas.common import Page
from app.utils.soft_delete import soft_delete

router = APIRouter()


def _serialize_anvelopa(a: Anvelopa | None) -> dict | None:
    if a is None:
        return None
    return {
        "id": a.id,
        "account_id": a.account_id,
        "client_id": a.client_id,
        "marca_id": a.marca_id,
        "dimensiune_id": a.dimensiune_id,
        "profil_id": a.profil_id,
        "tip": a.tip,
        "adancime": a.adancime,
        "comments": a.comments,
        "marca_nume": a.marca.nume if a.marca else None,
        "dimensiune_valoare": a.dimensiune.valoare if a.dimensiune else None,
        "profil_valoare": a.profil.valoare if a.profil else None,
        "created_at": a.created_at,
        "updated_at": a.updated_at,
        "is_deleted": a.is_deleted,
    }


def _serialize(c: CazareAnvelope) -> dict:
    client = c.client
    emp = c.employee
    loc = c.loc_cazare
    return {
        "id": c.id,
        "account_id": c.account_id,
        "client_id": c.client_id,
        "employee_id": c.employee_id,
        "loc_cazare_id": c.loc_cazare_id,
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
        "numar_masina": c.numar_masina,
        "referinta_cazare_data_checkin": str(c.referinta_cazare.data_checkin) if c.referinta_cazare else None,
        "referinta_cazare_items": [
            {"id": item.id, "anvelopa_id": item.anvelopa_id, "anvelopa": _serialize_anvelopa(item.anvelopa)}
            for item in (c.referinta_cazare.items if c.referinta_cazare else [])
        ],
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
        "items": [
            {
                "id": item.id,
                "anvelopa_id": item.anvelopa_id,
                "anvelopa": _serialize_anvelopa(item.anvelopa),
            }
            for item in c.items
        ],
    }


def _load_stmt(account_id: int):
    return (
        select(CazareAnvelope)
        .options(
            selectinload(CazareAnvelope.client),
            selectinload(CazareAnvelope.employee),
            selectinload(CazareAnvelope.loc_cazare),
            selectinload(CazareAnvelope.referinta_cazare).selectinload(CazareAnvelope.items).selectinload(CazareAnvelopaItem.anvelopa).selectinload(Anvelopa.marca),
            selectinload(CazareAnvelope.referinta_cazare).selectinload(CazareAnvelope.items).selectinload(CazareAnvelopaItem.anvelopa).selectinload(Anvelopa.dimensiune),
            selectinload(CazareAnvelope.referinta_cazare).selectinload(CazareAnvelope.items).selectinload(CazareAnvelopaItem.anvelopa).selectinload(Anvelopa.profil),
            selectinload(CazareAnvelope.items).selectinload(
                CazareAnvelopaItem.anvelopa
            ).selectinload(Anvelopa.marca),
            selectinload(CazareAnvelope.items).selectinload(
                CazareAnvelopaItem.anvelopa
            ).selectinload(Anvelopa.dimensiune),
            selectinload(CazareAnvelope.items).selectinload(
                CazareAnvelopaItem.anvelopa
            ).selectinload(Anvelopa.profil),
        )
        .where(CazareAnvelope.account_id == account_id, CazareAnvelope.is_deleted == False)
    )


@router.get("", response_model=Page[CazareRead])
async def list_cazari(
    activa: bool | None = None,
    client_id: int | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    last_id: int | None = None,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    limit = min(limit, 200)
    stmt = _load_stmt(account_id)
    if activa is True:
        stmt = stmt.where(CazareAnvelope.data_checkout.is_(None))
    elif activa is False:
        stmt = stmt.where(CazareAnvelope.data_checkout.isnot(None))
    if client_id is not None:
        stmt = stmt.where(CazareAnvelope.client_id == client_id)
    if date_from:
        stmt = stmt.where(CazareAnvelope.data_checkin >= date_from)
    if date_to:
        stmt = stmt.where(CazareAnvelope.data_checkin <= date_to)
    if last_id is not None:
        stmt = stmt.where(CazareAnvelope.id < last_id)
    stmt = stmt.order_by(CazareAnvelope.id.desc()).limit(limit + 1)
    rows = (await db.execute(stmt)).scalars().all()
    has_more = len(rows) > limit
    page = rows[:limit]
    return Page(items=[_serialize(r) for r in page], next_cursor=page[-1].id if has_more else None)


@router.post("", response_model=CazareRead, status_code=201)
async def create_cazare(
    body: CazareCreate,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    # validare: anvelopele nu trebuie să fie în cazare activă
    if body.anvelopa_ids:
        active_items = (await db.execute(
            select(CazareAnvelopaItem)
            .join(CazareAnvelope, CazareAnvelope.id == CazareAnvelopaItem.cazare_id)
            .where(
                CazareAnvelopaItem.anvelopa_id.in_(body.anvelopa_ids),
                CazareAnvelope.account_id == account_id,
                CazareAnvelope.is_deleted == False,
                CazareAnvelope.data_checkout.is_(None),
            )
        )).scalars().all()
        if active_items:
            raise HTTPException(400, "Una sau mai multe anvelope sunt deja în cazare activă.")

    cazare = CazareAnvelope(
        account_id=account_id,
        client_id=body.client_id,
        employee_id=body.employee_id,
        loc_cazare_id=body.loc_cazare_id,
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
    return _serialize(cazare)


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
    return _serialize(cazare)


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
    return _serialize(cazare)


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
    cazare.data_checkout = body.data_checkout
    if body.comments is not None:
        cazare.comments = body.comments
    cazare.updated_at = datetime.now(timezone.utc)
    await db.commit()

    result = await db.execute(_load_stmt(account_id).where(CazareAnvelope.id == cazare_id))
    cazare = result.scalar_one()
    return _serialize(cazare)


@router.delete("/{cazare_id}", status_code=204)
async def delete_cazare(
    cazare_id: int,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    cazare = await db.get(CazareAnvelope, cazare_id)
    if cazare is None or cazare.account_id != account_id:
        raise HTTPException(404, "Cazarea nu a fost găsită.")
    await soft_delete(db, CazareAnvelope, cazare_id)
