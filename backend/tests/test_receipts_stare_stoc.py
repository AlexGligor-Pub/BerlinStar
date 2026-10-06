"""Bonuri: starea de plata, stocul si numerotarea raman coerente pe toate drumurile.

Regresiile pe care le prinde:
  - bonul creat direct platit (Factura Rapida) nu scadea stocul si nu scria nimic
    in registrul de plati, iar readucerea pe Neplatit / stergerea adaugau marfa;
  - statusul si continutul se puteau schimba pe un bon sters, miscand stocul;
  - „Platit Partial" accepta un avans mai mare decat totalul;
  - doua registre cu aceeasi serie (sau un contor coborat) blocau numerotarea cu
    un „Conflict de date." fara explicatie;
  - convert-to-deviz recalcula acumularile dupa commit si le pierdea;
  - factura respinsa de ANAF nu mai putea fi corectata.

Rulabil cu pytest sau direct:  python -m tests.test_receipts_stare_stoc  (din backend/)
"""
from __future__ import annotations
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from types import SimpleNamespace

from sqlalchemy import select, update

from app.models.account import Account
from app.models.company import Company
from app.models.employee import Employee
from app.models.item import Item, ItemType
from app.models.location import Location
from app.models.receipt import PayMethod, Receipt
from app.models.receipt_payment import PaymentKind, PaymentMethod, ReceiptPayment
from app.models.register import Register
from app.models.stock import Stock
from app.models.stock_movement import StockMovement, StockMovementType
from app.models.user import UserRole
# `app.efactura.models` se importa dupa `app.models` (vezi test_factura_scadenta).
from app.efactura.models import EFacturaRecord
from app.routers.receipts import (
    _refresh_accumulations, assign_number, convert_fdl_to_deviz, create_receipt,
    delete_receipt, patch_receipt, patch_receipt_content,
)
from app.schemas.receipt import (
    AssignNumberRequest, ReceiptContentPatch, ReceiptCreate, ReceiptItemCreate, ReceiptPatch,
)
from app.services.stock import (
    apply_sale_for_receipt, reconcile_sale_for_receipt, reverse_sale_for_receipt,
)
from tests._harness import (
    FakeCtx, add_line, make_account, make_employee, make_item, make_receipt, make_session,
    raises_http, run,
)

ADMIN = FakeCtx(UserRole.ADMIN)
SALE, REVERSE = StockMovementType.SALE, StockMovementType.SALE_REVERSE
STOC_INITIAL = 10


async def _fixture():
    """Un cont cu o locatie, un angajat si un produs „Ulei" (100 lei, 10 buc in stoc).

    Intoarce doar id-uri: handlerele de editare apeleaza `expire_all`, iar cel de
    numerotare face rollback la coliziune — un obiect expirat nu se mai poate citi.
    """
    db = await make_session()
    acc = await make_account(db)
    loc = Location(account_id=acc.id, name="Service")
    db.add(loc)
    item = await make_item(db, acc, "Ulei", "100.00")
    item.cost_price = Decimal("40.00")
    emp = await make_employee(db, acc, "Ion")
    db.add(Stock(account_id=acc.id, item_id=item.id, location_id=loc.id, qty=STOC_INITIAL))
    await db.commit()
    return db, SimpleNamespace(acc=acc.id, loc=loc.id, item=item.id, emp=emp.id)


def _line(qty: int = 3, **kw) -> ReceiptItemCreate:
    base = dict(name="Ulei", price=Decimal("100.00"), qty=qty, unit="buc")
    return ReceiptItemCreate(**{**base, **kw})


async def _create_paid(db, o, qty: int = 3, pay_method=PayMethod.CASH, **kw) -> int:
    """Bon creat direct platit, cu linia legata de catalog doar prin denumire —
    exact ce trimite Factura Rapida."""
    body = ReceiptCreate(
        titlu="Factura Rapida", items=[_line(qty)], total=Decimal(100 * qty),
        pay_method=pay_method, location_id=o.loc, source="rapida", **kw,
    )
    r = await create_receipt(body, db=db, account_id=o.acc, ctx=ADMIN, actor="casier")
    return r["id"]


