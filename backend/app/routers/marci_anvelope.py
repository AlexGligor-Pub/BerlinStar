from __future__ import annotations
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_account_id
from app.models.marca_anvelopa import MarcaAnvelopa
from app.schemas.marca_anvelopa import MarcaCreate, MarcaRead
from app.schemas.common import Page
from app.utils.paginate import paginate

router = APIRouter()


# Lista globala de marci aprobate (vizibila tuturor conturilor).
# Marcile pending NU apar aici — devin selectabile DOAR dupa aprobare admin.
@router.get("", response_model=Page[MarcaRead])
async def list_marci(
    last_id: int | None = None,
    limit: int = 200,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),  # noqa: ARG001  (auth required)
):
    limit = min(limit, 500)
    stmt = select(MarcaAnvelopa).where(
        MarcaAnvelopa.status == "approved",
        MarcaAnvelopa.is_deleted == False,
    )
    if last_id is not None:
        stmt = stmt.where(MarcaAnvelopa.id > last_id)
    stmt = stmt.order_by(MarcaAnvelopa.nume, MarcaAnvelopa.id).limit(limit + 1)
    return await paginate(db, stmt, limit)


# Istoricul propunerilor proprii (orice status) — userul vede statusul propunerilor lui.
@router.get("/mele-propuneri", response_model=Page[MarcaRead])
async def list_propunerile_mele(
    last_id: int | None = None,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    limit = min(limit, 200)
    stmt = select(MarcaAnvelopa).where(
        MarcaAnvelopa.proposed_by_account_id == account_id,
        MarcaAnvelopa.is_deleted == False,
    )
    if last_id is not None:
        stmt = stmt.where(MarcaAnvelopa.id > last_id)
    stmt = stmt.order_by(MarcaAnvelopa.created_at.desc(), MarcaAnvelopa.id.desc()).limit(limit + 1)
    return await paginate(db, stmt, limit)


# Propune o marca noua. Devine pending si NU apare in dropdown-uri pana
# adminul o aproba din AdminV2. Verificare case-insensitive de duplicate.
@router.post("/propune", response_model=MarcaRead, status_code=201)
async def propune_marca(
    body: MarcaCreate,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    nume = body.nume.strip()
    if not nume:
        raise HTTPException(400, "Numele mărcii este obligatoriu.")
    # Detectare duplicat case-insensitive (orice status, exclud sterse).
    existing = (await db.execute(
        select(MarcaAnvelopa).where(
            func.lower(func.trim(MarcaAnvelopa.nume)) == nume.lower(),
            MarcaAnvelopa.is_deleted == False,
        )
    )).scalar_one_or_none()
    if existing is not None:
        if existing.status == "approved":
            raise HTTPException(
                status_code=409,
                detail={
                    "status": "approved",
                    "id": existing.id,
                    "nume": existing.nume,
                    "message": f"Marca „{existing.nume}” există deja, o poți selecta direct.",
                },
            )
        if existing.status == "pending":
            raise HTTPException(
                status_code=409,
                detail={
                    "status": "pending",
                    "id": existing.id,
                    "nume": existing.nume,
                    "message": f"Marca „{existing.nume}” este deja propusă și așteaptă aprobarea adminului.",
                },
            )
        # rejected -> permitem re-propunerea: actualizam randul existent
        existing.status = "pending"
        existing.proposed_by_account_id = account_id
        existing.rejected_at = None
        existing.updated_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(existing)
        return existing

    marca = MarcaAnvelopa(
        nume=nume,
        status="pending",
        proposed_by_account_id=account_id,
    )
    db.add(marca)
    await db.commit()
    await db.refresh(marca)
    return marca
