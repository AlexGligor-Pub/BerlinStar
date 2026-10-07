"""Programari online: disponibilitate, blocarea slotului, limite, anulare,
cheile API si numele implicit al site-ului public.

Rulabil direct:  python -m tests.test_public_booking  (din backend/)
"""
from __future__ import annotations
from datetime import date, datetime, time, timedelta, timezone

from starlette.requests import Request

from app.models.booking import DEFAULT_SITE_NAME, BookingHours, BookingService, BookingSettings
from app.models.location import Location
from app.models.programare import Programare, ProgramareSource, ProgramareStatus
from app.routers.booking_settings import create_key, get_settings, revoke_key
from app.routers.public_booking import get_public_context
from app.schemas.booking import ApiKeyCreate, BookingRead
from app.services import booking_service as bs
from app.services.booking_service import BookingInput, TZ, _peak_overlap
from app.utils import public_throttle
from app.utils.phone import normalize_phone
from tests._harness import make_account, make_client, make_session, raises_http, run

# Luni, 5 octombrie 2026, 09:00 in Bucuresti. Programam marti, 6 octombrie.
NOW = datetime(2026, 10, 5, 9, 0, tzinfo=TZ).astimezone(timezone.utc)
TUESDAY = date(2026, 10, 6)


def at(day: date, hh: int, mm: int = 0) -> datetime:
    return datetime.combine(day, time(hh, mm), TZ).astimezone(timezone.utc)


async def _fixture(capacity: int = 1, **kw):
    db = await make_session()
    acc = await make_account(db)
    loc = Location(account_id=acc.id, name="Centru")
    db.add(loc)
    await db.flush()
    s = BookingSettings(
        account_id=acc.id, location_id=loc.id, enabled=True, capacity=capacity,
        slot_minutes=60, lead_minutes=120, horizon_days=30, cancel_cutoff_minutes=120,
        closed_on_holidays=True, **kw,
    )
    s.hours = [BookingHours(weekday=1, open_time=time(8), close_time=time(12))]  # marti 08–12
    db.add(s)
    await db.commit()
    return db, acc, loc, s


def _input(hh: int = 8, telefon: str = "0740 123 456", **kw) -> BookingInput:
    return BookingInput(
        start=at(TUESDAY, hh), nume="Ion Pop", telefon=telefon, descriere="Schimb anvelope", **kw,
    )


async def _book(db, s, hh=8, telefon="0740 123 456", **kw):
    return await bs.create_booking(db, s, _input(hh, telefon, **kw), ProgramareSource.WEB, "1.2.3.4", now=NOW)


# ─── Telefon ─────────────────────────────────────────────────────────────────

def test_normalize_phone():
    for raw in ("0740 123 456", "0740-123-456", "+40 740 123 456", "0040740123456", "40740123456", "740123456"):
        assert normalize_phone(raw) == "+40740123456", raw
    assert normalize_phone("0256 123 456") == "+40256123456"
    assert normalize_phone("+49 151 23456789") == "+4915123456789"
    for bad in ("", "123", "0840 123 456", "07401234567", "abc", None):
        assert normalize_phone(bad) is None, bad


# ─── Sloturi ─────────────────────────────────────────────────────────────────

async def test_slots_follow_hours_lead_and_horizon():
    db, _, _, s = await _fixture()
    slots = await bs.list_slots(db, s, TUESDAY, TUESDAY, now=NOW)
    assert [x.start for x in slots] == [at(TUESDAY, h) for h in (8, 9, 10, 11)]
    # Miercuri nu e in program.
    assert await bs.list_slots(db, s, TUESDAY + timedelta(days=1), TUESDAY + timedelta(days=1), now=NOW) == []
    # Timpul minim: la 07:00 marti, cu 120 de minute, primul slot e 09:00.
    early = await bs.list_slots(db, s, TUESDAY, TUESDAY, now=at(TUESDAY, 7))
    assert early[0].start == at(TUESDAY, 9)
    # Orizontul: peste 30 de zile nu se ofera nimic.
    far = TUESDAY + timedelta(days=35)
    assert await bs.list_slots(db, s, far, far, now=NOW) == []


