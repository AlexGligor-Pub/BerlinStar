"""Configurarea programarilor online, din Berlin Star (Configurari).

Per locatie: activare, numele site-ului public, program, durata slotului,
capacitate, servicii. Plus cheile API ale site-urilor publice.
Citirea si scrierea cer acces la Setari (admin + manager).
"""
from __future__ import annotations
import secrets
from datetime import datetime, time, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_settings_account_id
from app.models.booking import DEFAULT_SITE_NAME, BookingHours, BookingService, BookingSettings, PublicApiKey
from app.models.department import Department
from app.models.location import Location
from app.routers.public_booking import hash_key, mcp_url_for
from app.utils.slug import is_valid_slug, slugify
from app.schemas.booking import (
    ApiKeyCreate, ApiKeyCreated, ApiKeyRead, BookingHoursItem, BookingServiceItem,
    BookingSettingsRead, BookingSettingsWrite,
)

router = APIRouter()

# Programul propus la prima deschidere: L–V 08–17, sambata 08–13.
DEFAULT_HOURS = [(d, time(8), time(17)) for d in range(5)] + [(5, time(8), time(13))]


async def _location(db: AsyncSession, account_id: int, location_id: int) -> Location:
    loc = await db.get(Location, location_id)
    if loc is None or loc.account_id != account_id or loc.is_deleted:
        raise HTTPException(404, "Locația nu a fost găsită.")
    return loc


async def _load(db: AsyncSession, account_id: int, location_id: int) -> BookingSettings | None:
    return (await db.execute(
        select(BookingSettings).where(
            BookingSettings.account_id == account_id,
            BookingSettings.location_id == location_id,
        ).execution_options(populate_existing=True)
    )).scalar_one_or_none()


async def _slug_taken(db: AsyncSession, slug: str, exclude_id: int | None) -> bool:
    q = select(BookingSettings.id).where(BookingSettings.public_slug == slug)
    if exclude_id is not None:
        q = q.where(BookingSettings.id != exclude_id)
    return (await db.scalar(q)) is not None


async def _unique_slug(db: AsyncSession, name: str, exclude_id: int | None) -> str:
    base = slugify(name) or "garaj"
    if len(base) < 3:
        base = f"garaj-{base}"
    slug, n = base, 2
    while await _slug_taken(db, slug, exclude_id):
        slug, n = f"{base}-{n}", n + 1
    return slug


async def _read(db: AsyncSession, s: BookingSettings) -> BookingSettingsRead:
    services = (await db.execute(
        select(BookingService)
        .where(BookingService.booking_settings_id == s.id)
        .order_by(BookingService.sort_order, BookingService.id)
    )).scalars().all()
    return BookingSettingsRead(
        location_id=s.location_id,
        enabled=s.enabled,
        site_name=s.site_name,
        public_slug=s.public_slug,
        mcp_url=mcp_url_for(s.public_slug),
        department_id=s.department_id,
        slot_minutes=s.slot_minutes,
        capacity=s.capacity,
        lead_minutes=s.lead_minutes,
        horizon_days=s.horizon_days,
        cancel_cutoff_minutes=s.cancel_cutoff_minutes,
        closed_on_holidays=s.closed_on_holidays,
        hours=[BookingHoursItem(weekday=h.weekday, open_time=h.open_time, close_time=h.close_time) for h in s.hours],
        services=[BookingServiceItem.model_validate(x) for x in services],
    )


@router.get("/settings/{location_id}")
async def get_settings(
    location_id: int,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_settings_account_id),
) -> BookingSettingsRead:
    """Configurarea locatiei. Daca nu exista inca, o cream dezactivata, cu
    numele implicit si programul standard, ca formularul sa aiba ce afisa."""
    await _location(db, account_id, location_id)
    s = await _load(db, account_id, location_id)
    if s is None:
        s = BookingSettings(account_id=account_id, location_id=location_id)
        s.hours = [BookingHours(weekday=d, open_time=o, close_time=c) for d, o, c in DEFAULT_HOURS]
        s.public_slug = await _unique_slug(db, s.site_name or DEFAULT_SITE_NAME, None)
        db.add(s)
        await db.commit()
        s = await _load(db, account_id, location_id)
    return await _read(db, s)


