from __future__ import annotations
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_account_id
from app.models.cod_dot_anvelopa import CodDotAnvelopa
from app.schemas.cod_dot_anvelopa import CodDotCreate, CodDotRead
from app.schemas.common import Page
from app.utils.paginate import paginate
from app.utils.soft_delete import soft_delete

router = APIRouter()


@router.get("", response_model=Page[CodDotRead])
async def list_coduri_dot(
    last_id: int | None = None,
    limit: int = 200,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    limit = min(limit, 500)
    stmt = select(CodDotAnvelopa).where(
        CodDotAnvelopa.account_id == account_id, CodDotAnvelopa.is_deleted == False
    )
    if last_id is not None:
        stmt = stmt.where(CodDotAnvelopa.id > last_id)
    stmt = stmt.order_by(CodDotAnvelopa.valoare, CodDotAnvelopa.id).limit(limit + 1)
    return await paginate(db, stmt, limit)


@router.post("", response_model=CodDotRead, status_code=201)
async def create_cod_dot(
    body: CodDotCreate,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    cod = CodDotAnvelopa(**body.model_dump(), account_id=account_id)
    db.add(cod)
    await db.commit()
    await db.refresh(cod)
    return cod


@router.patch("/{cod_id}", response_model=CodDotRead)
async def update_cod_dot(
    cod_id: int,
    body: CodDotCreate,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    cod = await db.get(CodDotAnvelopa, cod_id)
    if cod is None or cod.account_id != account_id or cod.is_deleted:
        raise HTTPException(404, "Codul DOT nu a fost găsit.")
    for k, v in body.model_dump().items():
        setattr(cod, k, v)
    cod.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(cod)
    return cod


@router.delete("/{cod_id}", status_code=204)
async def delete_cod_dot(
    cod_id: int,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    cod = await db.get(CodDotAnvelopa, cod_id)
    if cod is None or cod.account_id != account_id:
        raise HTTPException(404, "Codul DOT nu a fost găsit.")
    await soft_delete(db, CodDotAnvelopa, cod_id)