async def _legacy_receipt(db, o, qty: int = 3, **kw) -> int:
    """Bon scris direct in baza, fara nicio miscare de stoc: asa arata bonurile
    ajunse platite inainte de corectie."""
    account = await db.get(Account, o.acc)
    receipt = await make_receipt(db, account, f"{100 * qty}.00", location_id=o.loc, **kw)
    line = await add_line(db, receipt, "Ulei", "100.00", qty=qty, item_id=o.item)
    line.account_id = o.acc
    line.item_type = ItemType.PRODUS
    line.employee_id = o.emp
    await db.commit()
    return receipt.id


def _content(qty: int, o) -> ReceiptContentPatch:
    return ReceiptContentPatch(
        titlu="Bon editat", total=Decimal(100 * qty),
        items=[_line(qty, item_id=o.item, item_type=ItemType.PRODUS)],
    )


async def _set_status(db, o, receipt_id: int, pay_method: PayMethod, partial=None):
    return await patch_receipt(
        receipt_id, ReceiptPatch(pay_method=pay_method, partial_pay=partial),
        db=db, account_id=o.acc, actor="casier",
    )


async def _edit(db, o, receipt_id: int, qty: int):
    return await patch_receipt_content(
        receipt_id, _content(qty, o), db=db, account_id=o.acc, actor="casier", ctx=ADMIN,
    )


async def _delete(db, o, receipt_id: int):
    return await delete_receipt(receipt_id, db=db, account_id=o.acc, actor="sef")


async def _qty(db, o) -> int:
    return (await db.execute(select(Stock.qty).where(Stock.item_id == o.item))).scalar_one()


async def _movs(db, receipt_id: int) -> list[tuple]:
    rows = (await db.execute(
        select(StockMovement.movement_type, StockMovement.qty_delta)
        .where(StockMovement.receipt_id == receipt_id)
        .order_by(StockMovement.id)
    )).all()
    return [(r.movement_type, r.qty_delta) for r in rows]


async def _payments(db, receipt_id: int) -> list[tuple]:
    rows = (await db.execute(
        select(ReceiptPayment.kind, ReceiptPayment.amount, ReceiptPayment.method)
        .where(ReceiptPayment.receipt_id == receipt_id, ReceiptPayment.is_deleted == False)
        .order_by(ReceiptPayment.id)
    )).all()
    return [(r.kind, Decimal(str(r.amount)), r.method) for r in rows]


async def _status(db, receipt_id: int) -> tuple:
    row = (await db.execute(
        select(Receipt.pay_method, Receipt.partial_pay, Receipt.is_deleted, Receipt.total)
        .where(Receipt.id == receipt_id)
    )).one()
    return row.pay_method, row.partial_pay, row.is_deleted, Decimal(str(row.total))


async def _accumulation(db, o) -> Decimal:
    value = (await db.execute(
        select(Employee.current_target_accumulation).where(Employee.id == o.emp)
    )).scalar_one()
    return Decimal(str(value or 0))


# ─── Bon creat direct platit ──────────────────────────────────────────────────

async def test_created_paid_receipt_deducts_stock_once_and_records_the_payment():
    db, o = await _fixture()
    rid = await _create_paid(db, o)
    assert await _qty(db, o) == STOC_INITIAL - 3
    assert await _movs(db, rid) == [(SALE, -3)]
    assert await _payments(db, rid) == [(PaymentKind.PLATA, Decimal("300.00"), PaymentMethod.CASH)]
    mv = (await db.execute(
        select(StockMovement.created_by_user, StockMovement.unit_cost)
        .where(StockMovement.receipt_id == rid)
    )).one()
    assert (mv.created_by_user, mv.unit_cost) == ("casier", Decimal("40.00"))


