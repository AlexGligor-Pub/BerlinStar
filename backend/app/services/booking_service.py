"""Logica programarilor online — folosita de API-ul public si, mai tarziu, de
serverul MCP. Orice decizie de calendar se ia aici, niciodata in client.

Disponibilitatea unui slot = capacitatea locatiei minus numarul maxim de
programari active care se suprapun simultan cu el. Se numara TOATE programarile
locatiei, inclusiv cele introduse la receptie.

Doua cereri simultane pe acelasi slot nu pot reusi amandoua: crearea ia un
advisory lock Postgres pe locatie, abia apoi reverifica ocuparea si insereaza.
Lock-ul tine pana la commit, deci a doua cerere vede programarea primei.
"""
from __future__ import annotations
import secrets
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from fastapi import HTTPException
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.booking import BookingService, BookingSettings
from app.models.client import Client
from app.models.programare import Programare, ProgramareSource, ProgramareStatus
from app.utils.phone import national_suffix, normalize_phone
from app.utils.romanian_holidays import get_romanian_holidays

TZ = ZoneInfo("Europe/Bucharest")

# Spatiul de nume al advisory lock-urilor pentru programari (prima cheie din
# pg_advisory_xact_lock(int, int)); a doua cheie e location_id.
_LOCK_NAMESPACE = 7001
# Cate programari viitoare active poate avea un telefon la un garaj.
MAX_ACTIVE_PER_PHONE = 3
MAX_RANGE_DAYS = 31
# Alfabet fara caractere usor de confundat (0/O, 1/I/L).
_REF_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"


@dataclass(frozen=True)
class Slot:
    start: datetime
    end: datetime


@dataclass
class BookingInput:
    start: datetime
    nume: str
    telefon: str
    descriere: str
    service_id: int | None = None
    marca: str | None = None
    model: str | None = None
    an: int | None = None


def _aware(dt: datetime) -> datetime:
    """SQLite intoarce datetime-uri naive; in Postgres sunt deja cu fus orar."""
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _active():
    return (Programare.is_deleted == False, Programare.status != ProgramareStatus.ANULAT)  # noqa: E712


async def get_service(db: AsyncSession, settings: BookingSettings, service_id: int | None) -> BookingService | None:
    if service_id is None:
        return None
    svc = await db.get(BookingService, service_id)
    if svc is None or svc.booking_settings_id != settings.id or not svc.active:
        raise HTTPException(400, "Serviciul ales nu exista.")
    return svc


def _duration(settings: BookingSettings, service: BookingService | None) -> timedelta:
    return timedelta(minutes=service.duration_minutes if service else settings.slot_minutes)


def candidate_slots(
    settings: BookingSettings, day: date, duration: timedelta, now: datetime | None = None,
) -> list[Slot]:
    """Sloturile zilei dupa program, sarbatori, timp minim si orizont — fara sa
    tina cont de ocupare."""
    now = now or _now()
    if settings.closed_on_holidays and day in get_romanian_holidays(day.year):
        return []
    earliest = now + timedelta(minutes=settings.lead_minutes)
    latest = now + timedelta(days=settings.horizon_days)
    step = timedelta(minutes=settings.slot_minutes)
    out: list[Slot] = []
    for h in settings.hours:
        if h.weekday != day.weekday():
            continue
        start = datetime.combine(day, h.open_time, TZ)
        close = datetime.combine(day, h.close_time, TZ)
        while start + duration <= close:
            if earliest <= start <= latest:
                out.append(Slot(start.astimezone(timezone.utc), (start + duration).astimezone(timezone.utc)))
            start += step
    return out


async def _busy_intervals(
    db: AsyncSession, settings: BookingSettings, start: datetime, end: datetime,
) -> list[tuple[datetime, datetime]]:
    rows = (await db.execute(
        select(Programare.start_time, Programare.end_time).where(
            Programare.account_id == settings.account_id,
            Programare.location_id == settings.location_id,
            Programare.start_time < end,
            Programare.end_time > start,
            *_active(),
        )
    )).all()
    return [(_aware(s), _aware(e)) for s, e in rows]


