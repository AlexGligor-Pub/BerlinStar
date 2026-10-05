"""Izolare intre conturi pe bonuri: id-urile din payload trebuie sa fie ale contului.

Fara verificare, un bon putea fi legat de clientul, angajatul, articolul,
programarea sau locatia altui cont, iar raspunsul le afisa datele (nume, telefon,
target) prin relatii nefiltrate. Id-urile sunt secventiale, deci se puteau enumera.

Rulabil cu pytest sau direct:  python -m tests.test_izolare_receipts  (din backend/)
"""
from __future__ import annotations
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from types import SimpleNamespace

from sqlalchemy import func, select

from app.models.account import Account
from app.models.client import Client
from app.models.client_vehicol import ClientVehicol
from app.models.employee import Employee
from app.models.item import Item, ItemType
from app.models.location import Location
from app.models.programare import Programare
from app.models.receipt import PayMethod, Receipt, ReceiptItem
from app.models.user import UserRole
from app.routers.receipts import (
    _refresh_accumulations, create_receipt, get_receipt, patch_receipt_client, patch_receipt_content,
)
from app.schemas.receipt import ReceiptClientPatch, ReceiptContentPatch, ReceiptCreate, ReceiptItemCreate
from tests._harness import (
    FakeCtx, make_account, make_client, make_employee, make_item, make_receipt, make_session,
    raises_http, run, set_receipt_vehicol,
)

ADMIN = FakeCtx(UserRole.ADMIN)
T0 = datetime(2026, 9, 7, 9, 0, tzinfo=timezone.utc)
ACUMULAT_STRAIN = Decimal("500.00")


async def _owned_rows(db, account, prefix: str) -> dict:
    """Cate un rand din fiecare tabel la care se poate lega un bon."""
    client = await make_client(db, account, f"Client {prefix}")
    emp = await make_employee(db, account, f"Angajat {prefix}")
    item = await make_item(db, account, f"Articol {prefix}", "100.00")
    loc = Location(account_id=account.id, name=f"Locatie {prefix}")
    db.add(loc)
    await db.flush()
    prog = Programare(
        account_id=account.id, titlu="Revizie", location_id=loc.id,
        start_time=T0, end_time=T0 + timedelta(hours=1),
    )
    db.add(prog)
    await db.flush()
    return dict(client=client.id, emp=emp.id, item=item.id, loc=loc.id, prog=prog.id)


async def _fixture():
    """Doua conturi, fiecare cu randurile lui. Intoarce doar id-uri: handlerele
    de editare apeleaza `expire_all`, iar un obiect expirat nu se mai poate citi
    in afara unui query."""
    db = await make_session()
    acc = await make_account(db)
    other = await make_account(db, username="alta", code="alta")
    own = await _owned_rows(db, acc, "propriu")
    foreign = await _owned_rows(db, other, "strain")
    strain = await db.get(Employee, foreign["emp"])
    strain.current_target_accumulation = ACUMULAT_STRAIN
    await db.commit()
    return db, SimpleNamespace(acc=acc.id, other=other.id, **own), SimpleNamespace(**foreign)


def _line(**kw) -> ReceiptItemCreate:
    base = dict(name="Manopera", price=Decimal("100.00"), qty=1, unit="buc")
    return ReceiptItemCreate(**{**base, **kw})


def _create(*lines: ReceiptItemCreate, **kw) -> ReceiptCreate:
    return ReceiptCreate(titlu="Bon", items=list(lines) or [_line()], total=Decimal("100.00"), **kw)


def _content(*lines: ReceiptItemCreate) -> ReceiptContentPatch:
    return ReceiptContentPatch(titlu="Bon editat", items=list(lines), total=Decimal("100.00"))


async def _receipt_count(db, account_id: int) -> int:
    return await db.scalar(
        select(func.count()).select_from(Receipt).where(Receipt.account_id == account_id)
    )


async def _line_names(db, receipt_id: int) -> list[str]:
    return list((await db.execute(
        select(ReceiptItem.name).where(ReceiptItem.receipt_id == receipt_id).order_by(ReceiptItem.id)
    )).scalars().all())


