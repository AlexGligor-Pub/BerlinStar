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
from app.models.dimensiune_anvelopa import DimensiuneAnvelopa
from app.schemas.dimensiune_anvelopa import DimensiuneCreate, DimensiuneRead
from app.schemas.common import Page
from app.utils.paginate import paginate
from app.utils.soft_delete import soft_delete

router = APIRouter()


@router.get("", response_model=Page[DimensiuneRead])
async def list_dimensiuni(
    last_id: int | None = None,
    limit: int = 200,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    limit = min(limit, 500)
    stmt = select(DimensiuneAnvelopa).where(
        DimensiuneAnvelopa.account_id == account_id, DimensiuneAnvelopa.is_deleted == False
    )
    if last_id is not None:
        stmt = stmt.where(DimensiuneAnvelopa.id > last_id)
    stmt = stmt.order_by(DimensiuneAnvelopa.valoare, DimensiuneAnvelopa.id).limit(limit + 1)
    return await paginate(db, stmt, limit)


@router.post("", response_model=DimensiuneRead, status_code=201)
async def create_dimensiune(
    body: DimensiuneCreate,
    db: AsyncSession = Depends(get_db),
    # Adaugarea unei valori noi e OPERATIONALA: cand o dimensiune/profil/cod
    # DOT lipseste din lista, omul de la receptie trebuie sa o poata introduce
    # pe loc, din modalul de cazare sau de montaj. Modificarea si stergerea
    # raman administrative (vezi PATCH/DELETE mai jos).
    account_id: int = Depends(get_account_id),
):
    dim = DimensiuneAnvelopa(**body.model_dump(), account_id=account_id)
    db.add(dim)
    await db.commit()
    await db.refresh(dim)
    return dim


@router.patch("/{dim_id}", response_model=DimensiuneRead)
async def update_dimensiune(
    dim_id: int,
    body: DimensiuneCreate,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_settings_account_id),
):
    dim = await db.get(DimensiuneAnvelopa, dim_id)
    if dim is None or dim.account_id != account_id or dim.is_deleted:
        raise HTTPException(404, "Dimensiunea nu a fost găsită.")
    for k, v in body.model_dump().items():
        setattr(dim, k, v)
    dim.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(dim)
    return dim


@router.delete("/{dim_id}", status_code=204)
async def delete_dimensiune(
    dim_id: int,
    db: AsyncSession = Depends(get_db),
    # Stergerea e actiune privilegiata (admin + manager): butonul e ascuns
    # pentru `worker` in UI, iar aici o refuzam si pe server.
    account_id: int = Depends(get_settings_account_id),
):
    dim = await db.get(DimensiuneAnvelopa, dim_id)
    if dim is None or dim.account_id != account_id:
        raise HTTPException(404, "Dimensiunea nu a fost găsită.")
    await soft_delete(db, DimensiuneAnvelopa, dim_id)
