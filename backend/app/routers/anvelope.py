from __future__ import annotations
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_account_id
from app.models.anvelopa import Anvelopa
from app.schemas.anvelopa import AnvelopaCreate, AnvelopaUpdate, AnvelopaRead
from app.schemas.common import Page
from app.utils.soft_delete import soft_delete

router = APIRouter()


def _serialize(a: Anvelopa) -> dict:
    return {
        "id": a.id,
        "account_id": a.account_id,
        "client_id": a.client_id,
        "marca_id": a.marca_id,
        "dimensiune_id": a.dimensiune_id,
        "tip": a.tip,
        "adancime": a.adancime,
        "comments": a.comments,
        "marca_nume": a.marca.nume if a.marca else None,
        "dimensiune_valoare": a.dimensiune.valoare if a.dimensiune else None,
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
        .where(Anvelopa.account_id == account_id, Anvelopa.is_deleted == False)
    )
    if client_id is not None:
        stmt = stmt.where(Anvelopa.client_id == client_id)
    if last_id is not None:
        stmt = stmt.where(Anvelopa.id > last_id)
    stmt = stmt.order_by(Anvelopa.id).limit(limit + 1)
    rows = (await db.execute(stmt)).scalars().all()

    # eager load marca/dimensiune
    from sqlalchemy.orm import selectinload
    stmt2 = (
        select(Anvelopa)
        .options(selectinload(Anvelopa.marca), selectinload(Anvelopa.dimensiune))
        .where(Anvelopa.account_id == account_id, Anvelopa.is_deleted == False)
    )
    if client_id is not None:
        stmt2 = stmt2.where(Anvelopa.client_id == client_id)
    if last_id is not None:
        stmt2 = stmt2.where(Anvelopa.id > last_id)
    stmt2 = stmt2.order_by(Anvelopa.id).limit(limit + 1)
    rows = (await db.execute(stmt2)).scalars().all()

    has_more = len(rows) > limit
    page = rows[:limit]
    return Page(items=[_serialize(r) for r in page], next_cursor=page[-1].id if has_more else None)


@router.post("", response_model=AnvelopaRead, status_code=201)
async def create_anvelopa(
    body: AnvelopaCreate,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    from sqlalchemy.orm import selectinload
    anv = Anvelopa(**body.model_dump(), account_id=account_id)
    db.add(anv)
    await db.commit()
    # reload with relationships
    result = await db.execute(
        select(Anvelopa)
        .options(selectinload(Anvelopa.marca), selectinload(Anvelopa.dimensiune))
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
    from sqlalchemy.orm import selectinload
    result = await db.execute(
        select(Anvelopa)
        .options(selectinload(Anvelopa.marca), selectinload(Anvelopa.dimensiune))
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
    from sqlalchemy.orm import selectinload
    anv = await db.get(Anvelopa, anvelopa_id)
    if anv is None or anv.account_id != account_id or anv.is_deleted:
        raise HTTPException(404, "Anvelopa nu a fost găsită.")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(anv, k, v)
    anv.updated_at = datetime.now(timezone.utc)
    await db.commit()
    result = await db.execute(
        select(Anvelopa)
        .options(selectinload(Anvelopa.marca), selectinload(Anvelopa.dimensiune))
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