async def test_holidays_are_closed():
    db, _, _, s = await _fixture()
    christmas = date(2029, 12, 25)  # marti
    assert christmas.weekday() == 1
    later = datetime(2029, 12, 20, tzinfo=timezone.utc)
    assert await bs.list_slots(db, s, christmas, christmas, now=later) == []
    s.closed_on_holidays = False
    assert len(await bs.list_slots(db, s, christmas, christmas, now=later)) == 4


async def test_range_is_limited():
    db, _, _, s = await _fixture()
    await raises_http(400, bs.list_slots(db, s, TUESDAY, TUESDAY + timedelta(days=40), now=NOW))
    await raises_http(400, bs.list_slots(db, s, TUESDAY, TUESDAY - timedelta(days=1), now=NOW))


async def test_service_duration_changes_slots():
    db, _, _, s = await _fixture()
    svc = BookingService(booking_settings_id=s.id, name="Revizie", duration_minutes=120)
    db.add(svc)
    await db.commit()
    slots = await bs.list_slots(db, s, TUESDAY, TUESDAY, service_id=svc.id, now=NOW)
    # 2 ore in intervalul 08–12, pas de 60 de minute: 08, 09, 10.
    assert [x.start for x in slots] == [at(TUESDAY, h) for h in (8, 9, 10)]
    p = await _book(db, s, 9, service_id=svc.id)
    assert p.end_time.replace(tzinfo=timezone.utc) == at(TUESDAY, 11)
    assert p.titlu.startswith("Revizie")


def test_peak_overlap_back_to_back_is_not_concurrent():
    busy = [(at(TUESDAY, 9), at(TUESDAY, 10)), (at(TUESDAY, 10), at(TUESDAY, 11))]
    assert _peak_overlap(busy, at(TUESDAY, 9), at(TUESDAY, 11)) == 1
    busy.append((at(TUESDAY, 9, 30), at(TUESDAY, 10, 30)))
    assert _peak_overlap(busy, at(TUESDAY, 9), at(TUESDAY, 11)) == 2


# ─── Creare si capacitate ────────────────────────────────────────────────────

async def test_booking_fills_slot_and_second_is_409():
    db, _, _, s = await _fixture()
    p = await _book(db, s, 9)
    assert (p.source, p.status, p.telefon_normalizat) == ("web", ProgramareStatus.PROGRAMAT, "+40740123456")
    assert len(p.public_ref) == 6 and p.client_ip == "1.2.3.4"
    slots = await bs.list_slots(db, s, TUESDAY, TUESDAY, now=NOW)
    assert at(TUESDAY, 9) not in [x.start for x in slots]
    await raises_http(409, _book(db, s, 9, telefon="0722 000 111"))


async def test_capacity_two_allows_two():
    db, _, _, s = await _fixture(capacity=2)
    await _book(db, s, 9, telefon="0722 000 111")
    await _book(db, s, 9, telefon="0722 000 222")
    await raises_http(409, _book(db, s, 9, telefon="0722 000 333"))


async def test_internal_appointments_take_capacity():
    db, acc, loc, s = await _fixture()
    db.add(Programare(
        account_id=acc.id, location_id=loc.id, titlu="Receptie",
        start_time=at(TUESDAY, 10, 30), end_time=at(TUESDAY, 11, 30),
    ))
    await db.commit()
    starts = [x.start for x in await bs.list_slots(db, s, TUESDAY, TUESDAY, now=NOW)]
    assert starts == [at(TUESDAY, 8), at(TUESDAY, 9)]
    await raises_http(409, _book(db, s, 11))


