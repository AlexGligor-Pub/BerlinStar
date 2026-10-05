"""Izolare intre conturi la Hotel anvelope: id-urile din body (client, angajat,
loc de cazare, locatie, cazare de referinta, bon, anvelope) trebuie sa apartina
contului apelantului.

Rulabil cu pytest sau direct:  python -m tests.test_izolare_cazare_anvelope  (din backend/)
"""
from __future__ import annotations
from datetime import date
from types import SimpleNamespace

from sqlalchemy import func, select, update

from app.models.anvelopa import Anvelopa, TipAnvelopa
from app.models.cazare_anvelope import CazareAnvelopaItem, CazareAnvelope
from app.models.employee import Employee
from app.models.loc_cazare import LocCazare
from app.models.location import Location
from app.models.receipt import Receipt
from app.routers.cazare_anvelope import (
    checkout_cazare, create_cazare, get_cazare, update_cazare,
)
from app.schemas.cazare_anvelope import CazareCheckoutBody, CazareCreate, CazareUpdateBody
from tests._harness import (
    make_account, make_client, make_employee, make_receipt, make_session, raises_http, run,
)

D0 = date(2026, 3, 1)


async def _side(db, acc, tag: str) -> SimpleNamespace:
    """Tot ce poate fi referit dintr-o cazare, pentru un cont. Pastram doar
    id-urile: `update_cazare` face `expire_all`, iar un obiect expirat nu mai
    poate fi citit in afara unui query."""
    client = await make_client(db, acc, f"Client {tag}")
    emp = await make_employee(db, acc, f"Angajat {tag}")
    loc = LocCazare(account_id=acc.id, nume=f"Raft {tag}")
    location = Location(account_id=acc.id, name=f"Locatie {tag}")
    db.add_all([loc, location])
    await db.flush()
    receipt = await make_receipt(db, acc)
    tyres = [Anvelopa(account_id=acc.id, client_id=client.id, tip=TipAnvelopa.IARNA) for _ in range(3)]
    ref = CazareAnvelope(
        account_id=acc.id, client_id=client.id, data_checkin=date(2026, 1, 10), data_checkout=date(2026, 2, 10),
    )
    db.add_all([*tyres, ref])
    await db.flush()
    return SimpleNamespace(
        acc=acc.id, client=client.id, emp=emp.id, loc=loc.id, location=location.id,
        receipt=receipt.id, tyres=[t.id for t in tyres], ref=ref.id,
    )


async def _fixture():
    db = await make_session()
    a = await _side(db, await make_account(db), "A")
    b = await _side(db, await make_account(db, username="alta", code="alta"), "B")
    await db.commit()
    return db, a, b


def _body(**kw) -> CazareCreate:
    return CazareCreate(**{"data_checkin": D0, **kw})


def _full(s: SimpleNamespace, **kw) -> CazareCreate:
    return _body(**{
        "client_id": s.client, "employee_id": s.emp, "loc_cazare_id": s.loc, "location_id": s.location,
        "referinta_cazare_id": s.ref, "receipt_id": s.receipt, "anvelopa_ids": s.tyres[:2], **kw,
    })


def _patch(s: SimpleNamespace, **kw) -> CazareUpdateBody:
    """PATCH-ul inlocuieste angajatul, locul si referinta: trimitem mereu
    valorile curente, ca in UI."""
    return CazareUpdateBody(**{
        "employee_id": s.emp, "loc_cazare_id": s.loc, "referinta_cazare_id": s.ref,
        "receipt_id": s.receipt, "anvelopa_ids": s.tyres[:2], **kw,
    })


async def _count(db, model, account_id: int) -> int:
    return await db.scalar(
        select(func.count()).select_from(model).where(model.account_id == account_id)
    )


async def _soft_delete(db, model, *ids: int) -> None:
    await db.execute(
        update(model).where(model.id.in_(ids)).values(is_deleted=True)
        .execution_options(synchronize_session=False)
    )
    await db.commit()


def _tyre_ids(cazare: dict) -> list[int]:
    return sorted(i["anvelopa_id"] for i in cazare["items"])


# ─── Creare ──────────────────────────────────────────────────────────────────