async def _foreign_accumulation(db, f) -> Decimal:
    return await db.scalar(
        select(Employee.current_target_accumulation).where(Employee.id == f.emp)
    )


async def _make_receipt_with_line(db, o, **line_kw) -> int:
    receipt = await make_receipt(db, await _account(db, o.acc))
    db.add(ReceiptItem(
        receipt_id=receipt.id, account_id=o.acc, name="Linie veche",
        price=Decimal("100.00"), qty=1, unit="buc", **line_kw,
    ))
    await db.commit()
    return receipt.id


async def _account(db, account_id: int) -> Account:
    return await db.get(Account, account_id)


# ─── POST /api/receipts ───────────────────────────────────────────────────────

async def test_create_rejects_foreign_or_missing_parent_ids():
    db, o, f = await _fixture()
    for field in ("client", "prog", "loc"):
        key = {"client": "client_id", "prog": "programare_id", "loc": "location_id"}[field]
        strain = await raises_http(400, create_receipt(
            _create(**{key: getattr(f, field)}), db=db, account_id=o.acc, ctx=ADMIN,
        ))
        lipsa = await raises_http(400, create_receipt(
            _create(**{key: 99999}), db=db, account_id=o.acc, ctx=ADMIN,
        ))
        # Acelasi raspuns: nu se poate afla daca id-ul exista in alt cont.
        assert strain == lipsa, (strain, lipsa)
    assert await _receipt_count(db, o.acc) == 0


async def test_create_rejects_deleted_own_client():
    db, o, _ = await _fixture()
    client = await db.get(Client, o.client)
    client.is_deleted = True
    await db.commit()
    await raises_http(400, create_receipt(_create(client_id=o.client), db=db, account_id=o.acc, ctx=ADMIN))
    assert await _receipt_count(db, o.acc) == 0


async def test_create_accepts_deleted_own_location_and_programare():
    """Un POS ramas inregistrat pe o locatie stearsa trebuie sa poata emite bonuri."""
    db, o, f = await _fixture()
    for model, ids in ((Location, (o.loc, f.loc)), (Programare, (o.prog, f.prog))):
        for row_id in ids:
            row = await db.get(model, row_id)
            row.is_deleted = True
    await db.commit()
    r = await create_receipt(
        _create(location_id=o.loc, programare_id=o.prog), db=db, account_id=o.acc, ctx=ADMIN,
    )
    assert (r["location_id"], r["programare_id"]) == (o.loc, o.prog)
    # Exceptia priveste doar randurile sterse ale contului, nu pe ale altuia.
    await raises_http(400, create_receipt(_create(location_id=f.loc), db=db, account_id=o.acc, ctx=ADMIN))
    await raises_http(400, create_receipt(_create(programare_id=f.prog), db=db, account_id=o.acc, ctx=ADMIN))
    assert await _receipt_count(db, o.acc) == 1


async def test_create_rejects_foreign_employee_and_leaves_its_accumulation_alone():
    db, o, f = await _fixture()
    await raises_http(400, create_receipt(
        _create(_line(employee_id=o.emp), _line(employee_id=f.emp), pay_method=PayMethod.CASH),
        db=db, account_id=o.acc, ctx=ADMIN,
    ))
    await raises_http(400, create_receipt(
        _create(_line(employee_id=99999)), db=db, account_id=o.acc, ctx=ADMIN,
    ))
    assert await _receipt_count(db, o.acc) == 0
    assert await _foreign_accumulation(db, f) == ACUMULAT_STRAIN


async def test_create_rejects_foreign_item_with_or_without_type():
    db, o, f = await _fixture()
    await raises_http(400, create_receipt(
        _create(_line(item_id=f.item, item_type=ItemType.PRODUS)), db=db, account_id=o.acc, ctx=ADMIN,
    ))
    await raises_http(400, create_receipt(
        _create(_line(item_id=f.item)), db=db, account_id=o.acc, ctx=ADMIN,
    ))
    assert await _receipt_count(db, o.acc) == 0


