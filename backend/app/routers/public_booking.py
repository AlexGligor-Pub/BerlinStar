"""API-ul public pentru programari online — /api/public/v1.

Singurele rute din aplicatie fara JWT. Autentificarea e cheia API a
instalarii (header `X-Api-Key`), care fixeaza contul si locatia; nimic din
cerere nu poate alege alt garaj.

Cheia sta in proxy-ul site-ului public, nu in browser. Tot proxy-ul trimite
IP-ul clientului in `X-Client-IP`; il credem doar pentru ca cererea a venit
cu o cheie valida.
"""
from __future__ import annotations
import hashlib
import ipaddress
import os
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.account import Account
from app.models.booking import BookingService, BookingSettings, PublicApiKey
from app.models.location import Location
from app.models.programare import Programare, ProgramareSource, ProgramareStatus
from app.schemas.booking import (
    BookingCreate, BookingPhone, BookingRead, PublicConfigRead, PublicServiceRead, SlotRead,
)
from app.services import booking_service
from app.services.booking_service import BookingInput, TZ
from app.utils.public_throttle import hit

router = APIRouter()

_STATUS = {
    ProgramareStatus.PROGRAMAT: "confirmed",
    ProgramareStatus.IN_LUCRU: "in_progress",
    ProgramareStatus.EXECUTAT: "completed",
    ProgramareStatus.ANULAT: "cancelled",
}


def mcp_url_for(slug: str | None) -> str | None:
    """URL-ul public al serverului MCP al unui garaj, daca e configurata adresa
    publica a Berlin Star (MCP_PUBLIC_BASE_URL)."""
    base = os.getenv("MCP_PUBLIC_BASE_URL", "").strip().rstrip("/")
    return f"{base}/mcp/{slug}" if base and slug else None


def hash_key(key: str) -> str:
    return hashlib.sha256(key.encode()).hexdigest()


@dataclass
class PublicContext:
    settings: BookingSettings
    key_id: int
    client_ip: str | None


def _client_ip(request: Request, forwarded: str | None) -> str | None:
    if forwarded:
        try:
            return str(ipaddress.ip_address(forwarded.strip()))
        except ValueError:
            pass
    return request.client.host if request.client else None


async def get_public_context(
    request: Request,
    x_api_key: str | None = Header(None, alias="X-Api-Key"),
    x_client_ip: str | None = Header(None, alias="X-Client-IP"),
    db: AsyncSession = Depends(get_db),
) -> PublicContext:
    if not x_api_key:
        raise HTTPException(401, "Lipsește cheia API.")
    key = (await db.execute(
        select(PublicApiKey).where(PublicApiKey.key_hash == hash_key(x_api_key))
    )).scalar_one_or_none()
    if key is None or key.revoked_at is not None:
        raise HTTPException(401, "Cheie API invalidă.")
    account = await db.get(Account, key.account_id)
    if account is None or account.is_deleted or account.is_locked:
        raise HTTPException(401, "Cheie API invalidă.")
    settings = (await db.execute(
        select(BookingSettings).where(
            BookingSettings.account_id == key.account_id,
            BookingSettings.location_id == key.location_id,
        )
    )).scalar_one_or_none()
    if settings is None or not settings.enabled:
        raise HTTPException(403, "Programările online nu sunt active.")

    now = datetime.now(timezone.utc)
    last = key.last_used_at
    if last is None or (last if last.tzinfo else last.replace(tzinfo=timezone.utc)) < now - timedelta(minutes=5):
        key.last_used_at = now
        await db.commit()

    ctx = PublicContext(settings=settings, key_id=key.id, client_ip=_client_ip(request, x_client_ip))
    # Plasa de siguranta per instalare, peste limitele per IP de mai jos.
    hit(f"key:{key.id}", 600, 60)
    return ctx


def _limit(ctx: PublicContext, action: str, limit: int, window_seconds: int) -> None:
    hit(f"{action}:{ctx.key_id}:{ctx.client_ip}", limit, window_seconds)


async def _service_names(db: AsyncSession, settings: BookingSettings) -> dict[int, str]:
    rows = (await db.execute(
        select(BookingService.id, BookingService.name)
        .where(BookingService.booking_settings_id == settings.id)
    )).all()
    return {i: n for i, n in rows}