async def test_created_partial_receipt_deducts_stock_and_records_the_advance():
    db, o = await _fixture()
    rid = await _create_paid(db, o, pay_method=PayMethod.PARTIAL, partial_pay=Decimal("100.00"))
    assert await _qty(db, o) == STOC_INITIAL - 3
    assert await _payments(db, rid) == [(PaymentKind.PLATA, Decimal("100.00"), PaymentMethod.ALTA)]


async def test_created_unpaid_receipt_moves_nothing():
    db, o = await _fixture()
    rid = await _create_paid(db, o, pay_method=PayMethod.NEPLATIT)
    assert await _qty(db, o) == STOC_INITIAL
    assert await _movs(db, rid) == [] and await _payments(db, rid) == []


async def test_revert_to_unpaid_adds_back_exactly_once():
    db, o = await _fixture()
    rid = await _create_paid(db, o)
    await _set_status(db, o, rid, PayMethod.NEPLATIT)
    assert await _qty(db, o) == STOC_INITIAL
    # A doua cerere identica (dublu click) si un apel direct al serviciului nu mai adauga nimic.
    await _set_status(db, o, rid, PayMethod.NEPLATIT)
    await reverse_sale_for_receipt(db, o.acc, await db.get(Receipt, rid))
    await db.commit()
    assert await _qty(db, o) == STOC_INITIAL
    assert await _movs(db, rid) == [(SALE, -3), (REVERSE, 3)]
    # Registrul arata banii intrati si iesiti, net zero.
    assert [(k, a) for k, a, _ in await _payments(db, rid)] == [
        (PaymentKind.PLATA, Decimal("300.00")), (PaymentKind.RESTITUIRE, Decimal("300.00")),
    ]


async def test_delete_of_a_paid_receipt_nets_to_zero():
    db, o = await _fixture()
    rid = await _create_paid(db, o)
    await _delete(db, o, rid)
    assert await _qty(db, o) == STOC_INITIAL
    assert await _movs(db, rid) == [(SALE, -3), (REVERSE, 3)]
    await raises_http(404, _delete(db, o, rid))
    await db.rollback()
    assert await _qty(db, o) == STOC_INITIAL
    assert await _movs(db, rid) == [(SALE, -3), (REVERSE, 3)]


async def test_paid_method_change_does_not_touch_stock():
    db, o = await _fixture()
    rid = await _create_paid(db, o)
    await _set_status(db, o, rid, PayMethod.CARD)
    assert await _qty(db, o) == STOC_INITIAL - 3
    assert await _movs(db, rid) == [(SALE, -3)]


# ─── Regula unica: reconcilierea din jurnal ───────────────────────────────────

async def test_repeated_reconcile_is_a_noop():
    db, o = await _fixture()
    rid = await _legacy_receipt(db, o)
    receipt = await db.get(Receipt, rid)
    for _ in range(3):
        await reconcile_sale_for_receipt(db, o.acc, receipt, paid=True)
    await apply_sale_for_receipt(db, o.acc, receipt)
    assert await _qty(db, o) == STOC_INITIAL - 3
    assert await _movs(db, rid) == [(SALE, -3)]
    for _ in range(3):
        await reconcile_sale_for_receipt(db, o.acc, receipt, paid=False)
    assert await _qty(db, o) == STOC_INITIAL
    assert await _movs(db, rid) == [(SALE, -3), (REVERSE, 3)]


async def test_reverse_uses_the_cost_of_the_sale_not_the_current_one():
    db, o = await _fixture()
    rid = await _create_paid(db, o)
    await db.execute(update(Item).where(Item.id == o.item).values(cost_price=Decimal("55.00")))
    await db.commit()
    await _set_status(db, o, rid, PayMethod.NEPLATIT)
    costs = (await db.execute(
        select(StockMovement.unit_cost).where(StockMovement.receipt_id == rid)
        .order_by(StockMovement.id)
    )).scalars().all()
    assert costs == [Decimal("40.00"), Decimal("40.00")]


