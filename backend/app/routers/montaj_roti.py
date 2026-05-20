from __future__ import annotations
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, update
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_account_id
from app.models.montaj_rota import MontajRota
from app.models.marca_anvelopa import MarcaAnvelopa
from app.models.dimensiune_anvelopa import DimensiuneAnvelopa
from app.models.profil_anvelopa import ProfilAnvelopa
from app.models.cod_dot_anvelopa import CodDotAnvelopa
from app.schemas.montaj_rota import MontajRotaRead, MontajRotiBulkUpsert

router = APIRouter()


def _serialize(
    r: MontajRota,
    marci: dict[int, str],
    dim: dict[int, str],
    prof: dict[int, str],
    dot: dict[int, str],
) -> dict:
    return {
        "id": r.id,
        "receipt_id": r.receipt_id,
        "pozitie": r.pozitie.value if hasattr(r.pozitie, "value") else r.pozitie,
        "presiune": r.presiune,
        "ordine": r.ordine,
        "marca_id": r.marca_id,
        "dimensiune_id": r.dimensiune_id,
        "profil_id": r.profil_id,
        "dot_id": r.dot_id,
        "tip": r.tip.value if hasattr(r.tip, "value") else r.tip,
        "adancime": r.adancime,
        "cuplu_strangere": r.cuplu_strangere,
        "comments": r.comments,
        "marca_nume": marci.get(r.marca_id) if r.marca_id else None,
        "dimensiune_valoare": dim.get(r.dimensiune_id) if r.dimensiune_id else None,
        "profil_valoare": prof.get(r.profil_id) if r.profil_id else None,
        "dot_valoare": dot.get(r.dot_id) if r.dot_id else None,
        "created_at": r.created_at,
    }


async def _build_lookup_maps(
    db: AsyncSession, account_id: int, rows: list[MontajRota]
) -> tuple[dict[int, str], dict[int, str], dict[int, str], dict[int, str]]:
    marca_ids = {r.marca_id for r in rows if r.marca_id is not None}
    dim_ids = {r.dimensiune_id for r in rows if r.dimensiune_id is not None}
    prof_ids = {r.profil_id for r in rows if r.profil_id is not None}
    dot_ids = {r.dot_id for r in rows if r.dot_id is not None}

    marci: dict[int, str] = {}
    dim: dict[int, str] = {}
    prof: dict[int, str] = {}
    dot: dict[int, str] = {}

    if marca_ids:
        res = await db.execute(
            select(MarcaAnvelopa.id, MarcaAnvelopa.nume).where(
                MarcaAnvelopa.account_id == account_id,
                MarcaAnvelopa.id.in_(marca_ids),
            )
        )
        marci = {row[0]: row[1] for row in res.all()}
    if dim_ids:
        res = await db.execute(
            select(DimensiuneAnvelopa.id, DimensiuneAnvelopa.valoare).where(
                DimensiuneAnvelopa.account_id == account_id,
                DimensiuneAnvelopa.id.in_(dim_ids),
            )
        )
        dim = {row[0]: row[1] for row in res.all()}
    if prof_ids:
        res = await db.execute(
            select(ProfilAnvelopa.id, ProfilAnvelopa.valoare).where(
                ProfilAnvelopa.account_id == account_id,
                ProfilAnvelopa.id.in_(prof_ids),
            )
        )
        prof = {row[0]: row[1] for row in res.all()}
    if dot_ids:
        res = await db.execute(
            select(CodDotAnvelopa.id, CodDotAnvelopa.valoare).where(
                CodDotAnvelopa.account_id == account_id,
                CodDotAnvelopa.id.in_(dot_ids),
            )
        )
        dot = {row[0]: row[1] for row in res.all()}
    return marci, dim, prof, dot


@router.get("", response_model=list[MontajRotaRead])
async def list_montaj_roti(
    receipt_id: int,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    stmt = (
        select(MontajRota)
        .where(
            MontajRota.account_id == account_id,
            MontajRota.is_deleted == False,
            MontajRota.receipt_id == receipt_id,
        )
        .order_by(MontajRota.ordine.asc().nulls_last(), MontajRota.id.asc())
    )
    rows = (await db.execute(stmt)).scalars().all()
    marci, dim, prof, dot = await _build_lookup_maps(db, account_id, list(rows))
    return [_serialize(r, marci, dim, prof, dot) for r in rows]


@router.post("/bulk", response_model=list[MontajRotaRead])
async def bulk_upsert(
    body: MontajRotiBulkUpsert,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    now = datetime.now(timezone.utc)

    # Soft-delete pe roțile existente pentru acest receipt
    await db.execute(
        update(MontajRota)
        .where(
            MontajRota.account_id == account_id,
            MontajRota.receipt_id == body.receipt_id,
            MontajRota.is_deleted == False,
        )
        .values(is_deleted=True, deleted_at=now)
    )

    # Inserează noile roți
    created: list[MontajRota] = []
    for idx, item in enumerate(body.items):
        rec = MontajRota(
            account_id=account_id,
            receipt_id=body.receipt_id,
            pozitie=item.pozitie,
            presiune=item.presiune,
            ordine=item.ordine if item.ordine is not None else idx,
            marca_id=item.marca_id,
            dimensiune_id=item.dimensiune_id,
            profil_id=item.profil_id,
            dot_id=item.dot_id,
            tip=item.tip,
            adancime=item.adancime,
            cuplu_strangere=item.cuplu_strangere,
            comments=item.comments,
        )
        db.add(rec)
        created.append(rec)

    await db.commit()
    for rec in created:
        await db.refresh(rec)

    marci, dim, prof, dot = await _build_lookup_maps(db, account_id, created)
    return [_serialize(r, marci, dim, prof, dot) for r in created]


@router.delete("/{rota_id}", status_code=204)
async def delete_rota(
    rota_id: int,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    rec = await db.get(MontajRota, rota_id)
    if rec is None or rec.account_id != account_id or rec.is_deleted:
        raise HTTPException(404, "Roata nu a fost găsită.")
    rec.is_deleted = True
    rec.deleted_at = datetime.now(timezone.utc)
    await db.commit()