async def test_create_with_own_ids_works_and_serializes_them():
    db, o, _ = await _fixture()
    r = await create_receipt(
        _create(
            _line(employee_id=o.emp, item_id=o.item, item_type=ItemType.PRODUS),
            client_id=o.client, programare_id=o.prog, location_id=o.loc,
        ),
        db=db, account_id=o.acc, ctx=ADMIN,
    )
    assert (r["client_id"], r["programare_id"], r["location_id"]) == (o.client, o.prog, o.loc)
    assert r["client_nume"] == "Client propriu"
    line = r["receipt_items"][0]
    assert (line["employee_id"], line["employee_name"], line["item_id"]) == (o.emp, "Angajat propriu", o.item)


async def test_create_without_any_link_still_works():
    db, o, _ = await _fixture()
    r = await create_receipt(_create(), db=db, account_id=o.acc, ctx=ADMIN)
    assert r["client_id"] is None and r["receipt_items"][0]["employee_id"] is None


# ─── PATCH /api/receipts/{id}/content ─────────────────────────────────────────

async def test_content_rejects_new_foreign_employee_or_item_and_keeps_lines():
    db, o, f = await _fixture()
    rid = await _make_receipt_with_line(db, o, employee_id=o.emp)
    for bad in (
        _line(name="Noua", employee_id=f.emp),
        _line(name="Noua", employee_id=99999),
        _line(name="Noua", item_id=f.item, item_type=ItemType.PRODUS),
        _line(name="Noua", item_id=99999),
    ):
        await raises_http(400, patch_receipt_content(
            rid, _content(_line(name="Linie veche", employee_id=o.emp), bad),
            db=db, account_id=o.acc, actor="test", ctx=ADMIN,
        ))
    assert await _line_names(db, rid) == ["Linie veche"]
    assert await db.scalar(select(Receipt.titlu).where(Receipt.id == rid)) == "Bon test"
    assert await _foreign_accumulation(db, f) == ACUMULAT_STRAIN


async def test_content_with_own_ids_works():
    db, o, _ = await _fixture()
    rid = await _make_receipt_with_line(db, o)
    r = await patch_receipt_content(
        rid, _content(_line(name="Noua", employee_id=o.emp, item_id=o.item, item_type=ItemType.PRODUS)),
        db=db, account_id=o.acc, actor="test", ctx=ADMIN,
    )
    line = r["receipt_items"][0]
    assert (line["name"], line["employee_id"], line["employee_name"], line["item_id"]) == (
        "Noua", o.emp, "Angajat propriu", o.item,
    )


async def test_content_keeps_saving_lines_linked_to_since_deleted_rows():
    """Bon vechi: angajatul si articolul de pe linie au fost sterse intre timp."""
    db, o, f = await _fixture()
    rid = await _make_receipt_with_line(db, o, employee_id=o.emp, item_id=o.item, item_type=ItemType.PRODUS)
    emp = await db.get(Employee, o.emp)
    emp.is_deleted = True
    item = await db.get(Item, o.item)
    item.is_deleted = True
    await db.commit()

    vechi = _line(name="Linie veche", employee_id=o.emp, item_id=o.item, item_type=ItemType.PRODUS)
    r = await patch_receipt_content(
        rid, _content(vechi, _line(name="Fara legaturi")),
        db=db, account_id=o.acc, actor="test", ctx=ADMIN,
    )
    assert [(ln["name"], ln["employee_id"], ln["item_id"]) for ln in r["receipt_items"]] == [
        ("Linie veche", o.emp, o.item), ("Fara legaturi", None, None),
    ]
    # Exceptia e doar pentru id-urile deja aflate pe bon, nu pentru unele noi.
    await raises_http(400, patch_receipt_content(
        rid, _content(vechi, _line(name="Noua", employee_id=f.emp)),
        db=db, account_id=o.acc, actor="test", ctx=ADMIN,
    ))


# ─── PATCH /api/receipts/{id}/client ──────────────────────────────────────────

