from __future__ import annotations
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
# Factura Rapida e o zona `advanced` (admin + manager), ca si ruta din UI.
from app.dependencies import get_advanced_account_id
from app.models.company import Company
from app.models.location import Location

router = APIRouter()


@router.get("/companies-meta")
async def list_companies_meta(
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_advanced_account_id),
):
    """Returneaza firmele active pentru contul curent, fiecare cu locatiile asociate.

    Foloseste de Factura Rapida pentru picker-ul firma/locatie. Endpoint dedicat ca
    payload-ul sa fie minim (id+name) si filtrat strict pe ce are register configurat.
    """
    rows = (await db.execute(
        select(Company)
        .where(Company.account_id == account_id, Company.is_deleted == False)
        .order_by(Company.name)
    )).scalars().all()

    locations = (await db.execute(
        select(Location)
        .where(
            Location.account_id == account_id,
            Location.is_deleted == False,
            Location.company_id.is_not(None),
            Location.register_id.is_not(None),
        )
        .order_by(Location.name)
    )).scalars().all()

    by_company: dict[int, list[dict]] = {}
    for loc in locations:
        by_company.setdefault(loc.company_id, []).append({"id": loc.id, "name": loc.name})

    return [
        {
            "company_id": c.id,
            "name": c.name,
            "cui": c.cui,
            "is_vat_payer": c.is_vat_payer,
            "tva_percentage": c.tva_percentage,
            "locations": by_company.get(c.id, []),
        }
        for c in rows
        if by_company.get(c.id)
    ]
