"""Izolare intre conturi la registre: `company_id`.

Regresia pe care o prinde: POST /api/registers si PATCH /api/registers/{id} salvau
orice `company_id` primit in body, deci un registru putea fi legat de firma altui
cont.

Rulabil cu pytest sau direct:  python -m tests.test_izolare_registers  (din backend/)
"""
from __future__ import annotations

from sqlalchemy import func, select

from app.models.company import Company
from app.models.register import Register
from app.routers.registers import create_register, get_register, patch_register
from app.schemas.register import RegisterCreate, RegisterUpdate
from tests._harness import make_account, make_session, raises_http, run


async def _company(db, account, name: str = "Firma SRL") -> Company:
    company = Company(account_id=account.id, cui=12345678, name=name)
    db.add(company)
    await db.flush()
    return company


async def _fixture():
    db = await make_session()
    acc = await make_account(db)
    other = await make_account(db, username="alta", code="alta")
    own = await _company(db, acc)
    own2 = await _company(db, acc, "A doua SRL")
    foreign = await _company(db, other, "Straina SRL")
    await db.commit()
    return db, acc, own, own2, foreign


async def _count(db, account) -> int:
    return await db.scalar(
        select(func.count()).select_from(Register).where(Register.account_id == account.id)
    )


async def test_create_accepts_own_company_and_none():
    db, acc, own, *_ = await _fixture()
    r = await create_register(RegisterCreate(name="Casa 1", company_id=own.id), db=db, account_id=acc.id)
    assert (r.company_id, r.account_id) == (own.id, acc.id)
    r = await create_register(RegisterCreate(name="Casa 2"), db=db, account_id=acc.id)
    assert r.company_id is None


async def test_create_rejects_foreign_missing_or_deleted_company_and_stores_nothing():
    db, acc, own, _, foreign = await _fixture()
    d1 = await raises_http(400, create_register(
        RegisterCreate(name="Casa", company_id=foreign.id), db=db, account_id=acc.id))
    d2 = await raises_http(400, create_register(
        RegisterCreate(name="Casa", company_id=99999), db=db, account_id=acc.id))
    own.is_deleted = True
    await db.commit()
    d3 = await raises_http(400, create_register(
        RegisterCreate(name="Casa", company_id=own.id), db=db, account_id=acc.id))
    # Acelasi raspuns, ca sa nu se poata enumera id-urile altor conturi.
    assert d1 == d2 == d3
    assert await _count(db, acc) == 0


async def test_patch_accepts_own_company_and_unlink():
    db, acc, own, own2, _ = await _fixture()
    r = await create_register(RegisterCreate(name="Casa", company_id=own.id), db=db, account_id=acc.id)
    r = await patch_register(r.id, RegisterUpdate(company_id=own2.id), db=db, account_id=acc.id)
    assert r.company_id == own2.id
    r = await patch_register(r.id, RegisterUpdate(name="Alt nume"), db=db, account_id=acc.id)
    assert (r.name, r.company_id) == ("Alt nume", own2.id)
    r = await patch_register(r.id, RegisterUpdate(company_id=None), db=db, account_id=acc.id)
    assert r.company_id is None


async def test_patch_rejects_foreign_or_missing_company_and_keeps_previous():
    db, acc, own, _, foreign = await _fixture()
    r = await create_register(RegisterCreate(name="Casa", company_id=own.id), db=db, account_id=acc.id)
    d1 = await raises_http(400, patch_register(
        r.id, RegisterUpdate(name="Schimbat", company_id=foreign.id), db=db, account_id=acc.id))
    d2 = await raises_http(400, patch_register(
        r.id, RegisterUpdate(company_id=99999), db=db, account_id=acc.id))
    assert d1 == d2
    # rollback() expira obiectele ORM: id-urile se citesc inainte, altfel accesul
    # la atribute ar porni o incarcare sincrona in afara greenlet-ului.
    rid, acc_id, own_id = r.id, acc.id, own.id
    await db.rollback()
    got = await get_register(rid, db=db, account_id=acc_id)
    assert (got.name, got.company_id) == ("Casa", own_id)


async def test_patch_unchanged_legacy_company_still_works():
    db, acc, own, own2, foreign = await _fixture()
    # Registru vechi legat de o firma intre timp stearsa.
    r = await create_register(RegisterCreate(name="Casa", company_id=own.id), db=db, account_id=acc.id)
    own.is_deleted = True
    await db.commit()
    r = await patch_register(
        r.id, RegisterUpdate(name="Redenumit", company_id=own.id), db=db, account_id=acc.id)
    assert (r.name, r.company_id) == ("Redenumit", own.id)

    # Rand vechi care pointeaza deja la firma altui cont: acelasi id retrimis nu
    # blocheaza editarea, dar nici nu poate fi schimbat cu alt id strain.
    legacy = Register(account_id=acc.id, name="Vechi", company_id=foreign.id)
    db.add(legacy)
    await db.commit()
    got = await patch_register(
        legacy.id, RegisterUpdate(factura_serie="BS", company_id=foreign.id), db=db, account_id=acc.id)
    assert (got.factura_serie, got.company_id) == ("BS", foreign.id)
    got = await patch_register(legacy.id, RegisterUpdate(company_id=own2.id), db=db, account_id=acc.id)
    assert got.company_id == own2.id
    await raises_http(400, patch_register(
        legacy.id, RegisterUpdate(company_id=foreign.id), db=db, account_id=acc.id))


TESTS = [v for k, v in sorted(globals().items()) if k.startswith("test_")]

if __name__ == "__main__":
    for t in TESTS:
        run(t())
    print(f"OK — {len(TESTS)} scenarii de izolare registre trecute.")
