from __future__ import annotations
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_account_id
from app.models.marca_anvelopa import MarcaAnvelopa
from app.schemas.marca_anvelopa import MarcaCreate, MarcaRead
from app.schemas.common import Page
from app.utils.paginate import paginate
from app.utils.soft_delete import soft_delete

router = APIRouter()


@router.get("", response_model=Page[MarcaRead])
async def list_marci(
    last_id: int | None = None,
    limit: int = 200,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    limit = min(limit, 500)
    stmt = select(MarcaAnvelopa).where(
        MarcaAnvelopa.account_id == account_id, MarcaAnvelopa.is_deleted == False
    )
    if last_id is not None:
        stmt = stmt.where(MarcaAnvelopa.id > last_id)
    stmt = stmt.order_by(MarcaAnvelopa.nume, MarcaAnvelopa.id).limit(limit + 1)
    return await paginate(db, stmt, limit)


@router.post("", response_model=MarcaRead, status_code=201)
async def create_marca(
    body: MarcaCreate,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    marca = MarcaAnvelopa(**body.model_dump(), account_id=account_id)
    db.add(marca)
    await db.commit()
    await db.refresh(marca)
    return marca


@router.patch("/{marca_id}", response_model=MarcaRead)
async def update_marca(
    marca_id: int,
    body: MarcaCreate,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    marca = await db.get(MarcaAnvelopa, marca_id)
    if marca is None or marca.account_id != account_id or marca.is_deleted:
        raise HTTPException(404, "Marca nu a fost găsită.")
    for k, v in body.model_dump().items():
        setattr(marca, k, v)
    marca.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(marca)
    return marca


@router.delete("/{marca_id}", status_code=204)
async def delete_marca(
    marca_id: int,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    marca = await db.get(MarcaAnvelopa, marca_id)
    if marca is None or marca.account_id != account_id:
        raise HTTPException(404, "Marca nu a fost găsită.")
    await soft_delete(db, MarcaAnvelopa, marca_id)
