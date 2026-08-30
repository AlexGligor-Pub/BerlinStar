from __future__ import annotations
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_account_id, get_settings_account_id
from app.models.client import Client
from app.models.client_vehicol import ClientVehicol
from app.models.receipt import Receipt
from app.models.vehicol import Vehicol
from app.schemas.client import ClientCreate, ClientRead
from app.schemas.client_vehicol import ClientVehicolCreate, ClientVehicolRead, ClientVehicolWithClientRead, ClientShort
from app.utils.plate import normalize_plate, normalized_plate_column
from app.schemas.common import Page
from app.utils.paginate import paginate
from app.utils.soft_delete import soft_delete
from sqlalchemy import func

router = APIRouter()


@router.get("", response_model=Page[ClientRead])
async def list_clienti(
    last_id: int | None = None,
    limit: int = 100,
    q: str | None = None,
    q_masina: str | None = None,
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
        from sqlalchemy import or_
        stmt = stmt.where(or_(
            Client.nume.ilike(f"%{q}%"),
            Client.cui.ilike(f"%{q}%"),
        ))
    if q_masina:
        subq = (
            select(ClientVehicol.client_id)
            .where(
                ClientVehicol.account_id == account_id,
                ClientVehicol.is_deleted == False,
                ClientVehicol.numar_masina.ilike(f"%{q_masina}%"),
            )
            .distinct()
        )
        stmt = stmt.where(
            Client.id.in_(subq) | Client.numar_masina.ilike(f"%{q_masina}%")
        )
    if tip:
        stmt = stmt.where(Client.tip == tip)
    if cui:
        stmt = stmt.where(Client.cui == cui)
    stmt = stmt.order_by(Client.nume, Client.id).limit(limit + 1)

    return await paginate(db, stmt, limit)


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


@router.get("/vehicole-by-plate", response_model=list[ClientVehicolWithClientRead])
async def search_vehicole_by_plate(
    q_masina: str,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    # Acelasi normalizator ca la legarea masinii de client (app/utils/plate.py).
    # Cand cele doua difereau, cautarea considera „TM-01-ABC" si „TM01ABC" masini
    # diferite, iar salvarea le unifica — sau invers, dupa caz.
    stmt = (
        select(ClientVehicol, Client)
        .join(Client, Client.id == ClientVehicol.client_id)
        .where(
            ClientVehicol.account_id == account_id,
            ClientVehicol.is_deleted == False,
            Client.is_deleted == False,
            normalized_plate_column(ClientVehicol.numar_masina) == normalize_plate(q_masina),
        )
        .order_by(ClientVehicol.id)
    )
    rows = (await db.execute(stmt)).all()
    return [
        ClientVehicolWithClientRead(
            vehicol=ClientVehicolRead.model_validate(v),
            client=ClientShort(
                id=c.id,
                nume=c.nume,
                tip=c.tip,
                cui=c.cui,
                numar_masina=c.numar_masina,
            ),
        )
        for v, c in rows
    ]


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
    # Stergerea e actiune privilegiata (admin + manager): butonul e ascuns
    # pentru `worker` in UI, iar aici o refuzam si pe server.
    account_id: int = Depends(get_settings_account_id),
):
    client = await db.get(Client, client_id)
    if client is None or client.account_id != account_id:
        raise HTTPException(404, "Clientul nu a fost găsit.")
    await soft_delete(db, Client, client_id)


@router.get("/{client_id}/receipts-summary")
async def client_receipts_summary(
    client_id: int,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    """Statistici devize pentru un client: count total, suma, lista mașini distincte folosite în devize."""
    client = await db.get(Client, client_id)
    if client is None or client.account_id != account_id or client.is_deleted:
        raise HTTPException(404, "Clientul nu a fost găsit.")

    # Count + sum pentru devize ale clientului (FDL-urile sunt estimări, nu intră în statistici)
    agg_row = (await db.execute(
        select(func.count(Receipt.id), func.coalesce(func.sum(Receipt.total), 0))
        .where(
            Receipt.account_id == account_id,
            Receipt.client_id == client_id,
            Receipt.is_deleted == False,
            Receipt.source != "fdl",
        )
    )).one()
    count, total = agg_row

    # Plăci de înmatriculare distincte din vehicole asociate devizelor clientului
    plates_rows = (await db.execute(
        select(Vehicol.numar_masina, func.count(Vehicol.id))
        .join(Receipt, Receipt.id == Vehicol.receipt_id)
        .where(
            Receipt.account_id == account_id,
            Receipt.client_id == client_id,
            Receipt.is_deleted == False,
            Receipt.source != "fdl",
            Vehicol.is_deleted == False,
        )
        .group_by(Vehicol.numar_masina)
    )).all()
    plates_used = [{"numar_masina": p, "count": c} for p, c in plates_rows]

    # Câte devize NU au vehicol asociat (FDL-urile excluse, ca peste tot)
    no_vehicol_count = (await db.execute(
        select(func.count(Receipt.id))
        .outerjoin(Vehicol, (Vehicol.receipt_id == Receipt.id) & (Vehicol.is_deleted == False))
        .where(
            Receipt.account_id == account_id,
            Receipt.client_id == client_id,
            Receipt.is_deleted == False,
            Receipt.source != "fdl",
            Vehicol.id.is_(None),
        )
    )).scalar_one()

    return {
        "count": int(count or 0),
        "total": float(total or 0),
        "plates_used": plates_used,
        "no_vehicol_count": int(no_vehicol_count or 0),
    }


# ── Vehicole per client ────────────────────────────────────────────────────────

@router.get("/{client_id}/vehicole", response_model=list[ClientVehicolRead])
async def list_client_vehicole(
    client_id: int,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    client = await db.get(Client, client_id)
    if client is None or client.account_id != account_id or client.is_deleted:
        raise HTTPException(404, "Clientul nu a fost găsit.")
    stmt = (
        select(ClientVehicol)
        .where(
            ClientVehicol.client_id == client_id,
            ClientVehicol.account_id == account_id,
            ClientVehicol.is_deleted == False,
        )
        .order_by(ClientVehicol.id)
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/{client_id}/vehicole", response_model=ClientVehicolRead, status_code=201)
async def create_client_vehicol(
    client_id: int,
    body: ClientVehicolCreate,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    client = await db.get(Client, client_id)
    if client is None or client.account_id != account_id or client.is_deleted:
        raise HTTPException(404, "Clientul nu a fost găsit.")
    v = ClientVehicol(**body.model_dump(), client_id=client_id, account_id=account_id)
    db.add(v)
    await db.commit()
    await db.refresh(v)
    return v


@router.patch("/{client_id}/vehicole/{v_id}", response_model=ClientVehicolRead)
async def update_client_vehicol(
    client_id: int,
    v_id: int,
    body: ClientVehicolCreate,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    v = await db.get(ClientVehicol, v_id)
    if v is None or v.client_id != client_id or v.account_id != account_id or v.is_deleted:
        raise HTTPException(404, "Vehicolul nu a fost găsit.")
    for k, val in body.model_dump().items():
        setattr(v, k, val)
    v.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(v)
    return v


@router.delete("/{client_id}/vehicole/{v_id}", status_code=204)
async def delete_client_vehicol(
    client_id: int,
    v_id: int,
    db: AsyncSession = Depends(get_db),
    # Stergerea e actiune privilegiata (admin + manager): butonul e ascuns
    # pentru `worker` in UI, iar aici o refuzam si pe server.
    account_id: int = Depends(get_settings_account_id),
):
    v = await db.get(ClientVehicol, v_id)
    if v is None or v.client_id != client_id or v.account_id != account_id:
        raise HTTPException(404, "Vehicolul nu a fost găsit.")
    await soft_delete(db, ClientVehicol, v_id)