async def test_phantom_reverse_from_old_versions_does_not_hide_a_later_sale():
    """Jurnal mostenit: SALE_REVERSE fara vanzare, apoi o vanzare reala. Vanzarea
    e inca aplicata si trebuie stornata o singura data."""
    db, o = await _fixture()
    rid = await _legacy_receipt(db, o)
    db.add(StockMovement(
        account_id=o.acc, item_id=o.item, item_name="Ulei", location_id=o.loc, receipt_id=rid,
        movement_type=REVERSE, qty_delta=3,
    ))
    await db.commit()
    receipt = await db.get(Receipt, rid)
    await apply_sale_for_receipt(db, o.acc, receipt)
    assert await _qty(db, o) == STOC_INITIAL - 3
    await reverse_sale_for_receipt(db, o.acc, receipt)
    await reverse_sale_for_receipt(db, o.acc, receipt)
    assert await _qty(db, o) == STOC_INITIAL
    assert await _movs(db, rid) == [(REVERSE, 3), (SALE, -3), (REVERSE, 3)]


# ─── Date existente: platit fara SALE in jurnal ───────────────────────────────

async def test_legacy_paid_receipt_without_sale_adds_nothing_on_revert():
    db, o = await _fixture()
    rid = await _legacy_receipt(db, o, pay_method=PayMethod.CASH)
    await _set_status(db, o, rid, PayMethod.NEPLATIT)
    assert (await _status(db, rid))[0] == PayMethod.NEPLATIT
    assert await _qty(db, o) == STOC_INITIAL
    assert await _movs(db, rid) == []


async def test_legacy_paid_receipt_without_sale_adds_nothing_on_delete():
    db, o = await _fixture()
    rid = await _legacy_receipt(db, o, pay_method=PayMethod.CASH)
    await _delete(db, o, rid)
    assert (await _status(db, rid))[2] is True
    assert await _qty(db, o) == STOC_INITIAL
    assert await _movs(db, rid) == []


async def test_legacy_paid_receipt_edit_moves_only_what_changed():
    """Editarea unui bon vechi platit fara SALE nu scade retroactiv vanzarea veche:
    stocul se misca doar cu diferenta de pe linii, ca inainte."""
    db, o = await _fixture()
    rid = await _legacy_receipt(db, o, pay_method=PayMethod.CASH)
    await _edit(db, o, rid, qty=5)
    assert await _qty(db, o) == STOC_INITIAL - 2
    assert await _movs(db, rid) == [(SALE, -2)]
    # Aceeasi editare inca o data nu mai misca nimic net.
    await _edit(db, o, rid, qty=5)
    assert await _qty(db, o) == STOC_INITIAL - 2
    await _set_status(db, o, rid, PayMethod.NEPLATIT)
    assert await _qty(db, o) == STOC_INITIAL


async def test_edit_of_a_paid_receipt_reverses_old_lines_and_applies_the_new_ones():
    db, o = await _fixture()
    rid = await _create_paid(db, o)
    await _edit(db, o, rid, qty=1)
    assert await _qty(db, o) == STOC_INITIAL - 1
    assert await _movs(db, rid) == [(SALE, -3), (REVERSE, 3), (SALE, -1)]


async def test_edit_of_an_unpaid_receipt_moves_no_stock():
    db, o = await _fixture()
    rid = await _legacy_receipt(db, o)
    await _edit(db, o, rid, qty=5)
    assert await _qty(db, o) == STOC_INITIAL
    assert await _movs(db, rid) == []


# ─── Bon sters ────────────────────────────────────────────────────────────────