def _to_read(p: Programare, services: dict[int, str]) -> BookingRead:
    return BookingRead(
        ref=p.public_ref or "",
        start=p.start_time,
        end=p.end_time,
        service=services.get(p.booking_service_id) if p.booking_service_id else None,
        status=_STATUS.get(ProgramareStatus(p.status), "confirmed"),
    )


@router.get("/config")
async def get_config(
    ctx: PublicContext = Depends(get_public_context),
    db: AsyncSession = Depends(get_db),
) -> PublicConfigRead:
    s = ctx.settings
    loc = (await db.execute(
        select(Location).where(Location.id == s.location_id).options(selectinload(Location.company))
    )).scalar_one()
    company = loc.company if loc.company and not loc.company.is_deleted else None
    services = (await db.execute(
        select(BookingService)
        .where(BookingService.booking_settings_id == s.id, BookingService.active == True)  # noqa: E712
        .order_by(BookingService.sort_order, BookingService.id)
    )).scalars().all()
    return PublicConfigRead(
        site_name=s.site_name,
        location_name=loc.name,
        company_name=company.name if company else None,
        address=company.address if company else None,
        phone=company.phone if company else None,
        email=company.email if company else None,
        timezone=str(TZ),
        slot_minutes=s.slot_minutes,
        horizon_days=s.horizon_days,
        cancel_cutoff_minutes=s.cancel_cutoff_minutes,
        services=[PublicServiceRead(id=x.id, name=x.name, duration_minutes=x.duration_minutes) for x in services],
        mcp_path=f"/mcp/{s.public_slug}" if s.public_slug else None,
        mcp_url=mcp_url_for(s.public_slug),
    )


@router.get("/slots")
async def get_slots(
    date_from: date = Query(..., alias="from"),
    date_to: date = Query(..., alias="to"),
    service_id: int | None = None,
    ctx: PublicContext = Depends(get_public_context),
    db: AsyncSession = Depends(get_db),
) -> list[SlotRead]:
    _limit(ctx, "slots", 120, 60)
    slots = await booking_service.list_slots(db, ctx.settings, date_from, date_to, service_id)
    return [SlotRead(start=s.start, end=s.end) for s in slots]


@router.post("/bookings", status_code=201)
async def create_booking(
    body: BookingCreate,
    ctx: PublicContext = Depends(get_public_context),
    db: AsyncSession = Depends(get_db),
) -> BookingRead:
    _limit(ctx, "book", 10, 3600)
    if body.website:
        raise HTTPException(400, "Cerere invalidă.")
    p = await booking_service.create_booking(
        db, ctx.settings,
        BookingInput(
            start=body.start, nume=body.nume, telefon=body.telefon, descriere=body.descriere,
            service_id=body.service_id, marca=body.marca, model=body.model, an=body.an,
        ),
        source=ProgramareSource.WEB, client_ip=ctx.client_ip,
    )
    return _to_read(p, await _service_names(db, ctx.settings))


@router.get("/bookings")
async def list_bookings(
    telefon: str = Query(..., min_length=6, max_length=30),
    ctx: PublicContext = Depends(get_public_context),
    db: AsyncSession = Depends(get_db),
) -> list[BookingRead]:
    _limit(ctx, "lookup", 20, 3600)
    rows = await booking_service.find_by_phone(db, ctx.settings, telefon)
    names = await _service_names(db, ctx.settings)
    return [_to_read(p, names) for p in rows]


@router.get("/bookings/{ref}")
async def get_booking(
    ref: str,
    telefon: str = Query(..., min_length=6, max_length=30),
    ctx: PublicContext = Depends(get_public_context),
    db: AsyncSession = Depends(get_db),
) -> BookingRead:
    _limit(ctx, "lookup", 20, 3600)
    p = await booking_service.get_booking(db, ctx.settings, ref, telefon)
    return _to_read(p, await _service_names(db, ctx.settings))


@router.post("/bookings/{ref}/cancel")
async def cancel_booking(
    ref: str,
    body: BookingPhone,
    ctx: PublicContext = Depends(get_public_context),
    db: AsyncSession = Depends(get_db),
) -> BookingRead:
    _limit(ctx, "cancel", 10, 3600)
    p = await booking_service.cancel_booking(db, ctx.settings, ref, body.telefon)
    return _to_read(p, await _service_names(db, ctx.settings))
