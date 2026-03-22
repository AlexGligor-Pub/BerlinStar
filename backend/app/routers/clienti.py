from __future__ import annotations
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_account_id
from app.models.client import Client
from app.schemas.client import ClientCreate, ClientRead
from app.schemas.common import Page
from app.utils.soft_delete import soft_delete

router = APIRouter()


@router.get("", response_model=Page[ClientRead])
async def list_clienti(
    last_id: int | None = None,
    limit: int = 100,
    q: str | None = None,
    tip: str | None = None,
    cui: str | None = None,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    limit = min(limit, 200)
    stmt = select(Client).where(Client.account_id == account_id, Client.is_deleted == False)
    if last_id is not None:
        stmt = stmt.where(Client.id > last_id)
    if q:
        stmt = stmt.where(Client.nume.ilike(f"%{q}%"))
    if tip:
        stmt = stmt.where(Client.tip == tip)
    if cui:
        stmt = stmt.where(Client.cui == cui)
    stmt = stmt.order_by(Client.nume, Client.id).limit(limit + 1)

    rows = (await db.execute(stmt)).scalars().all()
    has_more = len(rows) > limit
    page = rows[:limit]
    return Page(items=page, next_cursor=page[-1].id if has_more else None)


@router.post("", response_model=ClientRead, status_code=201)
async def create_client(
    body: ClientCreate,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    client = Client(**body.model_dump(), account_id=account_id)
    db.add(client)
    await db.commit()
    await db.refresh(client)
    return client


@router.get("/{client_id}", response_model=ClientRead)
async def get_client(
    client_id: int,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    client = await db.get(Client, client_id)
    if client is None or client.account_id != account_id or client.is_deleted:
        raise HTTPException(404, "Clientul nu a fost găsit.")
    return client


@router.patch("/{client_id}", response_model=ClientRead)
async def update_client(
    client_id: int,
    body: ClientCreate,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    client = await db.get(Client, client_id)
    if client is None or client.account_id != account_id or client.is_deleted:
        raise HTTPException(404, "Clientul nu a fost găsit.")
    for k, v in body.model_dump().items():
        setattr(client, k, v)
    client.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(client)
    return client


@router.delete("/{client_id}", status_code=204)
async def delete_client(
    client_id: int,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    client = await db.get(Client, client_id)
    if client is None or client.account_id != account_id:
        raise HTTPException(404, "Clientul nu a fost găsit.")
    await soft_delete(db, Client, client_id)