async def test_status_and_content_on_a_deleted_receipt_are_404_and_move_nothing():
    db, o = await _fixture()
    rid = await _create_paid(db, o)
    await _delete(db, o, rid)
    before_movs, before_pay = await _movs(db, rid), await _payments(db, rid)

    await raises_http(404, _set_status(db, o, rid, PayMethod.NEPLATIT))
    await raises_http(404, _set_status(db, o, rid, PayMethod.CARD))
    await raises_http(404, _edit(db, o, rid, qty=5))
    await db.rollback()

    assert await _qty(db, o) == STOC_INITIAL
    assert await _movs(db, rid) == before_movs == [(SALE, -3), (REVERSE, 3)]
    assert await _payments(db, rid) == before_pay
    pay_method, _, is_deleted, total = await _status(db, rid)
    assert (pay_method, is_deleted, total) == (PayMethod.CASH, True, Decimal("300.00"))


async def test_paying_a_deleted_unpaid_receipt_is_404_and_writes_nothing():
    db, o = await _fixture()
    rid = await _legacy_receipt(db, o)
    await _delete(db, o, rid)
    await raises_http(404, _set_status(db, o, rid, PayMethod.CASH))
    await db.rollback()
    assert await _qty(db, o) == STOC_INITIAL
    assert await _movs(db, rid) == [] and await _payments(db, rid) == []
    assert (await _status(db, rid))[0] == PayMethod.NEPLATIT


# ─── Plata partiala ───────────────────────────────────────────────────────────

async def test_partial_pay_must_be_positive_and_at_most_the_total():
    db, o = await _fixture()
    rid = await _legacy_receipt(db, o, qty=1)  # total 100.00
    # 100 e valoarea implicita din formular; pe un bon de 100 e inca in regula,
    # deci verificam cu una peste total.
    detail = await raises_http(422, _set_status(db, o, rid, PayMethod.PARTIAL, Decimal("100.01")))
    assert "100.01" in detail and "100.00" in detail, detail
    await raises_http(422, _set_status(db, o, rid, PayMethod.PARTIAL, None))
    await raises_http(422, _set_status(db, o, rid, PayMethod.PARTIAL, Decimal("0")))
    await db.rollback()
    assert (await _status(db, rid))[:2] == (PayMethod.NEPLATIT, None)
    assert await _payments(db, rid) == [] and await _movs(db, rid) == []

    await _set_status(db, o, rid, PayMethod.PARTIAL, Decimal("40.00"))
    pay_method, partial, _, _ = await _status(db, rid)
    assert (pay_method, Decimal(str(partial))) == (PayMethod.PARTIAL, Decimal("40.00"))
    assert await _payments(db, rid) == [(PaymentKind.PLATA, Decimal("40.00"), PaymentMethod.ALTA)]


async def test_create_rejects_a_partial_larger_than_the_total():
    db, o = await _fixture()
    await raises_http(422, _create_paid(
        db, o, qty=1, pay_method=PayMethod.PARTIAL, partial_pay=Decimal("250.00"),
    ))
    await raises_http(422, _create_paid(db, o, qty=1, pay_method=PayMethod.PARTIAL))
    await db.rollback()
    assert (await db.execute(select(Receipt.id))).all() == []
    assert await _qty(db, o) == STOC_INITIAL


async def test_advance_on_a_receipt_without_lines_is_not_capped():
    """Deviz inca fara linii (total 0): avansul din selectorul de status ramane
    permis, la fel ca in registrul de plati; doar suma <= 0 e respinsa."""
    db, o = await _fixture()
    account = await db.get(Account, o.acc)
    receipt = await make_receipt(db, account, "0.00", location_id=o.loc)
    await db.commit()
    rid = receipt.id

    await raises_http(422, _set_status(db, o, rid, PayMethod.PARTIAL, Decimal("0")))
    await db.rollback()

    await _set_status(db, o, rid, PayMethod.PARTIAL, Decimal("100.00"))
    pay_method, partial, _, _ = await _status(db, rid)
    assert (pay_method, Decimal(str(partial))) == (PayMethod.PARTIAL, Decimal("100.00"))
    assert await _payments(db, rid) == [(PaymentKind.PLATA, Decimal("100.00"), PaymentMethod.ALTA)]
    assert await _qty(db, o) == STOC_INITIAL


