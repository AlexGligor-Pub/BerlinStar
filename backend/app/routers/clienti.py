from __future__ import annotations
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, tuple_
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
        # Keyset aliniat cu ORDER BY (nume, id); cursorul ramane id-ul ultimului rand.
        last_nume = select(Client.nume).where(Client.id == last_id).scalar_subquery()
        stmt = stmt.where(tuple_(Client.nume, Client.id) > tuple_(last_nume, last_id))
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


async def _sync_client_plate_to_garage(db: AsyncSession, account_id: int, client: Client) -> None:
    """Placuta scrisa pe fisa clientului (`clienti.numar_masina`) trebuie sa existe
    si ca rand in `client_vehicole`.

    POS-ul si Receptia caută masina DOAR in garaj (`/vehicole-by-plate`), asa ca un
    client creat din formular cu numar_masina completat nu era gasit la tastarea
    plăcuței: exista in Clienti, dar nu in garaj. Cream rândul lipsa la creare si la
    editare, deci decalajul nu se mai formeaza.

    Doar adaugam, niciodata nu redenumim si nu stergem: daca operatorul schimba
    plăcuța de pe fisa, nu putem deosebi o corectie de tastare de „clientul are alta
    masina", iar un rand in plus il poate sterge el din garaj — km, VIN si
    observatiile suprascrise pe rândul vechi nu s-ar mai putea recupera.
    """
    plate = (client.numar_masina or "").strip()
    if not plate:
        return
    existing = await db.scalar(
        select(ClientVehicol.id)
        .where(
            ClientVehicol.account_id == account_id,
            ClientVehicol.client_id == client.id,
            ClientVehicol.is_deleted == False,
            normalized_plate_column(ClientVehicol.numar_masina) == normalize_plate(plate),
        )
        .limit(1)
    )
    if existing is not None:
        return
    db.add(ClientVehicol(account_id=account_id, client_id=client.id, numar_masina=plate))


@router.post("", response_model=ClientRead, status_code=201)
async def create_client(
    body: ClientCreate,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    client = Client(**body.model_dump(), account_id=account_id)
    db.add(client)
    await db.flush()  # avem nevoie de client.id pentru rândul din garaj
    await _sync_client_plate_to_garage(db, account_id, client)
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
    plate = normalize_plate(q_masina)
    if not plate:
        return []

    def _short(c: Client) -> ClientShort:
        return ClientShort(id=c.id, nume=c.nume, tip=c.tip, cui=c.cui, numar_masina=c.numar_masina)

    # 1) Masinile din garajul clientului (`client_vehicole`).
    stmt = (
        select(ClientVehicol, Client)
        .join(Client, Client.id == ClientVehicol.client_id)
        .where(
            ClientVehicol.account_id == account_id,
            ClientVehicol.is_deleted == False,
            Client.is_deleted == False,
            normalized_plate_column(ClientVehicol.numar_masina) == plate,
        )
        .order_by(ClientVehicol.id)
    )
    rows = (await db.execute(stmt)).all()
    out = [
        ClientVehicolWithClientRead(vehicol=ClientVehicolRead.model_validate(v), client=_short(c))
        for v, c in rows
    ]

    # 2) Clientii care au placuta doar pe fisa lor, in coloana veche
    #    `clienti.numar_masina`, fara rand in garaj. Asa arata orice client creat
    #    din formular inainte de `_sync_client_plate_to_garage` — pe Cont Demo,
    #    661 de clienti cu placuta si 14 randuri in garaj, deci POS-ul nu gasea
    #    aproape niciunul. Fara pasul asta, datele vechi rămân negasibile.
    matched = {c.id for _, c in rows}
    legacy_stmt = select(Client).where(
        Client.account_id == account_id,
        Client.is_deleted == False,
        normalized_plate_column(Client.numar_masina) == plate,
    ).order_by(Client.id)
    for c in (await db.execute(legacy_stmt)).scalars().all():
        if c.id in matched:
            continue
        out.append(
            ClientVehicolWithClientRead(
                # Rand sintetic: nu exista in `client_vehicole`, deci `id=0`.
                # Nu-l folosi la /clienti/{id}/vehicole/{v_id} — nu are ce sa
                # actualizeze. Consumatorul (POS) citeste doar placuta si clientul.
                vehicol=ClientVehicolRead(
                    id=0,
                    client_id=c.id,
                    account_id=account_id,
                    numar_masina=c.numar_masina or "",
                    marca=None,
                    model=None,
                    numar_kilometrii=None,
                    an_fabricatie=None,
                    vin=None,
                    observatii=None,
                    created_at=c.created_at,
                    updated_at=None,
                    is_deleted=False,
                ),
                client=_short(c),
            )
        )

    return out


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
    await db.flush()
    await _sync_client_plate_to_garage(db, account_id, client)
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