def _peak_overlap(busy: list[tuple[datetime, datetime]], start: datetime, end: datetime) -> int:
    """Numarul maxim de programari care ruleaza simultan in [start, end)."""
    events: list[tuple[datetime, int]] = []
    for s, e in busy:
        if s < end and e > start:
            events.append((max(s, start), 1))
            events.append((min(e, end), -1))
    # La acelasi moment, iesirile inaintea intrarilor: 9–10 si 10–11 nu se suprapun.
    events.sort(key=lambda ev: (ev[0], ev[1]))
    peak = cur = 0
    for _, delta in events:
        cur += delta
        peak = max(peak, cur)
    return peak


async def list_slots(
    db: AsyncSession, settings: BookingSettings, date_from: date, date_to: date,
    service_id: int | None = None, now: datetime | None = None,
) -> list[Slot]:
    if date_to < date_from:
        raise HTTPException(400, "Intervalul de date e invalid.")
    if (date_to - date_from).days >= MAX_RANGE_DAYS:
        raise HTTPException(400, f"Intervalul poate avea cel mult {MAX_RANGE_DAYS} de zile.")
    service = await get_service(db, settings, service_id)
    duration = _duration(settings, service)

    candidates: list[Slot] = []
    day = date_from
    while day <= date_to:
        candidates.extend(candidate_slots(settings, day, duration, now))
        day += timedelta(days=1)
    if not candidates:
        return []

    busy = await _busy_intervals(db, settings, candidates[0].start, candidates[-1].end)
    return [s for s in candidates if _peak_overlap(busy, s.start, s.end) < settings.capacity]


async def _lock_location(db: AsyncSession, location_id: int) -> None:
    if db.bind.dialect.name == "postgresql":
        await db.execute(
            text("SELECT pg_advisory_xact_lock(:ns, :loc)"),
            {"ns": _LOCK_NAMESPACE, "loc": location_id},
        )


async def _new_ref(db: AsyncSession, account_id: int) -> str:
    while True:
        ref = "".join(secrets.choice(_REF_ALPHABET) for _ in range(6))
        taken = await db.scalar(select(Programare.id).where(
            Programare.account_id == account_id, Programare.public_ref == ref,
        ))
        if taken is None:
            return ref


async def _match_client(db: AsyncSession, account_id: int, phone: str) -> int | None:
    """Clientul existent cu acelasi telefon, doar daca e unul singur.

    `clienti.telefon` e text liber („0740 123 456", „0740-123-456, 0256…"), asa
    ca potrivim pe ultimele 9 cifre, dupa ce scoatem separatorii.
    """
    digits = Client.telefon
    for ch in (" ", "-", ".", "(", ")", "/"):
        digits = func.replace(digits, ch, "")
    ids = (await db.execute(
        select(Client.id).where(
            Client.account_id == account_id,
            Client.is_deleted == False,  # noqa: E712
            digits.like(f"%{national_suffix(phone)}%"),
        ).limit(2)
    )).scalars().all()
    return ids[0] if len(ids) == 1 else None


def _notite(data: BookingInput) -> str:
    lines = [data.descriere.strip()]
    car = " ".join(str(x) for x in (data.marca, data.model, data.an) if x)
    if car:
        lines.append(f"Mașina: {car}")
    lines.append(f"Telefon: {data.telefon.strip()}")
    return "\n".join(lines)