# ─── Numerotare ───────────────────────────────────────────────────────────────

async def _two_registers_same_series(db, o) -> SimpleNamespace:
    reg1 = Register(account_id=o.acc, name="Registru Centru", deviz_serie="DV", deviz_numar=100)
    reg2 = Register(account_id=o.acc, name="Registru Nord", deviz_serie="DV", deviz_numar=100)
    db.add_all([reg1, reg2])
    await db.flush()
    loc1 = Location(account_id=o.acc, name="Centru", register_id=reg1.id)
    loc2 = Location(account_id=o.acc, name="Nord", register_id=reg2.id)
    db.add_all([loc1, loc2])
    await db.commit()
    return SimpleNamespace(reg1=reg1.id, reg2=reg2.id, loc1=loc1.id, loc2=loc2.id)


async def _new_receipt_id(db, o) -> int:
    receipt = await make_receipt(db, await db.get(Account, o.acc))
    await db.commit()
    return receipt.id


async def _deviz(db, o, receipt_id: int, location_id: int):
    return await assign_number(
        receipt_id, AssignNumberRequest(doc_type="deviz", location_id=location_id), db, o.acc,
    )


async def _counter(db, register_id: int) -> int:
    return (await db.execute(
        select(Register.deviz_numar).where(Register.id == register_id)
    )).scalar_one()


async def _deviz_nr(db, receipt_id: int) -> int:
    return (await db.execute(select(Receipt.deviz_nr).where(Receipt.id == receipt_id))).scalar_one()


async def test_shared_series_collision_is_409_with_a_fix_hint_and_no_number_is_lost():
    db, o = await _fixture()
    n = await _two_registers_same_series(db, o)
    first, second = await _new_receipt_id(db, o), await _new_receipt_id(db, o)

    assert (await _deviz(db, o, first, n.loc1)).nr == 101
    for _ in range(2):  # reincercarea da acelasi raspuns, nu 500 si nu alt numar
        detail = await raises_http(409, _deviz(db, o, second, n.loc2))
        assert "DV 101" in detail and "Registru Nord" in detail and "Registre" in detail, detail
        # Incrementarea contorului a fost anulata: nu ramane gol in numerotare.
        assert await _counter(db, n.reg2) == 100
        assert await _deviz_nr(db, second) == 0

    # Remediul din mesaj: contorul adus la ultimul numar emis.
    await db.execute(update(Register).where(Register.id == n.reg2).values(deviz_numar=101))
    await db.commit()
    assert (await _deviz(db, o, second, n.loc2)).nr == 102
    # Realocarea pe un bon deja numerotat ramane doar o citire.
    assert (await _deviz(db, o, second, n.loc2)).nr == 102
    assert await _counter(db, n.reg2) == 102


async def test_lowered_counter_is_409_and_does_not_skip_to_a_free_number():
    db, o = await _fixture()
    n = await _two_registers_same_series(db, o)
    first, second = await _new_receipt_id(db, o), await _new_receipt_id(db, o)
    assert (await _deviz(db, o, first, n.loc1)).nr == 101
    # Numarul ramane ocupat si dupa stergerea bonului: nu se refoloseste.
    await _delete(db, o, first)
    await db.execute(update(Register).where(Register.id == n.reg1).values(deviz_numar=100))
    await db.commit()

    detail = await raises_http(409, _deviz(db, o, second, n.loc1))
    assert "DV 101" in detail and "(101)" in detail, detail
    assert await _counter(db, n.reg1) == 100
    assert await _deviz_nr(db, second) == 0