async def test_cancelled_or_deleted_do_not_take_capacity():
    db, acc, loc, s = await _fixture()
    for kw in ({"status": ProgramareStatus.ANULAT}, {"is_deleted": True}):
        db.add(Programare(
            account_id=acc.id, location_id=loc.id, titlu="x",
            start_time=at(TUESDAY, 9), end_time=at(TUESDAY, 10), **kw,
        ))
    await db.commit()
    await _book(db, s, 9)


async def test_off_grid_or_out_of_hours_start_is_rejected():
    db, _, _, s = await _fixture()
    bad = BookingInput(start=at(TUESDAY, 9, 15), nume="Ion", telefon="0740123456", descriere="x y z")
    await raises_http(422, bs.create_booking(db, s, bad, ProgramareSource.WEB, now=NOW))
    await raises_http(422, _book(db, s, 13))
    await raises_http(422, _book(db, s, 9, telefon="123"))


async def test_phone_limit():
    db, _, _, s = await _fixture(capacity=5)
    for h in (8, 9, 10):
        await _book(db, s, h)
    await raises_http(429, _book(db, s, 11))


async def test_links_existing_client_only_when_unique():
    db, acc, _, s = await _fixture(capacity=3)
    c = await make_client(db, acc, "Popescu")
    c.telefon = "0740.123.456, 0256 111 222"
    await db.commit()
    assert (await _book(db, s, 8)).client_id == c.id
    twin = await make_client(db, acc, "Alt Popescu")
    twin.telefon = "+40 740 123 456"
    await db.commit()
    assert (await _book(db, s, 9)).client_id is None


async def test_mcp_bookings_do_not_store_ip():
    db, _, _, s = await _fixture()
    p = await bs.create_booking(db, s, _input(8), ProgramareSource.MCP, "9.9.9.9", now=NOW)
    assert (p.source, p.client_ip) == ("mcp", None)


# ─── Cautare si anulare ──────────────────────────────────────────────────────

async def test_lookup_and_cancel():
    db, _, _, s = await _fixture()
    p = await _book(db, s, 11)
    found = await bs.find_by_phone(db, s, "+40 740 123 456", now=NOW)
    assert [x.id for x in found] == [p.id]
    await raises_http(404, bs.get_booking(db, s, p.public_ref, "0799 999 999"))
    got = await bs.get_booking(db, s, p.public_ref.lower(), "0740123456")
    assert got.id == p.id
    # Cu 30 de minute inainte e prea tarziu (limita e 120).
    await raises_http(409, bs.cancel_booking(db, s, p.public_ref, "0740123456", now=at(TUESDAY, 10, 30)))
    done = await bs.cancel_booking(db, s, p.public_ref, "0740123456", now=NOW)
    assert done.status == ProgramareStatus.ANULAT
    # Slotul se elibereaza.
    assert at(TUESDAY, 11) in [x.start for x in await bs.list_slots(db, s, TUESDAY, TUESDAY, now=NOW)]


def test_public_read_has_no_personal_data():
    assert set(BookingRead.model_fields) == {"ref", "start", "end", "service", "status"}


# ─── Configurare si chei API ─────────────────────────────────────────────────

def _request(ip: str = "10.0.0.5") -> Request:
    return Request({"type": "http", "headers": [], "client": (ip, 1234)})


async def test_default_site_name_and_hours():
    db = await make_session()
    acc = await make_account(db)
    loc = Location(account_id=acc.id, name="Centru")
    db.add(loc)
    await db.commit()
    got = await get_settings(loc.id, db=db, account_id=acc.id)
    assert DEFAULT_SITE_NAME == "Vulcanizare Alex"
    assert got.site_name == "Vulcanizare Alex" and got.enabled is False
    assert {h.weekday for h in got.hours} == {0, 1, 2, 3, 4, 5}


