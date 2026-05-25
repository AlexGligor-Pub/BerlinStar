from __future__ import annotations
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.account import Account
from app.models.marca_anvelopa import MarcaAnvelopa
from app.routers.admin import _require_super_admin
from app.schemas.common import Page
from app.schemas.marca_anvelopa import MarcaAdminRead

router = APIRouter()


# Listare cu filtru pe status. Returneaza si numele contului propunator.
@router.get("", response_model=Page[MarcaAdminRead])
async def list_marci_admin(
    status: str | None = Query(None, pattern="^(approved|pending|rejected)$"),
    include_deleted: bool = False,
    last_id: int | None = None,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    admin: Account = Depends(_require_super_admin),  # noqa: ARG001
):
    limit = min(limit, 500)
    stmt = (
        select(MarcaAnvelopa, Account.name)
        .outerjoin(Account, Account.id == MarcaAnvelopa.proposed_by_account_id)
    )
    if not include_deleted:
        stmt = stmt.where(MarcaAnvelopa.is_deleted == False)
    if status is not None:
        stmt = stmt.where(MarcaAnvelopa.status == status)
    if last_id is not None:
        stmt = stmt.where(MarcaAnvelopa.id > last_id)
    # Sortare: pending pe top, restul alfabetic.
    stmt = stmt.order_by(MarcaAnvelopa.nume, MarcaAnvelopa.id).limit(limit + 1)
    rows = (await db.execute(stmt)).all()
    has_more = len(rows) > limit
    page = rows[:limit]
    items = []
    for marca, account_name in page:
        items.append(MarcaAdminRead(
            id=marca.id,
            nume=marca.nume,
            status=marca.status,
            proposed_by_account_id=marca.proposed_by_account_id,
            proposed_by_account_name=account_name,
            approved_at=marca.approved_at,
            rejected_at=marca.rejected_at,
            created_at=marca.created_at,
            updated_at=marca.updated_at,
            is_deleted=marca.is_deleted,
        ))
    next_cursor = page[-1][0].id if has_more else None
    return Page(items=items, next_cursor=next_cursor)


class CountsResponse(BaseModel):
    pending: int
    approved: int
    rejected: int


@router.get("/counts", response_model=CountsResponse)
async def counts_marci_admin(
    db: AsyncSession = Depends(get_db),
    admin: Account = Depends(_require_super_admin),  # noqa: ARG001
):
    res = await db.execute(
        select(MarcaAnvelopa.status, func.count(MarcaAnvelopa.id))
        .where(MarcaAnvelopa.is_deleted == False)
        .group_by(MarcaAnvelopa.status)
    )
    counts = {"pending": 0, "approved": 0, "rejected": 0}
    for status_val, count in res.all():
        if status_val in counts:
            counts[status_val] = count
    return CountsResponse(**counts)


class MarcaAdminCreate(BaseModel):
    nume: str = Field(..., max_length=200, min_length=1)


class MarcaAdminUpdate(BaseModel):
    nume: str = Field(..., max_length=200, min_length=1)


@router.post("", response_model=MarcaAdminRead, status_code=201)
async def create_marca_admin(
    body: MarcaAdminCreate,
    db: AsyncSession = Depends(get_db),
    admin: Account = Depends(_require_super_admin),  # noqa: ARG001
):
    nume = body.nume.strip()
    existing = (await db.execute(
        select(MarcaAnvelopa).where(
            func.lower(func.trim(MarcaAnvelopa.nume)) == nume.lower(),
            MarcaAnvelopa.is_deleted == False,
        )
    )).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(409, f"Marca „{existing.nume}” există deja (status: {existing.status}).")
    marca = MarcaAnvelopa(
        nume=nume,
        status="approved",
        approved_at=datetime.now(timezone.utc),
    )
    db.add(marca)
    await db.commit()
    await db.refresh(marca)
    return MarcaAdminRead.model_validate(marca)


@router.patch("/{marca_id}", response_model=MarcaAdminRead)
async def update_marca_admin(
    marca_id: int,
    body: MarcaAdminUpdate,
    db: AsyncSession = Depends(get_db),
    admin: Account = Depends(_require_super_admin),  # noqa: ARG001
):
    marca = await db.get(MarcaAnvelopa, marca_id)
    if marca is None or marca.is_deleted:
        raise HTTPException(404, "Marca nu a fost găsită.")
    nume = body.nume.strip()
    # Conflict pe alt rand cu acelasi nume case-insensitive.
    conflict = (await db.execute(
        select(MarcaAnvelopa).where(
            func.lower(func.trim(MarcaAnvelopa.nume)) == nume.lower(),
            MarcaAnvelopa.is_deleted == False,
            MarcaAnvelopa.id != marca_id,
        )
    )).scalar_one_or_none()
    if conflict is not None:
        raise HTTPException(409, f"Există deja o marcă „{conflict.nume}”.")
    marca.nume = nume
    marca.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(marca)
    return MarcaAdminRead.model_validate(marca)


@router.post("/{marca_id}/approve", response_model=MarcaAdminRead)
async def approve_marca(
    marca_id: int,
    db: AsyncSession = Depends(get_db),
    admin: Account = Depends(_require_super_admin),  # noqa: ARG001
):
    marca = await db.get(MarcaAnvelopa, marca_id)
    if marca is None or marca.is_deleted:
        raise HTTPException(404, "Marca nu a fost găsită.")
    marca.status = "approved"
    marca.approved_at = datetime.now(timezone.utc)
    marca.rejected_at = None
    marca.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(marca)
    return MarcaAdminRead.model_validate(marca)


@router.post("/{marca_id}/reject", response_model=MarcaAdminRead)
async def reject_marca(
    marca_id: int,
    db: AsyncSession = Depends(get_db),
    admin: Account = Depends(_require_super_admin),  # noqa: ARG001
):
    marca = await db.get(MarcaAnvelopa, marca_id)
    if marca is None or marca.is_deleted:
        raise HTTPException(404, "Marca nu a fost găsită.")
    marca.status = "rejected"
    marca.rejected_at = datetime.now(timezone.utc)
    marca.approved_at = None
    marca.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(marca)
    return MarcaAdminRead.model_validate(marca)


@router.delete("/{marca_id}", status_code=204)
async def delete_marca_admin(
    marca_id: int,
    db: AsyncSession = Depends(get_db),
    admin: Account = Depends(_require_super_admin),  # noqa: ARG001
):
    marca = await db.get(MarcaAnvelopa, marca_id)
    if marca is None or marca.is_deleted:
        raise HTTPException(404, "Marca nu a fost găsită.")
    marca.is_deleted = True
    marca.deleted_at = datetime.now(timezone.utc)
    marca.updated_at = datetime.now(timezone.utc)
    await db.commit()