# ─── convert-to-deviz ─────────────────────────────────────────────────────────

async def test_convert_to_deviz_persists_the_accumulations():
    db, o = await _fixture()
    rid = await _legacy_receipt(db, o, source="fdl", pay_method=PayMethod.CASH)
    assert await _accumulation(db, o) == Decimal("0")

    r = await convert_fdl_to_deviz(rid, db=db, account_id=o.acc)
    assert r["source"] == "pos"
    # `get_db` inchide sesiunea fara commit: ce nu s-a comis pana aici se pierde.
    await db.rollback()
    assert await _accumulation(db, o) == Decimal("300.00")
    # Conversia nu schimba nici starea de plata, nici liniile: stocul nu se misca.
    assert await _qty(db, o) == STOC_INITIAL and await _movs(db, rid) == []


async def test_accumulation_counts_only_the_current_local_month():
    db, o = await _fixture()
    await _legacy_receipt(db, o, qty=1, pay_method=PayMethod.CASH)
    vechi = await _legacy_receipt(db, o, qty=2, pay_method=PayMethod.CASH)
    await db.execute(
        update(Receipt).where(Receipt.id == vechi)
        .values(created_at=datetime.now(timezone.utc) - timedelta(days=40))
    )
    await _refresh_accumulations(db, o.acc, {o.emp})
    await db.commit()
    assert await _accumulation(db, o) == Decimal("100.00")


# ─── Lock ANAF ────────────────────────────────────────────────────────────────

async def _receipt_with_efactura(db, o, status: str, **rec_kw) -> int:
    company = Company(account_id=o.acc, name=f"Firma {status}", cui=123456)
    db.add(company)
    await db.flush()
    rid = await _legacy_receipt(db, o)
    db.add(EFacturaRecord(
        company_id=company.id, receipt_id=rid, cui="123456", direction="sent", status=status,
        invoice_issue_date=date(2026, 9, 1), deadline_transmit=date(2026, 9, 8), **rec_kw,
    ))
    await db.commit()
    return rid


async def test_rejected_invoice_can_be_corrected():
    db, o = await _fixture()
    rid = await _receipt_with_efactura(db, o, "rejected", index_incarcare=7, download_id=9)
    r = await _edit(db, o, rid, qty=5)
    assert (r["efactura_status"], r["efactura_locked"]) == ("rejected", False)
    assert (Decimal(str(r["total"])), r["receipt_items"][0]["qty"]) == (Decimal("500.00"), 5)
    # Stergerea ramane refuzata: transmiterea inregistrata ar ramane fara bon.
    await raises_http(423, _delete(db, o, rid))
    await db.rollback()
    assert (await _status(db, rid))[2] is False


async def test_sent_accepted_and_in_progress_invoices_stay_locked():
    for status, kw in (
        ("accepted", {"index_incarcare": 7, "download_id": 9}),
        ("in_prelucrare", {"index_incarcare": 7}),
        ("pending_upload", {}),
        ("error", {"index_incarcare": 7}),  # rezultat necunoscut: ANAF poate sa o fi primit
    ):
        db, o = await _fixture()
        rid = await _receipt_with_efactura(db, o, status, **kw)
        await raises_http(423, _edit(db, o, rid, qty=5))
        await raises_http(423, _delete(db, o, rid))
        await db.rollback()
        _, _, is_deleted, total = await _status(db, rid)
        assert (is_deleted, total) == (False, Decimal("300.00")), status
        # Metoda de plata ramane editabila pe bon blocat, ca inainte.
        r = await _set_status(db, o, rid, PayMethod.CASH)
        assert r["efactura_locked"] is True, status


TESTS = [v for k, v in sorted(globals().items()) if k.startswith("test_")]

if __name__ == "__main__":
    for t in TESTS:
        run(t())
    print(f"OK — {len(TESTS)} scenarii stare de plata + stoc + numerotare trecute.")