async def test_api_key_auth():
    public_throttle.reset_all()
    db, acc, loc, s = await _fixture()
    created = await create_key(ApiKeyCreate(location_id=loc.id, name="Site"), db=db, account_id=acc.id)
    assert created.key.startswith("bsk_") and created.prefix == created.key[:12]

    ctx = await get_public_context(_request(), x_api_key=created.key, x_client_ip="5.6.7.8", db=db)
    assert (ctx.settings.id, ctx.client_ip) == (s.id, "5.6.7.8")
    # IP invalid in header → IP-ul conexiunii.
    ctx = await get_public_context(_request(), x_api_key=created.key, x_client_ip="nu-e-ip", db=db)
    assert ctx.client_ip == "10.0.0.5"

    await raises_http(401, get_public_context(_request(), x_api_key=None, x_client_ip=None, db=db))
    await raises_http(401, get_public_context(_request(), x_api_key="bsk_gresit", x_client_ip=None, db=db))

    s.enabled = False
    await db.commit()
    await raises_http(403, get_public_context(_request(), x_api_key=created.key, x_client_ip=None, db=db))
    s.enabled = True
    await db.commit()

    await revoke_key(created.id, db=db, account_id=acc.id)
    await raises_http(401, get_public_context(_request(), x_api_key=created.key, x_client_ip=None, db=db))

    other = await make_account(db, username="alta", code="alta")
    await raises_http(404, create_key(ApiKeyCreate(location_id=loc.id, name="x"), db=db, account_id=other.id))


def test_slugify():
    from app.utils.slug import is_valid_slug, slugify
    assert slugify("Vulcanizare Alex – Timișoara!") == "vulcanizare-alex-timisoara"
    assert slugify("  Service   Auto  ") == "service-auto"
    assert is_valid_slug("vulcanizare-alex") and not is_valid_slug("Vulcanizare") and not is_valid_slug("ab")
    assert not is_valid_slug("a--b") and not is_valid_slug("-abc")


async def test_public_slug_generated_unique_and_editable():
    from app.routers.booking_settings import put_settings
    from app.schemas.booking import BookingSettingsWrite
    db = await make_session()
    acc = await make_account(db)
    other = await make_account(db, username="alta", code="alta")
    loc1, loc2 = Location(account_id=acc.id, name="A"), Location(account_id=other.id, name="B")
    db.add_all([loc1, loc2])
    await db.commit()
    a = await get_settings(loc1.id, db=db, account_id=acc.id)
    b = await get_settings(loc2.id, db=db, account_id=other.id)
    assert (a.public_slug, b.public_slug) == ("vulcanizare-alex", "vulcanizare-alex-2")
    body = BookingSettingsWrite(site_name="Service Nord", public_slug="service-nord")
    got = await put_settings(loc2.id, body, db=db, account_id=other.id)
    assert got.public_slug == "service-nord"
    await raises_http(409, put_settings(loc1.id, BookingSettingsWrite(public_slug="service-nord"), db=db, account_id=acc.id))
    await raises_http(422, put_settings(loc1.id, BookingSettingsWrite(public_slug="Nume Invalid"), db=db, account_id=acc.id))
    # Fara public_slug in cerere, identificatorul ramane cel vechi.
    got = await put_settings(loc1.id, BookingSettingsWrite(site_name="Alt nume"), db=db, account_id=acc.id)
    assert got.public_slug == "vulcanizare-alex"


def test_throttle():
    public_throttle.reset_all()
    for _ in range(3):
        public_throttle.hit("t", 3, 60)
    try:
        public_throttle.hit("t", 3, 60)
    except Exception as exc:  # noqa: BLE001
        assert getattr(exc, "status_code", None) == 429
    else:
        raise AssertionError("astept 429")
    public_throttle.reset_all()


TESTS = [v for k, v in sorted(globals().items()) if k.startswith("test_")]

if __name__ == "__main__":
    for t in TESTS:
        result = t()
        if hasattr(result, "__await__"):
            run(result)
    print(f"OK — {len(TESTS)} scenarii programari online trecute.")
