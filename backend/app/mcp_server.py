"""Serverul MCP al programarilor online — /mcp/<garaj>.

Asistentii AI (Claude, ChatGPT, orice client MCP) citesc sloturile libere si fac
programari in numele unui client. Foloseste ACEEASI logica de rezervare ca
site-ul public (`services/booking_service.py`) — inclusiv blocarea atomica a
slotului si limitele pe telefon.

Garajul vine din adresa: /mcp/<booking_settings.public_slug>. Dispecerul de mai
jos il pune intr-un header intern, citit de unelte din contextul cererii; un
header trimis de client cu acelasi nume e inlocuit, deci nu se poate alege alt
garaj decat cel din adresa.

Prototip: fara OAuth. Clientul e identificat prin telefon, ca pe site-ul public;
IP-ul nu se salveaza (e al furnizorului AI, nu al clientului).
"""
from __future__ import annotations
import logging
import time as _time
from datetime import date, datetime, timedelta
from typing import Annotated, Any

from fastapi import HTTPException
from mcp.server.mcpserver import Context, MCPServer
from mcp.server.mcpserver.exceptions import ToolError
from mcp.server.transport_security import TransportSecuritySettings
from pydantic import Field
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from starlette.responses import JSONResponse

from app.database import AsyncSessionLocal
from app.models.account import Account
from app.models.booking import BookingService, BookingSettings
from app.models.location import Location
from app.models.programare import ProgramareSource, ProgramareStatus
from app.services import booking_service
from app.services.booking_service import TZ, BookingInput
from app.utils.phone import normalize_phone
from app.utils.public_throttle import hit
from app.utils.slug import is_valid_slug

log = logging.getLogger("berlinstar.mcp")

GARAGE_HEADER = "x-berlinstar-garage"
MAX_SLOT_DAYS = 14

_WEEKDAYS = ["luni", "marți", "miercuri", "joi", "vineri", "sâmbătă", "duminică"]
_MONTHS = ["ianuarie", "februarie", "martie", "aprilie", "mai", "iunie", "iulie",
           "august", "septembrie", "octombrie", "noiembrie", "decembrie"]
_STATUS = {
    ProgramareStatus.PROGRAMAT: "confirmed",
    ProgramareStatus.IN_LUCRU: "in_progress",
    ProgramareStatus.EXECUTAT: "completed",
    ProgramareStatus.ANULAT: "cancelled",
}

INSTRUCTIONS = """\
Booking assistant for one car service / tyre shop (garage). All times are local
garage time (Europe/Bucharest). Typical flow:
1. Call get_garage_info to learn the services (with their ids and durations),
   opening hours and contact details.
2. Call list_available_slots for the service and the dates the customer wants.
   Only offer times returned by this tool.
3. Before booking, collect the customer's name, phone number and a short
   description of the problem; car make, model and year are optional but useful.
   Confirm the chosen time with the customer, then call create_booking.
   The booking is confirmed immediately; give the customer the booking code.
4. find_bookings lists a customer's upcoming bookings by phone number;
   cancel_booking needs the booking code and the same phone number.
Customers are usually Romanian: answer in the customer's language.
"""

mcp = MCPServer(
    name="berlinstar-programari",
    title="Programări service auto",
    instructions=INSTRUCTIONS,
    version="0.1.0",
)


# ─── Garajul si formatare ────────────────────────────────────────────────────

def _garage_slug(ctx: Context) -> str:
    headers = ctx.headers or {}
    slug = headers.get(GARAGE_HEADER) if hasattr(headers, "get") else None
    if not slug:
        raise ToolError("Garage not identified. Connect using the garage's MCP address (/mcp/<garage>).")
    return slug


async def _load_settings(db, slug: str) -> BookingSettings:
    s = (await db.execute(
        select(BookingSettings).where(BookingSettings.public_slug == slug)
    )).scalar_one_or_none()
    if s is None or not s.enabled:
        raise ToolError("Online booking is not available for this garage. Please call the garage.")
    account = await db.get(Account, s.account_id)
    if account is None or account.is_deleted or account.is_locked:
        raise ToolError("Online booking is not available for this garage. Please call the garage.")
    return s


