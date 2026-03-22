from __future__ import annotations
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_account_id
from app.models.register import Register, REGISTER_TYPES
from app.schemas.register import RegisterCreate, RegisterUpdate, RegisterRead
from app.schemas.common import Page
from app.utils.soft_delete import soft_delete

router = APIRouter()


@router.get("", response_model=Page[RegisterRead])
async def list_registers(
    last_id: int | None = None,
    limit: int = 100,
    type: str | None = None,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    limit = min(limit, 200)
    stmt = (
        select(Register)
        .where(Register.account_id == account_id, Register.is_deleted == False)
        .order_by(Register.type, Register.id)
    )
    if last_id is not None:
        stmt = stmt.where(Register.id > last_id)
    if type is not None:
        stmt = stmt.where(Register.type == type)
    stmt = stmt.limit(limit + 1)

    rows = (await db.execute(stmt)).scalars().all()
    has_more = len(rows) > limit
    page = rows[:limit]
    return Page(items=page, next_cursor=page[-1].id if has_more else None)


@router.post("", response_model=RegisterRead, status_code=201)
async def create_register(
    body: RegisterCreate,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    if body.type not in REGISTER_TYPES:
        raise HTTPException(400, f"Tip invalid. Valorile acceptate: {', '.join(REGISTER_TYPES)}")
    r = Register(type=body.type, serie=body.serie, numar=body.numar, account_id=account_id)
    db.add(r)
    await db.commit()
    await db.refresh(r)
    return r


@router.get("/{register_id}", response_model=RegisterRead)
async def get_register(
    register_id: int,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    r = await db.get(Register, register_id)
    if r is None or r.account_id != account_id or r.is_deleted:
        raise HTTPException(404, "Registrul nu a fost găsit.")
    return r


@router.patch("/{register_id}", response_model=RegisterRead)
async def patch_register(
    register_id: int,
    body: RegisterUpdate,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    r = await db.get(Register, register_id)
    if r is None or r.account_id != account_id or r.is_deleted:
        raise HTTPException(404, "Registrul nu a fost găsit.")
    if body.type is not None and body.type not in REGISTER_TYPES:
        raise HTTPException(400, f"Tip invalid. Valorile acceptate: {', '.join(REGISTER_TYPES)}")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(r, k, v)
    r.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(r)
    return r


@router.delete("/{register_id}", status_code=204)
async def delete_register(
    register_id: int,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    r = await db.get(Register, register_id)
    if r is None or r.account_id != account_id:
        raise HTTPException(404, "Registrul nu a fost găsit.")
    await soft_delete(db, Register, register_id)
