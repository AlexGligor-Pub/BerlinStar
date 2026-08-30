from __future__ import annotations
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
# Nomenclator/configurare: CITIREA ramane deschisa tuturor rolurilor (UI-ul
# operational depinde de ea), dar MODIFICAREA e admin + manager. Vezi
# app/permissions.py pentru matricea completa.
from app.dependencies import get_account_id, get_settings_account_id
from app.models.profil_anvelopa import ProfilAnvelopa
from app.schemas.profil_anvelopa import ProfilCreate, ProfilRead
from app.schemas.common import Page
from app.utils.paginate import paginate
from app.utils.soft_delete import soft_delete

router = APIRouter()


@router.get("", response_model=Page[ProfilRead])
async def list_profiluri(
    last_id: int | None = None,
    limit: int = 200,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    limit = min(limit, 500)
    stmt = select(ProfilAnvelopa).where(
        ProfilAnvelopa.account_id == account_id, ProfilAnvelopa.is_deleted == False
    )
    if last_id is not None:
        stmt = stmt.where(ProfilAnvelopa.id > last_id)
    stmt = stmt.order_by(ProfilAnvelopa.valoare, ProfilAnvelopa.id).limit(limit + 1)
    return await paginate(db, stmt, limit)


@router.post("", response_model=ProfilRead, status_code=201)
async def create_profil(
    body: ProfilCreate,
    db: AsyncSession = Depends(get_db),
    # Adaugarea unei valori noi e OPERATIONALA: cand o dimensiune/profil/cod
    # DOT lipseste din lista, omul de la receptie trebuie sa o poata introduce
    # pe loc, din modalul de cazare sau de montaj. Modificarea si stergerea
    # raman administrative (vezi PATCH/DELETE mai jos).
    account_id: int = Depends(get_account_id),
):
    profil = ProfilAnvelopa(**body.model_dump(), account_id=account_id)
    db.add(profil)
    await db.commit()
    await db.refresh(profil)
    return profil


@router.patch("/{profil_id}", response_model=ProfilRead)
async def update_profil(
    profil_id: int,
    body: ProfilCreate,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_settings_account_id),
):
    profil = await db.get(ProfilAnvelopa, profil_id)
    if profil is None or profil.account_id != account_id or profil.is_deleted:
        raise HTTPException(404, "Profilul nu a fost găsit.")
    for k, v in body.model_dump().items():
        setattr(profil, k, v)
    profil.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(profil)
    return profil


@router.delete("/{profil_id}", status_code=204)
async def delete_profil(
    profil_id: int,
    db: AsyncSession = Depends(get_db),
    # Stergerea e actiune privilegiata (admin + manager): butonul e ascuns
    # pentru `worker` in UI, iar aici o refuzam si pe server.
    account_id: int = Depends(get_settings_account_id),
):
    profil = await db.get(ProfilAnvelopa, profil_id)
    if profil is None or profil.account_id != account_id:
        raise HTTPException(404, "Profilul nu a fost găsit.")
    await soft_delete(db, ProfilAnvelopa, profil_id)
