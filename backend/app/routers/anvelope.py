from __future__ import annotations
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_account_id
from app.models.anvelopa import Anvelopa
from app.models.client import Client
from app.models.cod_dot_anvelopa import CodDotAnvelopa
from app.models.dimensiune_anvelopa import DimensiuneAnvelopa
from app.models.marca_anvelopa import MarcaAnvelopa
from app.models.profil_anvelopa import ProfilAnvelopa
from app.schemas.anvelopa import AnvelopaCreate, AnvelopaUpdate, AnvelopaRead
from app.schemas.common import Page
from app.utils.ownership import assert_owned
from app.utils.soft_delete import soft_delete

# Nomenclatoarele sunt per cont (marcile sunt globale si au verificarea lor).
_NOMENCLATOARE = (
    ("dimensiune_id", DimensiuneAnvelopa, "Dimensiunea"),
    ("profil_id", ProfilAnvelopa, "Profilul"),
    ("dot_id", CodDotAnvelopa, "Codul DOT"),
)


async def _assert_marca_aprobata(db: AsyncSession, marca_id: int | None) -> None:
    """Refuza marca_id-uri pending/rejected/sterse (bypass moderare)."""
    if marca_id is None:
        return
    row = (await db.execute(
        select(MarcaAnvelopa.id).where(
            MarcaAnvelopa.id == marca_id,
            MarcaAnvelopa.status == "approved",
            MarcaAnvelopa.is_deleted == False,
        )
    )).first()
    if row is None:
        raise HTTPException(400, "Marca selectată nu este aprobată sau a fost ștearsă.")

router = APIRouter()


def _own(a: Anvelopa, rel):
    # Randurile vechi pot arata spre un nomenclator al altui cont (id-urile nu
    # erau verificate la salvare): id-ul ramane, valoarea lui nu se afiseaza.
    return rel if rel is not None and rel.account_id == a.account_id else None


def _serialize(a: Anvelopa) -> dict:
    # Marca e nomenclator global (fara account_id); restul sunt per cont.
    dimensiune, profil, dot = _own(a, a.dimensiune), _own(a, a.profil), _own(a, a.dot)
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


@router.get("", response_model=Page[AnvelopaRead])
async def list_anvelope(
    client_id: int | None = None,
    last_id: int | None = None,
    limit: int = 200,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    limit = min(limit, 500)
    stmt = (
        select(Anvelopa)
        .options(selectinload(Anvelopa.marca), selectinload(Anvelopa.dimensiune), selectinload(Anvelopa.profil), selectinload(Anvelopa.dot))
        .where(Anvelopa.account_id == account_id, Anvelopa.is_deleted == False)
    )
    if client_id is not None:
        stmt = stmt.where(Anvelopa.client_id == client_id)
    if last_id is not None:
        stmt = stmt.where(Anvelopa.id > last_id)
    stmt = stmt.order_by(Anvelopa.id).limit(limit + 1)
    rows = (await db.execute(stmt)).scalars().all()

    has_more = len(rows) > limit
    page = rows[:limit]
    return Page(items=[_serialize(r) for r in page], next_cursor=page[-1].id if has_more else None)


@router.post("", response_model=AnvelopaRead, status_code=201)
async def create_anvelopa(
    body: AnvelopaCreate,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    await _assert_marca_aprobata(db, body.marca_id)
    await assert_owned(db, Client, body.client_id, account_id, what="Clientul")
    # allow_deleted: „Copy" si sugestia din montaj retrimit id-uri de nomenclator
    # sterse intre timp din contul propriu; filtrul pe cont ramane.
    for field, model, what in _NOMENCLATOARE:
        await assert_owned(db, model, getattr(body, field), account_id, what=what, allow_deleted=True)
    anv = Anvelopa(**body.model_dump(), account_id=account_id)
    db.add(anv)
    await db.commit()
    # reload with relationships
    result = await db.execute(
        select(Anvelopa)
        .options(selectinload(Anvelopa.marca), selectinload(Anvelopa.dimensiune), selectinload(Anvelopa.profil), selectinload(Anvelopa.dot))
        .where(Anvelopa.id == anv.id)
    )
    anv = result.scalar_one()
    return _serialize(anv)


@router.get("/{anvelopa_id}", response_model=AnvelopaRead)
async def get_anvelopa(
    anvelopa_id: int,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    result = await db.execute(
        select(Anvelopa)
        .options(selectinload(Anvelopa.marca), selectinload(Anvelopa.dimensiune), selectinload(Anvelopa.profil), selectinload(Anvelopa.dot))
        .where(Anvelopa.id == anvelopa_id)
    )
    anv = result.scalar_one_or_none()
    if anv is None or anv.account_id != account_id or anv.is_deleted:
        raise HTTPException(404, "Anvelopa nu a fost găsită.")
    return _serialize(anv)


@router.patch("/{anvelopa_id}", response_model=AnvelopaRead)
async def update_anvelopa(
    anvelopa_id: int,
    body: AnvelopaUpdate,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    anv = await db.get(Anvelopa, anvelopa_id)
    if anv is None or anv.account_id != account_id or anv.is_deleted:
        raise HTTPException(404, "Anvelopa nu a fost găsită.")
    payload = body.model_dump(exclude_unset=True)
    if "marca_id" in payload:
        await _assert_marca_aprobata(db, payload["marca_id"])
    # Doar id-urile care se schimba: o anvelopa veche trebuie sa ramana editabila
    # cu id-urile pe care le are deja.
    for field, model, what in _NOMENCLATOARE:
        if field in payload and payload[field] != getattr(anv, field):
            await assert_owned(db, model, payload[field], account_id, what=what, allow_deleted=True)
    for k, v in payload.items():
        setattr(anv, k, v)
    anv.updated_at = datetime.now(timezone.utc)
    await db.commit()
    result = await db.execute(
        select(Anvelopa)
        .options(selectinload(Anvelopa.marca), selectinload(Anvelopa.dimensiune), selectinload(Anvelopa.profil), selectinload(Anvelopa.dot))
        .where(Anvelopa.id == anvelopa_id)
    )
    anv = result.scalar_one()
    return _serialize(anv)


@router.delete("/{anvelopa_id}", status_code=204)
async def delete_anvelopa(
    anvelopa_id: int,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    anv = await db.get(Anvelopa, anvelopa_id)
    if anv is None or anv.account_id != account_id:
        raise HTTPException(404, "Anvelopa nu a fost găsită.")
    await soft_delete(db, Anvelopa, anvelopa_id)