async def test_create_with_own_ids_works():
    db, a, _ = await _fixture()
    c = await create_cazare(_full(a), db=db, account_id=a.acc)
    assert (c["client_id"], c["employee_id"], c["loc_cazare_id"], c["location_id"]) == (
        a.client, a.emp, a.loc, a.location,
    )
    assert (c["client_nume"], c["employee_name"], c["loc_cazare_nume"], c["location_name"]) == (
        "Client A", "Angajat A", "Raft A", "Locatie A",
    )
    assert (c["referinta_cazare_id"], c["receipt_id"]) == (a.ref, a.receipt)
    assert _tyre_ids(c) == sorted(a.tyres[:2])


async def test_create_rejects_foreign_ids_and_stores_nothing():
    db, a, b = await _fixture()
    foreign = {
        "client_id": b.client, "employee_id": b.emp, "loc_cazare_id": b.loc, "location_id": b.location,
        "referinta_cazare_id": b.ref, "receipt_id": b.receipt,
        "anvelopa_ids": [a.tyres[0], b.tyres[0]],
    }
    for field, value in foreign.items():
        detail = await raises_http(400, create_cazare(_full(a, **{field: value}), db=db, account_id=a.acc))
        # Acelasi raspuns pentru „al altui cont" si „nu exista": id-urile nu se pot enumera.
        missing = [99999] if field == "anvelopa_ids" else 99999
        assert detail == await raises_http(
            400, create_cazare(_full(a, **{field: missing}), db=db, account_id=a.acc)
        ), field
    # Doar cazarile de referinta din fixture; nimic nou in niciun cont.
    assert await _count(db, CazareAnvelope, a.acc) == 1
    assert await _count(db, CazareAnvelope, b.acc) == 1
    assert await _count(db, CazareAnvelopaItem, a.acc) == 0


async def test_create_rejects_soft_deleted_rows():
    db, a, _ = await _fixture()
    await _soft_delete(db, Employee, a.emp)
    await _soft_delete(db, Anvelopa, a.tyres[0])
    await raises_http(400, create_cazare(_body(employee_id=a.emp), db=db, account_id=a.acc))
    await raises_http(400, create_cazare(_body(anvelopa_ids=a.tyres[:2]), db=db, account_id=a.acc))
    assert await _count(db, CazareAnvelope, a.acc) == 1


# ─── Editare ─────────────────────────────────────────────────────────────────

async def test_update_with_own_ids_works():
    db, a, _ = await _fixture()
    c = await create_cazare(_body(client_id=a.client), db=db, account_id=a.acc)
    cid = c["id"]
    c = await update_cazare(cid, _patch(a), db=db, account_id=a.acc)
    assert (c["employee_id"], c["loc_cazare_id"], c["referinta_cazare_id"], c["receipt_id"]) == (
        a.emp, a.loc, a.ref, a.receipt,
    )
    assert (c["employee_name"], c["loc_cazare_nume"]) == ("Angajat A", "Raft A")
    assert _tyre_ids(c) == sorted(a.tyres[:2])
    # Golirea campurilor ramane permisa.
    c = await update_cazare(
        cid, CazareUpdateBody(employee_id=None, loc_cazare_id=None, referinta_cazare_id=None, anvelopa_ids=[]),
        db=db, account_id=a.acc,
    )
    assert (c["employee_id"], c["loc_cazare_id"], c["referinta_cazare_id"], c["items"]) == (None, None, None, [])
    assert c["receipt_id"] == a.receipt


async def test_update_rejects_foreign_ids_and_keeps_previous():
    db, a, b = await _fixture()
    cid = (await create_cazare(_full(a), db=db, account_id=a.acc))["id"]
    foreign = {
        "employee_id": b.emp, "loc_cazare_id": b.loc, "referinta_cazare_id": b.ref, "receipt_id": b.receipt,
        "anvelopa_ids": [*a.tyres[:2], b.tyres[0]],
    }
    for field, value in foreign.items():
        detail = await raises_http(
            400, update_cazare(cid, _patch(a, comments="x", **{field: value}), db=db, account_id=a.acc)
        )
        missing = [99999] if field == "anvelopa_ids" else 99999
        assert detail == await raises_http(
            400, update_cazare(cid, _patch(a, **{field: missing}), db=db, account_id=a.acc)
        ), field
    # O cazare nu poate fi propria referinta.
    await raises_http(400, update_cazare(cid, _patch(a, referinta_cazare_id=cid), db=db, account_id=a.acc))
    c = await get_cazare(cid, db=db, account_id=a.acc)
    assert (c["employee_id"], c["loc_cazare_id"], c["referinta_cazare_id"], c["receipt_id"]) == (
        a.emp, a.loc, a.ref, a.receipt,
    )
    assert c["comments"] is None
    assert _tyre_ids(c) == sorted(a.tyres[:2])
    assert await _count(db, CazareAnvelopaItem, a.acc) == 2


