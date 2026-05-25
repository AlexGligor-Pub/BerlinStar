from __future__ import annotations
import unicodedata
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_account_id
from app.models.marca_anvelopa import MarcaAnvelopa
from app.schemas.marca_anvelopa import MarcaCreate, MarcaRead
from app.schemas.common import Page

router = APIRouter()


def _normalize_nume(raw: str) -> str:
    """NFKC + colapsare whitespace consecutiv. Previne duplicate „Pirelli "
    (cu NBSP / spatii multiple) sa treaca de check-ul case-insensitive."""
    return " ".join(unicodedata.normalize("NFKC", raw).split())


# Pentru pagination folosim `last_id` ca offset opac (sortare e pe nume/created_at,
# deci un cursor pe id n-ar fi monoton). Frontend-ul doar repaseaza cursorul.
def _build_page(rows, offset: int, limit: int) -> Page[MarcaRead]:
    has_more = len(rows) > limit
    page = rows[:limit]
    next_cursor = (offset + limit) if has_more else None
    return Page(items=page, next_cursor=next_cursor)


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
    offset = max(0, last_id or 0)
    stmt = (
        select(MarcaAnvelopa)
        .where(
            MarcaAnvelopa.status == "approved",
            MarcaAnvelopa.is_deleted == False,
        )
        .order_by(MarcaAnvelopa.nume, MarcaAnvelopa.id)
        .offset(offset)
        .limit(limit + 1)
    )
    rows = (await db.execute(stmt)).scalars().all()
    return _build_page(list(rows), offset, limit)


# Istoricul propunerilor proprii (orice status) — userul vede statusul propunerilor lui.
@router.get("/mele-propuneri", response_model=Page[MarcaRead])
async def list_propunerile_mele(
    last_id: int | None = None,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    limit = min(limit, 200)
    offset = max(0, last_id or 0)
    stmt = (
        select(MarcaAnvelopa)
        .where(
            MarcaAnvelopa.proposed_by_account_id == account_id,
            MarcaAnvelopa.is_deleted == False,
        )
        .order_by(MarcaAnvelopa.created_at.desc(), MarcaAnvelopa.id.desc())
        .offset(offset)
        .limit(limit + 1)
    )
    rows = (await db.execute(stmt)).scalars().all()
    return _build_page(list(rows), offset, limit)


# Propune o marca noua. Devine pending si NU apare in dropdown-uri pana
# adminul o aproba din AdminV2. Verificare case-insensitive + NFKC de duplicate.
@router.post("/propune", response_model=MarcaRead, status_code=201)
async def propune_marca(
    body: MarcaCreate,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    nume = _normalize_nume(body.nume)
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
    # Race condition: doua requesturi concurente pentru acelasi nume trec amandoua
    # de SELECT, dar indexul unic uq_marci_anvelope_nume_lower al doilea il prinde.
    # Convertim IntegrityError-ul intr-un 409 prietenos in loc de 500.
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        # Reincarc randul castigator si raspund cu un 409 pending.
        existing = (await db.execute(
            select(MarcaAnvelopa).where(
                func.lower(func.trim(MarcaAnvelopa.nume)) == nume.lower(),
                MarcaAnvelopa.is_deleted == False,
            )
        )).scalar_one_or_none()
        if existing is not None:
            raise HTTPException(
                status_code=409,
                detail={
                    "status": existing.status,
                    "id": existing.id,
                    "nume": existing.nume,
                    "message": f"Marca „{existing.nume}” a fost propusă în paralel.",
                },
            )
        # Daca s-a evaporat din alt motiv, re-arunc eroarea generica.
        raise HTTPException(409, "Conflict la inserarea mărcii.")
    await db.refresh(marca)
    return marca