def _local(dt: datetime) -> datetime:
    return booking_service._aware(dt).astimezone(TZ)


def _label(dt: datetime) -> str:
    d = _local(dt)
    return f"{_WEEKDAYS[d.weekday()]}, {d.day} {_MONTHS[d.month - 1]} {d.year}, ora {d:%H:%M}"


def _parse_date(value: str, field: str) -> date:
    try:
        return date.fromisoformat(value.strip())
    except ValueError:
        raise ToolError(f"{field} must be a date in YYYY-MM-DD format, got {value!r}.")


def _parse_start(value: str) -> datetime:
    try:
        dt = datetime.fromisoformat(value.strip().replace(" ", "T"))
    except ValueError:
        raise ToolError(f"start must look like 2026-10-05T09:30 (local garage time), got {value!r}.")
    return dt if dt.tzinfo else dt.replace(tzinfo=TZ)


def _tool_error(exc: HTTPException) -> ToolError:
    return ToolError(str(exc.detail))


async def _services(db, settings: BookingSettings) -> dict[int, BookingService]:
    rows = (await db.execute(
        select(BookingService).where(BookingService.booking_settings_id == settings.id)
    )).scalars().all()
    return {x.id: x for x in rows}


def _booking_out(p, services: dict[int, BookingService]) -> dict[str, Any]:
    svc = services.get(p.booking_service_id) if p.booking_service_id else None
    return {
        "booking_code": p.public_ref,
        "status": _STATUS.get(ProgramareStatus(p.status), "confirmed"),
        "start": _local(p.start_time).isoformat(timespec="minutes"),
        "end": _local(p.end_time).isoformat(timespec="minutes"),
        "when": _label(p.start_time),
        "service": svc.name if svc else None,
    }


# ─── Unelte ──────────────────────────────────────────────────────────────────

@mcp.tool(
    title="Garage info",
    description=(
        "Get the garage's name, address, phone, opening hours, booking rules and the list of "
        "services that can be booked (with service_id and duration). Call this first."
    ),
)
async def get_garage_info(ctx: Context) -> dict[str, Any]:
    async with AsyncSessionLocal() as db:
        s = await _load_settings(db, _garage_slug(ctx))
        loc = (await db.execute(
            select(Location).where(Location.id == s.location_id).options(selectinload(Location.company))
        )).scalar_one()
        company = loc.company if loc.company and not loc.company.is_deleted else None
        services = sorted(
            (x for x in (await _services(db, s)).values() if x.active),
            key=lambda x: (x.sort_order, x.id),
        )
        hours: dict[str, list[str]] = {}
        for h in s.hours:
            hours.setdefault(_WEEKDAYS[h.weekday], []).append(f"{h.open_time:%H:%M}-{h.close_time:%H:%M}")
        return {
            "garage": s.site_name,
            "location": loc.name,
            "address": company.address if company else None,
            "phone": company.phone if company else None,
            "timezone": str(TZ),
            "today": datetime.now(TZ).date().isoformat(),
            "opening_hours": {d: hours.get(d, ["closed"]) for d in _WEEKDAYS},
            "closed_on_public_holidays": s.closed_on_holidays,
            "services": [
                {"service_id": x.id, "name": x.name, "duration_minutes": x.duration_minutes} for x in services
            ],
            "rules": {
                "book_at_least_minutes_ahead": s.lead_minutes,
                "book_at_most_days_ahead": s.horizon_days,
                "cancel_online_until_minutes_before": s.cancel_cutoff_minutes,
            },
        }


