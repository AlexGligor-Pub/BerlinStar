"""Endpoint-uri interne pentru serviciul Radar AI: context de business + chei AI.

Mount: /api/internal/* — autentificare doar cu X-Service-Token (fara JWT), vezi ADR §4/§8.
"""
from __future__ import annotations

import hmac

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import RADAR_SHARED_SECRET
from app.ai_settings import load_ai_settings
from app.database import get_db
from app.models.account import Account
from app.models.company import Company
from app.models.item import Item

# Acelasi plafon ca `radar/engine.py::MAX_ITEMS_IN_CONTEXT` si `radar/discovery.py::MAX_ITEMS`;
# duplicat intentionat, `app/radar/` pleaca in serviciu.
MAX_ITEMS_IN_CONTEXT = 60


async def require_service_token(x_service_token: str | None = Header(default=None)) -> None:
    """Token de serviciu comun, comparat in timp constant."""
    if not x_service_token or not hmac.compare_digest(
        x_service_token.encode("utf-8", "replace"), RADAR_SHARED_SECRET.encode("utf-8")
    ):
        raise HTTPException(401, "Token de serviciu invalid.")


router = APIRouter(dependencies=[Depends(require_service_token)])


@router.get("/business-context")
async def get_business_context(
    account_id: int = Query(...),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Numele contului, firmele active si un esantion din nomenclator."""
    account = await db.get(Account, account_id)
    if account is None:
        raise HTTPException(404, "Contul nu a fost gasit.")

    companies = (await db.execute(
        select(Company).where(Company.account_id == account_id, Company.is_deleted == False)  # noqa: E712
    )).scalars().all()

    items = (await db.execute(
        select(Item)
        .where(Item.account_id == account_id, Item.is_deleted == False)  # noqa: E712
        .order_by(Item.id)
        .limit(MAX_ITEMS_IN_CONTEXT)
    )).scalars().all()

    return {
        "account_name": account.name,
        "companies": [
            {
                "id": c.id,
                "cui": c.cui,
                "name": c.name,
                "address": c.address or "",
                "website": c.website or "",
                "description": c.description or "",
                "street": c.street or "",
                "city": c.city or "",
                "county_code": c.county_code or "",
            }
            for c in companies
        ],
        "items": [
            {
                "name": i.name,
                "type": i.type.value if hasattr(i.type, "value") else str(i.type),
                "price": float(i.price) if i.price is not None else None,
                "unit": i.unit,
            }
            for i in items
        ],
    }


@router.get("/ai-config")
async def get_ai_config(db: AsyncSession = Depends(get_db)) -> dict:
    """Cheile si tarifele AI decriptate; nu se logheaza niciodata."""
    s = await load_ai_settings(db)
    return {
        "api_key": s.api_key,
        "places_key": s.places_key,
        "model": s.model,
        "price_in": s.price_in,
        "price_out": s.price_out,
    }
