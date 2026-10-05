"""Izolare intre conturi la locatii: `disclaimer_id`, `register_id`, `company_id`.

Regresia pe care o prinde: POST /api/locations si PATCH /api/locations/{id} salvau
orice id primit in body. O firma straina legata de locatie ajungea furnizor in
e-Factura (nume, CUI, IBAN), iar un registru strain isi incrementa numerele.

Rulabil cu pytest sau direct:  python -m tests.test_izolare_locations  (din backend/)
"""
from __future__ import annotations

from sqlalchemy import func, select

from app.models.company import Company
from app.models.disclaimer import Disclaimer
from app.models.location import Location
from app.models.register import Register
from app.routers.locations import create_location, update_location
from app.schemas.location import LocationCreate
from tests._harness import make_account, make_session, raises_http, run

FIELDS = ("disclaimer_id", "register_id", "company_id")


async def _links(db, account) -> dict[str, int]:
    """Un disclaimer, un registru si o firma ale contului dat."""
    disclaimer = Disclaimer(account_id=account.id, title="Termeni", text="Text")
    register = Register(account_id=account.id, name="Registru")
    company = Company(account_id=account.id, cui=12345678, name="Firma SRL")
    db.add_all([disclaimer, register, company])
    await db.flush()
    return {"disclaimer_id": disclaimer.id, "register_id": register.id, "company_id": company.id}


async def _fixture():
    db = await make_session()
    acc = await make_account(db)
    other = await make_account(db, username="alta", code="alta")
    own = await _links(db, acc)
    foreign = await _links(db, other)
    await db.commit()
    return db, acc, other, own, foreign


def _body(**kw) -> LocationCreate:
    return LocationCreate(**{"name": "Service", **kw})


async def _count(db, account) -> int:
    return await db.scalar(
        select(func.count()).select_from(Location).where(Location.account_id == account.id)
    )


def _stored(loc) -> dict[str, int | None]:
    return {f: getattr(loc, f) for f in FIELDS}


async def _soft_delete_links(db, ids: dict[str, int]) -> None:
    for model, field in ((Disclaimer, "disclaimer_id"), (Register, "register_id"), (Company, "company_id")):
        row = await db.get(model, ids[field])
        row.is_deleted = True
    await db.commit()


async def test_create_with_own_ids_works():
    db, acc, _, own, _ = await _fixture()
    loc = await create_location(_body(**own), db=db, account_id=acc.id)
    assert _stored(loc) == own


async def test_create_without_ids_works():
    db, acc, *_ = await _fixture()
    loc = await create_location(_body(), db=db, account_id=acc.id)
    assert _stored(loc) == dict.fromkeys(FIELDS)


async def test_create_rejects_foreign_ids_and_stores_nothing():
    db, acc, _, own, foreign = await _fixture()
    for field in FIELDS:
        await raises_http(400, create_location(_body(**{**own, field: foreign[field]}), db=db, account_id=acc.id))
    assert await _count(db, acc) == 0


async def test_create_same_answer_for_foreign_missing_and_deleted():
    db, acc, _, own, foreign = await _fixture()
    await _soft_delete_links(db, own)
    for field in FIELDS:
        details = {
            await raises_http(400, create_location(_body(**{field: value}), db=db, account_id=acc.id))
            for value in (foreign[field], 99999, own[field])
        }
        assert len(details) == 1, details
    assert await _count(db, acc) == 0


async def test_patch_with_own_ids_works_and_can_clear():
    db, acc, _, own, _ = await _fixture()
    loc = await create_location(_body(), db=db, account_id=acc.id)
    loc = await update_location(loc.id, _body(name="Nou", **own), db=db, account_id=acc.id)
    assert (loc.name, _stored(loc)) == ("Nou", own)
    loc = await update_location(loc.id, _body(), db=db, account_id=acc.id)
    assert _stored(loc) == dict.fromkeys(FIELDS)


async def test_patch_rejects_foreign_ids_and_keeps_previous():
    db, acc, _, own, foreign = await _fixture()
    loc = await create_location(_body(**own), db=db, account_id=acc.id)
    for field in FIELDS:
        body = _body(name="Schimbat", **{**own, field: foreign[field]})
        await raises_http(400, update_location(loc.id, body, db=db, account_id=acc.id))
        await raises_http(400, update_location(loc.id, _body(**{**own, field: 99999}), db=db, account_id=acc.id))
    await db.refresh(loc)
    assert (loc.name, _stored(loc)) == ("Service", own)


async def test_patch_rejects_foreign_id_on_empty_field():
    db, acc, _, _, foreign = await _fixture()
    loc = await create_location(_body(), db=db, account_id=acc.id)
    for field in FIELDS:
        await raises_http(400, update_location(loc.id, _body(**{field: foreign[field]}), db=db, account_id=acc.id))
    await db.refresh(loc)
    assert _stored(loc) == dict.fromkeys(FIELDS)


async def test_patch_unchanged_legacy_deleted_ids_still_save():
    db, acc, _, own, _ = await _fixture()
    loc = await create_location(_body(**own), db=db, account_id=acc.id)
    await _soft_delete_links(db, own)
    loc = await update_location(loc.id, _body(name="Redenumit", **own), db=db, account_id=acc.id)
    assert (loc.name, _stored(loc)) == ("Redenumit", own)


async def test_patch_cannot_switch_to_a_deleted_own_row():
    db, acc, _, own, _ = await _fixture()
    loc = await create_location(_body(), db=db, account_id=acc.id)
    await _soft_delete_links(db, own)
    for field in FIELDS:
        await raises_http(400, update_location(loc.id, _body(**{field: own[field]}), db=db, account_id=acc.id))


async def test_patch_foreign_location_is_404():
    db, acc, other, own, _ = await _fixture()
    loc = await create_location(_body(), db=db, account_id=other.id)
    await raises_http(404, update_location(loc.id, _body(**own), db=db, account_id=acc.id))
    await db.refresh(loc)
    assert _stored(loc) == dict.fromkeys(FIELDS)


TESTS = [v for k, v in sorted(globals().items()) if k.startswith("test_")]

if __name__ == "__main__":
    for t in TESTS:
        run(t())
    print(f"OK — {len(TESTS)} scenarii izolare locatii trecute.")