@mcp.tool(
    title="List available slots",
    description=(
        "List free appointment times for a service between two dates (inclusive, at most "
        f"{MAX_SLOT_DAYS} days). Returns times grouped by day, in local garage time. "
        "Only these times can be booked."
    ),
)
async def list_available_slots(
    ctx: Context,
    date_from: Annotated[str, Field(description="First day, YYYY-MM-DD.")],
    date_to: Annotated[str | None, Field(description="Last day, YYYY-MM-DD. Defaults to date_from + 6 days.")] = None,
    service_id: Annotated[int | None, Field(description="service_id from get_garage_info. Omit only if the garage has no services.")] = None,
) -> dict[str, Any]:
    d_from = _parse_date(date_from, "date_from")
    d_to = _parse_date(date_to, "date_to") if date_to else d_from + timedelta(days=6)
    if (d_to - d_from).days >= MAX_SLOT_DAYS:
        raise ToolError(f"Ask for at most {MAX_SLOT_DAYS} days at a time.")
    async with AsyncSessionLocal() as db:
        s = await _load_settings(db, _garage_slug(ctx))
        hit(f"mcp-slots:{s.id}", 600, 3600)
        try:
            slots = await booking_service.list_slots(db, s, d_from, d_to, service_id)
            svc = await booking_service.get_service(db, s, service_id)
        except HTTPException as exc:
            raise _tool_error(exc)
    days: dict[str, list[str]] = {}
    for x in slots:
        local = _local(x.start)
        days.setdefault(local.date().isoformat(), []).append(f"{local:%H:%M}")
    return {
        "service": svc.name if svc else None,
        "duration_minutes": svc.duration_minutes if svc else s.slot_minutes,
        "days": [
            {"date": d, "weekday": _WEEKDAYS[date.fromisoformat(d).weekday()], "times": t}
            for d, t in days.items()
        ],
        "note": "No free times in this range." if not days else
                "To book, pass start as '<date>T<time>', e.g. " + f"'{next(iter(days))}T{days[next(iter(days))][0]}'.",
    }


@mcp.tool(
    title="Create booking",
    description=(
        "Book an appointment for the customer. The booking is confirmed immediately and the slot is "
        "locked. Use a start time returned by list_available_slots. Confirm the details with the "
        "customer before calling. Returns the booking code the customer needs to check or cancel."
    ),
)
async def create_booking(
    ctx: Context,
    start: Annotated[str, Field(description="Local garage time from list_available_slots, e.g. 2026-10-05T09:30.")],
    customer_name: Annotated[str, Field(description="Customer's full name.", min_length=2, max_length=100)],
    phone: Annotated[str, Field(description="Customer's phone number, e.g. 0740 123 456.")],
    problem_description: Annotated[str, Field(description="Short description of the problem or requested work.", min_length=3, max_length=500)],
    service_id: Annotated[int | None, Field(description="service_id from get_garage_info.")] = None,
    car_make: Annotated[str | None, Field(description="Optional, e.g. Dacia.", max_length=60)] = None,
    car_model: Annotated[str | None, Field(description="Optional, e.g. Logan.", max_length=60)] = None,
    car_year: Annotated[int | None, Field(description="Optional, e.g. 2019.", ge=1950, le=2100)] = None,
) -> dict[str, Any]:
    if normalize_phone(phone) is None:
        raise ToolError("The phone number is not valid. Ask the customer for a valid phone number.")
    async with AsyncSessionLocal() as db:
        s = await _load_settings(db, _garage_slug(ctx))
        hit(f"mcp-book:{s.id}", 60, 3600)
        try:
            p = await booking_service.create_booking(
                db, s,
                BookingInput(
                    start=_parse_start(start), nume=customer_name, telefon=phone,
                    descriere=problem_description, service_id=service_id,
                    marca=(car_make or "").strip() or None, model=(car_model or "").strip() or None, an=car_year,
                ),
                source=ProgramareSource.MCP,
            )
        except HTTPException as exc:
            if exc.status_code == 409:
                raise ToolError("That time was just taken. Call list_available_slots again and offer another time.")
            raise _tool_error(exc)
        out = _booking_out(p, await _services(db, s))
    log.info("MCP: programare %s creata la %s", out["booking_code"], s.public_slug)
    return {**out, "garage": s.site_name,
            "message": "The appointment is confirmed. Give the customer the booking code."}