async def test_client_patch_rejects_foreign_or_missing_client_and_stores_nothing():
    db, o, f = await _fixture()
    receipt = await make_receipt(db, await _account(db, o.acc), client_id=o.client)
    await set_receipt_vehicol(db, receipt, "B123ABC")
    await db.commit()
    rid = receipt.id

    strain = await raises_http(400, patch_receipt_client(
        rid, ReceiptClientPatch(client_id=f.client), db=db, account_id=o.acc,
    ))
    lipsa = await raises_http(400, patch_receipt_client(
        rid, ReceiptClientPatch(client_id=99999), db=db, account_id=o.acc,
    ))
    assert strain == lipsa, (strain, lipsa)
    assert await db.scalar(select(Receipt.client_id).where(Receipt.id == rid)) == o.client
    # Masina de pe bon nu a ajuns in garajul clientului din celalalt cont.
    assert await db.scalar(
        select(func.count()).select_from(ClientVehicol).where(ClientVehicol.client_id == f.client)
    ) == 0


async def test_client_patch_with_own_client_works_and_can_be_cleared():
    db, o, _ = await _fixture()
    receipt = await make_receipt(db, await _account(db, o.acc))
    await db.commit()
    rid = receipt.id
    r = await patch_receipt_client(rid, ReceiptClientPatch(client_id=o.client), db=db, account_id=o.acc)
    assert (r["client_id"], r["client_nume"]) == (o.client, "Client propriu")
    r = await patch_receipt_client(rid, ReceiptClientPatch(client_id=None), db=db, account_id=o.acc)
    assert r["client_id"] is None and r["client_nume"] is None


async def test_client_patch_keeps_an_unchanged_since_deleted_client():
    db, o, _ = await _fixture()
    receipt = await make_receipt(db, await _account(db, o.acc), client_id=o.client)
    client = await db.get(Client, o.client)
    client.is_deleted = True
    await db.commit()
    rid = receipt.id
    r = await patch_receipt_client(rid, ReceiptClientPatch(client_id=o.client), db=db, account_id=o.acc)
    assert r["client_id"] == o.client


# ─── Legaturi straine salvate inainte de reparatie ────────────────────────────

async def test_refresh_accumulations_never_writes_into_another_account():
    db, o, f = await _fixture()
    receipt = await make_receipt(db, await _account(db, o.acc), pay_method=PayMethod.CASH)
    for emp_id in (o.emp, f.emp):
        db.add(ReceiptItem(
            receipt_id=receipt.id, account_id=o.acc, name="Manopera",
            price=Decimal("100.00"), qty=1, unit="buc", employee_id=emp_id,
        ))
    await db.commit()

    await _refresh_accumulations(db, o.acc, {o.emp, f.emp})
    await db.commit()

    assert await _foreign_accumulation(db, f) == ACUMULAT_STRAIN
    assert await db.scalar(
        select(Employee.current_target_accumulation).where(Employee.id == o.emp)
    ) == Decimal("100.00")


async def test_already_stored_foreign_links_are_not_echoed():
    db, o, f = await _fixture()
    receipt = await make_receipt(db, await _account(db, o.acc), client_id=f.client)
    db.add(ReceiptItem(
        receipt_id=receipt.id, account_id=o.acc, name="Manopera",
        price=Decimal("100.00"), qty=1, unit="buc", employee_id=f.emp,
    ))
    await db.commit()

    r = await get_receipt(receipt.id, db=db, account_id=o.acc)
    assert r["client_id"] == f.client
    for key in ("client_nume", "client_cui", "client_adresa", "client_telefon",
                "client_tip", "client_reprezentant", "client_numar_masina"):
        assert r[key] is None, (key, r[key])
    line = r["receipt_items"][0]
    assert line["employee_name"] is None and line["employee_target_pct"] is None


TESTS = [v for k, v in sorted(globals().items()) if k.startswith("test_")]

if __name__ == "__main__":
    for t in TESTS:
        run(t())
    print(f"OK — {len(TESTS)} scenarii de izolare intre conturi pe bonuri trecute.")
