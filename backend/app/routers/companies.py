from __future__ import annotations
from datetime import datetime, timezone, date
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import httpx

from app.database import get_db
from app.dependencies import get_account_id
from app.models.company import Company
from app.schemas.company import CompanyCreate, CompanyUpdate, CompanyRead
from app.schemas.common import Page
from app.utils.soft_delete import soft_delete
from app.utils.storage import upload_image, delete_image_by_url

router = APIRouter()

ANAF_URL = "https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva"
ANAF_TIMEOUT = 15.0


@router.get("", response_model=Page[CompanyRead])
async def list_companies(
    last_id: int | None = None,
    limit: int = 100,
    q: str | None = None,
    include_deleted: bool = False,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    limit = min(limit, 200)
    stmt = select(Company).where(Company.account_id == account_id)
    if not include_deleted:
        stmt = stmt.where(Company.is_deleted == False)
    if last_id is not None:
        stmt = stmt.where(Company.id > last_id)
    if q:
        stmt = stmt.where(
            Company.name.ilike(f"%{q}%") | Company.cui.cast(str).ilike(f"%{q}%")
        )
    stmt = stmt.order_by(Company.id).limit(limit + 1)

    rows = (await db.execute(stmt)).scalars().all()
    has_more = len(rows) > limit
    page = rows[:limit]
    return Page(items=page, next_cursor=page[-1].id if has_more else None)


@router.post("", response_model=CompanyRead, status_code=201)
async def create_company(
    body: CompanyCreate,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    company = Company(**body.model_dump(), account_id=account_id)
    db.add(company)
    await db.commit()
    await db.refresh(company)
    return company


@router.get("/anaf/{cui}")
async def anaf_lookup(
    cui: int,
    account_id: int = Depends(get_account_id),
):
    today = date.today().strftime("%Y-%m-%d")
    payload = [{"cui": cui, "data": today}]
    try:
        async with httpx.AsyncClient(timeout=ANAF_TIMEOUT) as client:
            resp = await client.post(ANAF_URL, json=payload)
            resp.raise_for_status()
            data = resp.json()
    except httpx.TimeoutException:
        raise HTTPException(504, "Timeout la serviciul ANAF.")
    except Exception:
        raise HTTPException(502, "Eroare la comunicarea cu ANAF.")

    found = data.get("found", [])
    if not found:
        raise HTTPException(404, "CUI-ul nu a fost găsit în ANAF.")

    entry = found[0]
    dg = entry.get("date_generale", {})
    tva = entry.get("inregistrare_scop_Tva", {})

    return {
        "cui": dg.get("cui"),
        "name": dg.get("denumire", ""),
        "address": dg.get("adresa"),
        "nr_reg_com": dg.get("nrRegCom"),
        "phone": dg.get("telefon") or None,
        "postal_code": dg.get("codPostal") or None,
        "is_vat_payer": tva.get("scpTVA"),
        "registration_status": dg.get("stare_inregistrare"),
    }


@router.get("/{company_id}", response_model=CompanyRead)
async def get_company(
    company_id: int,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    company = await db.get(Company, company_id)
    if company is None or company.account_id != account_id or company.is_deleted:
        raise HTTPException(404, "Compania nu a fost găsită.")
    return company


@router.patch("/{company_id}", response_model=CompanyRead)
async def update_company(
    company_id: int,
    body: CompanyUpdate,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    company = await db.get(Company, company_id)
    if company is None or company.account_id != account_id or company.is_deleted:
        raise HTTPException(404, "Compania nu a fost găsită.")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(company, k, v)
    company.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(company)
    return company


@router.post("/{company_id}/logo", response_model=CompanyRead)
async def upload_logo(
    company_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    company = await db.get(Company, company_id)
    if company is None or company.account_id != account_id or company.is_deleted:
        raise HTTPException(404, "Compania nu a fost găsită.")
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(400, "Fișierul trebuie să fie o imagine.")
    data = await file.read()
    if len(data) > 5 * 1024 * 1024:
        raise HTTPException(400, "Imaginea nu poate depăși 5MB.")
    old_url = company.logo_path
    url = upload_image(account_id, "companies/logos", data, file.content_type)
    company.logo_path = url
    company.updated_at = datetime.now(timezone.utc)
    await db.commit()
    if old_url:
        delete_image_by_url(old_url)
    await db.refresh(company)
    return company


@router.post("/{company_id}/background", response_model=CompanyRead)
async def upload_background(
    company_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    company = await db.get(Company, company_id)
    if company is None or company.account_id != account_id or company.is_deleted:
        raise HTTPException(404, "Compania nu a fost găsită.")
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(400, "Fișierul trebuie să fie o imagine.")
    data = await file.read()
    if len(data) > 1 * 1024 * 1024:
        raise HTTPException(400, "Imaginea de fundal nu poate depăși 1MB.")
    old_url = company.background_path
    url = upload_image(account_id, "companies/backgrounds", data, file.content_type)
    company.background_path = url
    company.updated_at = datetime.now(timezone.utc)
    await db.commit()
    if old_url:
        delete_image_by_url(old_url)
    await db.refresh(company)
    return company


@router.delete("/{company_id}", status_code=204)
async def delete_company(
    company_id: int,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    company = await db.get(Company, company_id)
    if company is None or company.account_id != account_id:
        raise HTTPException(404, "Compania nu a fost găsită.")
    await soft_delete(db, Company, company_id)