@mcp.tool(
    title="Find bookings",
    description="List the upcoming bookings made with a phone number at this garage.",
)
async def find_bookings(
    ctx: Context,
    phone: Annotated[str, Field(description="The phone number used for the booking.")],
) -> dict[str, Any]:
    async with AsyncSessionLocal() as db:
        s = await _load_settings(db, _garage_slug(ctx))
        phone_n = normalize_phone(phone)
        hit(f"mcp-lookup:{s.id}:{phone_n}", 30, 3600)
        try:
            rows = await booking_service.find_by_phone(db, s, phone)
        except HTTPException as exc:
            raise _tool_error(exc)
        services = await _services(db, s)
        return {"bookings": [_booking_out(p, services) for p in rows]}


@mcp.tool(
    title="Cancel booking",
    description=(
        "Cancel a booking. Needs the booking code and the phone number used when booking. "
        "Confirm with the customer first. Late cancellations must be made by phone."
    ),
)
async def cancel_booking(
    ctx: Context,
    booking_code: Annotated[str, Field(description="The booking code, e.g. K7Q2M9.")],
    phone: Annotated[str, Field(description="The phone number used for the booking.")],
) -> dict[str, Any]:
    async with AsyncSessionLocal() as db:
        s = await _load_settings(db, _garage_slug(ctx))
        hit(f"mcp-cancel:{s.id}", 60, 3600)
        try:
            p = await booking_service.cancel_booking(db, s, booking_code, phone)
        except HTTPException as exc:
            raise _tool_error(exc)
        return _booking_out(p, await _services(db, s))


# ─── Transport HTTP ──────────────────────────────────────────────────────────

# Stateless + JSON: fiecare cerere e independenta (merge cu orice numar de
# workeri si dupa restart). Protectia DNS-rebinding a SDK-ului e pentru servere
# locale fara autentificare; serverul asta e public, pe domeniul nostru.
mcp.streamable_http_app(
    stateless_http=True,
    json_response=True,
    host="0.0.0.0",
    transport_security=TransportSecuritySettings(enable_dns_rebinding_protection=False),
)
session_manager = mcp.session_manager

# Slug-urile existente, tinute scurt in memorie ca o adresa gresita sa primeasca
# 404 la conectare fara o interogare la fiecare mesaj.
_known: dict[str, float] = {}
_KNOWN_TTL = 60.0


async def _garage_exists(slug: str) -> bool:
    now = _time.monotonic()
    if _known.get(slug, 0) > now:
        return True
    async with AsyncSessionLocal() as db:
        found = await db.scalar(select(BookingSettings.id).where(
            BookingSettings.public_slug == slug, BookingSettings.enabled == True,  # noqa: E712
        ))
    if found is not None:
        _known[slug] = now + _KNOWN_TTL
    return found is not None


class McpDispatchMiddleware:
    """Trimite /mcp/<garaj> la serverul MCP; restul cererilor merg mai departe."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or not scope["path"].startswith("/mcp/"):
            return await self.app(scope, receive, send)
        parts = [p for p in scope["path"].split("/") if p]
        slug = parts[1] if len(parts) == 2 else ""
        if not is_valid_slug(slug) or not await _garage_exists(slug):
            return await JSONResponse({"detail": "Garajul nu există sau nu primește programări online."}, 404)(
                scope, receive, send,
            )
        if scope["method"] == "GET":
            # GET deschide fluxul SSE pentru notificari de la server. In modul
            # stateless nu avem ce trimite pe el, iar SDK-ul il inchide
            # incomplet (prin Caddy clientul ramane agatat). Specificatia MCP
            # permite 405 aici; clientii trec pe POST.
            return await JSONResponse(
                {"detail": "Serverul nu oferă flux SSE; folosiți POST."}, 405, headers={"Allow": "POST"},
            )(scope, receive, send)
        headers = [(k, v) for k, v in scope["headers"] if k.lower() != GARAGE_HEADER.encode()]
        headers.append((GARAGE_HEADER.encode(), slug.encode()))
        await session_manager.handle_request({**scope, "headers": headers}, receive, send)
