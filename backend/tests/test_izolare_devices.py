"""Izolare intre conturi la statii (devices): location_id din body trebuie sa fie
o locatie activa a contului apelantului.

Rulabil cu pytest sau direct:  python -m tests.test_izolare_devices  (din backend/)
"""
from __future__ import annotations
from sqlalchemy import func, select

from app.models.account import Account
from app.models.device import Device
from app.models.location import Location
from app.routers.devices import create_device, get_device, update_device
from app.schemas.device import DeviceCreate
from tests._harness import make_account, make_session, raises_http, run


async def _location(db, account: Account, name: str) -> Location:
    loc = Location(account_id=account.id, name=name)
    db.add(loc)
    await db.flush()
    return loc


async def _fixture():
    db = await make_session()
    acc = await make_account(db)
    other = await make_account(db, username="alta", code="alta")
    loc = await _location(db, acc, "Sediu")
    loc2 = await _location(db, acc, "Punct de lucru")
    foreign = await _location(db, other, "Locatie straina")
    await db.commit()
    return db, acc, other, loc, loc2, foreign


async def _device_count(db, account: Account) -> int:
    return (await db.execute(
        select(func.count()).select_from(Device).where(Device.account_id == account.id)
    )).scalar_one()


async def test_create_with_own_location_works():
    db, acc, _, loc, *_ = await _fixture()
    d = await create_device(DeviceCreate(name="Casa 1", location_id=loc.id), db=db, account_id=acc.id)
    assert (d.account_id, d.location_id) == (acc.id, loc.id)


async def test_create_without_location_is_allowed():
    db, acc, *_ = await _fixture()
    d = await create_device(DeviceCreate(name="Casa 1"), db=db, account_id=acc.id)
    assert d.location_id is None


async def test_create_rejects_foreign_missing_or_deleted_location_and_stores_nothing():
    db, acc, _, loc, _, foreign = await _fixture()
    strain = await raises_http(
        400, create_device(DeviceCreate(name="Casa 1", location_id=foreign.id), db=db, account_id=acc.id)
    )
    lipsa = await raises_http(
        400, create_device(DeviceCreate(name="Casa 1", location_id=99999), db=db, account_id=acc.id)
    )
    # Acelasi raspuns: nu se poate afla daca id-ul exista in alt cont.
    assert strain == lipsa
    loc.is_deleted = True
    await db.commit()
    await raises_http(
        400, create_device(DeviceCreate(name="Casa 1", location_id=loc.id), db=db, account_id=acc.id)
    )
    assert await _device_count(db, acc) == 0


async def test_patch_changes_and_clears_own_location():
    db, acc, _, loc, loc2, _ = await _fixture()
    d = await create_device(DeviceCreate(name="Casa 1", location_id=loc.id), db=db, account_id=acc.id)
    d = await update_device(d.id, DeviceCreate(name="Casa 2", location_id=loc2.id), db=db, account_id=acc.id)
    assert (d.name, d.location_id) == ("Casa 2", loc2.id)
    d = await update_device(d.id, DeviceCreate(name="Casa 2"), db=db, account_id=acc.id)
    assert d.location_id is None


async def test_patch_rejects_foreign_or_missing_location_and_keeps_previous():
    db, acc, _, loc, _, foreign = await _fixture()
    d = await create_device(DeviceCreate(name="Casa 1", location_id=loc.id), db=db, account_id=acc.id)
    strain = await raises_http(
        400, update_device(d.id, DeviceCreate(name="Alt nume", location_id=foreign.id), db=db, account_id=acc.id)
    )
    lipsa = await raises_http(
        400, update_device(d.id, DeviceCreate(name="Alt nume", location_id=99999), db=db, account_id=acc.id)
    )
    assert strain == lipsa
    got = await get_device(d.id, db=db, account_id=acc.id)
    await db.refresh(got)
    assert (got.name, got.location_id) == ("Casa 1", loc.id)


async def test_patch_keeps_unchanged_legacy_location():
    """Statia legata de o locatie stearsa intre timp se poate redenumi, dar nu
    se poate muta pe alta locatie stearsa."""
    db, acc, _, loc, loc2, _ = await _fixture()
    d = await create_device(DeviceCreate(name="Casa 1", location_id=loc.id), db=db, account_id=acc.id)
    loc.is_deleted = True
    loc2.is_deleted = True
    await db.commit()
    d = await update_device(d.id, DeviceCreate(name="Casa veche", location_id=loc.id), db=db, account_id=acc.id)
    assert (d.name, d.location_id) == ("Casa veche", loc.id)
    await raises_http(
        400, update_device(d.id, DeviceCreate(name="Casa veche", location_id=loc2.id), db=db, account_id=acc.id)
    )


async def test_patch_keeps_unchanged_legacy_foreign_location():
    """Un rand vechi care arata deja spre alt cont ramane editabil (acelasi id),
    dar legatura straina nu poate fi pusa din nou dupa ce a fost schimbata."""
    db, acc, _, loc, _, foreign = await _fixture()
    legacy = Device(name="Casa 1", account_id=acc.id, location_id=foreign.id)
    db.add(legacy)
    await db.commit()
    d = await update_device(
        legacy.id, DeviceCreate(name="Redenumita", location_id=foreign.id), db=db, account_id=acc.id
    )
    assert (d.name, d.location_id) == ("Redenumita", foreign.id)
    d = await update_device(d.id, DeviceCreate(name="Redenumita", location_id=loc.id), db=db, account_id=acc.id)
    assert d.location_id == loc.id
    await raises_http(
        400, update_device(d.id, DeviceCreate(name="Redenumita", location_id=foreign.id), db=db, account_id=acc.id)
    )


async def test_patch_foreign_device_is_404():
    db, acc, other, loc, *_ = await _fixture()
    d = await create_device(DeviceCreate(name="Casa 1", location_id=loc.id), db=db, account_id=acc.id)
    await raises_http(
        404, update_device(d.id, DeviceCreate(name="Furat"), db=db, account_id=other.id)
    )


TESTS = [v for k, v in sorted(globals().items()) if k.startswith("test_")]

if __name__ == "__main__":
    for t in TESTS:
        run(t())
    print(f"OK — {len(TESTS)} scenarii izolare statii trecute.")