async def test_update_keeps_unchanged_legacy_ids():
    db, a, _ = await _fixture()
    cid = (await create_cazare(_full(a), db=db, account_id=a.acc))["id"]
    # Tot ce e legat de cazare a fost sters intre timp.
    await _soft_delete(db, Employee, a.emp)
    await _soft_delete(db, LocCazare, a.loc)
    await _soft_delete(db, CazareAnvelope, a.ref)
    await _soft_delete(db, Receipt, a.receipt)
    await _soft_delete(db, Anvelopa, *a.tyres)
    c = await update_cazare(cid, _patch(a, comments="corectat"), db=db, account_id=a.acc)
    assert c["comments"] == "corectat"
    assert (c["employee_id"], c["loc_cazare_id"], c["referinta_cazare_id"], c["receipt_id"]) == (
        a.emp, a.loc, a.ref, a.receipt,
    )
    assert _tyre_ids(c) == sorted(a.tyres[:2])
    # O anvelopa stearsa care NU era pe cazare nu poate fi adaugata acum.
    await raises_http(400, update_cazare(cid, _patch(a, anvelopa_ids=a.tyres), db=db, account_id=a.acc))
    c = await get_cazare(cid, db=db, account_id=a.acc)
    assert _tyre_ids(c) == sorted(a.tyres[:2])


# ─── Checkout ────────────────────────────────────────────────────────────────

async def test_checkout_with_own_receipt_works():
    db, a, _ = await _fixture()
    cid = (await create_cazare(_body(client_id=a.client), db=db, account_id=a.acc))["id"]
    c = await checkout_cazare(
        cid, CazareCheckoutBody(data_checkout=date(2026, 4, 1), receipt_id=a.receipt), db=db, account_id=a.acc,
    )
    assert (c["data_checkout"], c["receipt_id"]) == (date(2026, 4, 1), a.receipt)


async def test_checkout_rejects_foreign_receipt_and_stays_open():
    db, a, b = await _fixture()
    cid = (await create_cazare(_body(client_id=a.client, receipt_id=a.receipt), db=db, account_id=a.acc))["id"]
    detail = await raises_http(400, checkout_cazare(
        cid, CazareCheckoutBody(data_checkout=date(2026, 4, 1), receipt_id=b.receipt), db=db, account_id=a.acc,
    ))
    assert detail == await raises_http(400, checkout_cazare(
        cid, CazareCheckoutBody(data_checkout=date(2026, 4, 1), receipt_id=99999), db=db, account_id=a.acc,
    ))
    c = await get_cazare(cid, db=db, account_id=a.acc)
    assert (c["data_checkout"], c["receipt_id"]) == (None, a.receipt)


async def test_checkout_keeps_unchanged_legacy_receipt():
    db, a, _ = await _fixture()
    cid = (await create_cazare(_body(client_id=a.client, receipt_id=a.receipt), db=db, account_id=a.acc))["id"]
    await _soft_delete(db, Receipt, a.receipt)
    c = await checkout_cazare(
        cid, CazareCheckoutBody(data_checkout=date(2026, 4, 1), receipt_id=a.receipt), db=db, account_id=a.acc,
    )
    assert (c["data_checkout"], c["receipt_id"]) == (date(2026, 4, 1), a.receipt)


TESTS = [v for k, v in sorted(globals().items()) if k.startswith("test_")]

if __name__ == "__main__":
    for t in TESTS:
        run(t())
    print(f"OK — {len(TESTS)} scenarii de izolare la hotel anvelope trecute.")