@router.put("/settings/{location_id}")
async def put_settings(
    location_id: int,
    body: BookingSettingsWrite,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_settings_account_id),
) -> BookingSettingsRead:
    await _location(db, account_id, location_id)
    if body.department_id is not None:
        dept = await db.get(Department, body.department_id)
        if dept is None or dept.account_id != account_id:
            raise HTTPException(400, "Divizia nu există.")

    s = await _load(db, account_id, location_id)
    if s is None:
        s = BookingSettings(account_id=account_id, location_id=location_id)
        db.add(s)
    for field in (
        "enabled", "site_name", "department_id", "slot_minutes", "capacity", "lead_minutes",
        "horizon_days", "cancel_cutoff_minutes", "closed_on_holidays",
    ):
        setattr(s, field, getattr(body, field))
    s.hours = [BookingHours(weekday=h.weekday, open_time=h.open_time, close_time=h.close_time) for h in body.hours]
    s.updated_at = datetime.now(timezone.utc)
    await db.flush()

    if body.public_slug is not None and body.public_slug.strip().lower() != (s.public_slug or ""):
        slug = body.public_slug.strip().lower()
        if not is_valid_slug(slug):
            raise HTTPException(422, "Identificatorul poate avea doar litere mici, cifre și cratime (3–60 de caractere).")
        if await _slug_taken(db, slug, s.id):
            raise HTTPException(409, "Identificatorul e deja folosit de alt garaj.")
        s.public_slug = slug
    if s.public_slug is None:
        s.public_slug = await _unique_slug(db, s.site_name, s.id)

    # Serviciile nu se sterg: programarile vechi le refera. Cele care lipsesc
    # din lista se dezactiveaza.
    existing = {
        x.id: x for x in (await db.execute(
            select(BookingService).where(BookingService.booking_settings_id == s.id)
        )).scalars().all()
    }
    kept: set[int] = set()
    for order, item in enumerate(body.services):
        svc = existing.get(item.id) if item.id is not None else None
        if svc is None:
            svc = BookingService(booking_settings_id=s.id)
            db.add(svc)
        svc.name = item.name.strip()
        svc.duration_minutes = item.duration_minutes
        svc.active = item.active
        svc.sort_order = order
        if item.id is not None:
            kept.add(item.id)
    for sid, svc in existing.items():
        if sid not in kept:
            svc.active = False

    await db.commit()
    return await _read(db, await _load(db, account_id, location_id))


@router.get("/keys")
async def list_keys(
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_settings_account_id),
) -> list[ApiKeyRead]:
    rows = (await db.execute(
        select(PublicApiKey).where(PublicApiKey.account_id == account_id).order_by(PublicApiKey.id)
    )).scalars().all()
    return [ApiKeyRead.model_validate(k) for k in rows]


@router.post("/keys", status_code=201)
async def create_key(
    body: ApiKeyCreate,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_settings_account_id),
) -> ApiKeyCreated:
    await _location(db, account_id, body.location_id)
    plain = "bsk_" + secrets.token_urlsafe(32)
    key = PublicApiKey(
        account_id=account_id,
        location_id=body.location_id,
        name=body.name.strip(),
        prefix=plain[:12],
        key_hash=hash_key(plain),
    )
    db.add(key)
    await db.commit()
    await db.refresh(key)
    return ApiKeyCreated(**ApiKeyRead.model_validate(key).model_dump(), key=plain)


@router.delete("/keys/{key_id}", status_code=204)
async def revoke_key(
    key_id: int,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_settings_account_id),
) -> None:
    key = await db.get(PublicApiKey, key_id)
    if key is None or key.account_id != account_id:
        raise HTTPException(404, "Cheia nu a fost găsită.")
    if key.revoked_at is None:
        key.revoked_at = datetime.now(timezone.utc)
        await db.commit()