async def create_booking(
    db: AsyncSession, settings: BookingSettings, data: BookingInput,
    source: ProgramareSource, client_ip: str | None = None, now: datetime | None = None,
) -> Programare:
    phone = normalize_phone(data.telefon)
    if phone is None:
        raise HTTPException(422, "Numărul de telefon nu e valid.")
    service = await get_service(db, settings, data.service_id)
    duration = _duration(settings, service)
    start = _aware(data.start).astimezone(timezone.utc)
    end = start + duration

    # Slotul trebuie sa fie unul oferit: in program, aliniat, in orizont.
    valid = candidate_slots(settings, start.astimezone(TZ).date(), duration, now)
    if Slot(start, end) not in valid:
        raise HTTPException(422, "Ora aleasă nu e disponibilă pentru programări online.")

    await _lock_location(db, settings.location_id)

    busy = await _busy_intervals(db, settings, start, end)
    if _peak_overlap(busy, start, end) >= settings.capacity:
        raise HTTPException(409, "Slotul tocmai a fost ocupat. Alegeți altă oră.")

    active_for_phone = await db.scalar(select(func.count(Programare.id)).where(
        Programare.account_id == settings.account_id,
        Programare.telefon_normalizat == phone,
        Programare.start_time >= (now or _now()),
        *_active(),
    ))
    if (active_for_phone or 0) >= MAX_ACTIVE_PER_PHONE:
        raise HTTPException(429, "Aveți deja prea multe programări active. Sunați-ne pentru altele.")

    nume = data.nume.strip()
    titlu = f"{service.name} — {nume}" if service else f"Programare online — {nume}"
    p = Programare(
        account_id=settings.account_id,
        location_id=settings.location_id,
        department_id=settings.department_id,
        titlu=titlu[:200],
        notite=_notite(data),
        client_id=await _match_client(db, settings.account_id, phone),
        start_time=start,
        end_time=end,
        status=ProgramareStatus.PROGRAMAT,
        source=source.value,
        public_ref=await _new_ref(db, settings.account_id),
        contact_nume=nume,
        contact_telefon=data.telefon.strip(),
        telefon_normalizat=phone,
        vehicul_marca=data.marca,
        vehicul_model=data.model,
        vehicul_an=data.an,
        client_ip=client_ip if source == ProgramareSource.WEB else None,
        booking_service_id=service.id if service else None,
    )
    db.add(p)
    await db.commit()
    await db.refresh(p)
    return p


async def find_by_phone(
    db: AsyncSession, settings: BookingSettings, telefon: str, now: datetime | None = None,
) -> list[Programare]:
    phone = normalize_phone(telefon)
    if phone is None:
        raise HTTPException(422, "Numărul de telefon nu e valid.")
    return list((await db.execute(
        select(Programare).where(
            Programare.account_id == settings.account_id,
            Programare.location_id == settings.location_id,
            Programare.telefon_normalizat == phone,
            Programare.start_time >= (now or _now()),
            Programare.is_deleted == False,  # noqa: E712
        ).order_by(Programare.start_time)
    )).scalars().all())


async def get_booking(
    db: AsyncSession, settings: BookingSettings, ref: str, telefon: str,
) -> Programare:
    """Programarea cu ref-ul dat, doar daca telefonul se potriveste — ref-ul
    singur nu e suficient ca sa vezi sau sa anulezi o programare."""
    phone = normalize_phone(telefon)
    p = None
    if phone is not None:
        p = (await db.execute(select(Programare).where(
            Programare.account_id == settings.account_id,
            Programare.location_id == settings.location_id,
            Programare.public_ref == ref.strip().upper(),
            Programare.telefon_normalizat == phone,
            Programare.is_deleted == False,  # noqa: E712
        ))).scalar_one_or_none()
    if p is None:
        raise HTTPException(404, "Programarea nu a fost găsită.")
    return p


async def cancel_booking(
    db: AsyncSession, settings: BookingSettings, ref: str, telefon: str, now: datetime | None = None,
) -> Programare:
    p = await get_booking(db, settings, ref, telefon)
    if p.status == ProgramareStatus.ANULAT:
        return p
    if p.status != ProgramareStatus.PROGRAMAT:
        raise HTTPException(409, "Programarea nu mai poate fi anulată online.")
    cutoff = _aware(p.start_time) - timedelta(minutes=settings.cancel_cutoff_minutes)
    if (now or _now()) > cutoff:
        raise HTTPException(409, "E prea târziu pentru anulare online. Sunați-ne.")
    p.status = ProgramareStatus.ANULAT
    p.updated_at = _now()
    await db.commit()
    await db.refresh(p)
    return p
