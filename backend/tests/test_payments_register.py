"""Registrul de plati: mai multe miscari per bon, corectabile, izolate pe bon.

Regresiile pe care le prinde:
  - registrul accepta o SINGURA miscare (prima incasare schimba statusul, iar
    garda „bonul are deja status de plata" bloca tot ce urma — inclusiv
    stergerea unei sume tastate gresit, care ramanea acolo definitiv);
  - `delete_payment` cauta plata doar dupa id, deci un payment_id de pe alt bon
    era acceptat si ii schimba statusul pe furis.

Rulabil cu pytest sau direct:  python -m tests.test_payments_register
"""
from __future__ import annotations
from decimal import Decimal

from fastapi import HTTPException

from app.models.receipt import PayMethod
from app.models.receipt_payment import PaymentKind, PaymentMethod, ReceiptPayment
from app.routers.receipt_payments import list_payments as list_payments_route
from app.services import payments_service as svc
from tests._harness import (
    make_account, make_employee, make_receipt, make_session, raises_http, run,
)


async def _fixture(total="500.00"):
    db = await make_session()
    acc = await make_account(db)
    receipt = await make_receipt(db, acc, total)
    await db.commit()
    return db, acc, receipt


async def _add(db, acc, receipt, kind, amount, method=PaymentMethod.CASH):
    return await svc.add_payment(
        db, account_id=acc.id, receipt_id=receipt.id,
        kind=kind, amount=Decimal(amount), method=method,
    )


# ─── Mai multe miscari pe acelasi bon ─────────────────────────────────────────

async def test_several_movements_accumulate():
    db, acc, receipt = await _fixture("500.00")
    await _add(db, acc, receipt, PaymentKind.AVANS, "200.00")
    assert receipt.pay_method == PayMethod.PARTIAL
    assert Decimal(receipt.partial_pay) == Decimal("200.00")

    # Al doilea apel trebuie sa treaca: registrul nu se inchide la primul avans.
    _p, summary = await _add(db, acc, receipt, PaymentKind.PLATA, "300.00")
    assert summary["incasat_net"] == Decimal("500.00")
    assert summary["rest_de_plata"] == Decimal("0.00")
    assert receipt.pay_method == PayMethod.CASH
    assert receipt.partial_pay is None


async def test_refund_can_be_recorded_after_an_advance():
    db, acc, receipt = await _fixture("500.00")
    await _add(db, acc, receipt, PaymentKind.AVANS, "200.00")
    _p, summary = await _add(db, acc, receipt, PaymentKind.RESTITUIRE, "50.00")
    assert summary["incasat_net"] == Decimal("150.00")
    assert summary["restituit"] == Decimal("50.00")
    assert receipt.pay_method == PayMethod.PARTIAL


async def test_refund_cannot_exceed_what_was_collected():
    db, acc, receipt = await _fixture("500.00")
    await _add(db, acc, receipt, PaymentKind.AVANS, "100.00")
    await raises_http(400, _add(db, acc, receipt, PaymentKind.RESTITUIRE, "150.00"))


async def test_zero_or_negative_amount_is_rejected():
    db, acc, receipt = await _fixture()
    await raises_http(400, _add(db, acc, receipt, PaymentKind.PLATA, "0.00"))
    await raises_http(400, _add(db, acc, receipt, PaymentKind.PLATA, "-10.00"))


# ─── Corectarea unei greseli ──────────────────────────────────────────────────

async def test_a_mistyped_amount_can_be_deleted_and_status_recovers():
    """Scenariul concret: 2000 in loc de 200 pe un bon de 500. Suma peste rest e
    refuzata din start; una gresita dar incadrata in rest (500) se poate sterge."""
    db, acc, receipt = await _fixture("500.00")
    await raises_http(409, _add(db, acc, receipt, PaymentKind.PLATA, "2000.00"))
    assert await svc.list_payments(db, acc.id, receipt.id) == []
    assert receipt.pay_method == PayMethod.NEPLATIT

    payment, _ = await _add(db, acc, receipt, PaymentKind.PLATA, "500.00")
    assert receipt.pay_method == PayMethod.CASH  # aparent achitat

    summary = await svc.delete_payment(db, acc.id, receipt.id, payment.id)
    assert summary["incasat_net"] == Decimal("0.00")
    assert receipt.pay_method == PayMethod.NEPLATIT
    assert receipt.partial_pay is None


# ─── Plafonul: incasarile nu depasesc restul de plata ─────────────────────────

async def test_second_simultaneous_full_payment_is_rejected():
    """Doua statii trimit simultan plata integrala. Amandoua au citit bonul
    Neplatit inainte de lock; a doua intra in serviciu dupa ce prima a facut
    commit si trebuie sa vada registrul recitit, nu ce stia la inceput."""
    db, acc, receipt = await _fixture("500.00")
    assert receipt.pay_method == PayMethod.NEPLATIT  # ce au vazut ambele cereri

    await _add(db, acc, receipt, PaymentKind.PLATA, "500.00")
    detail = await raises_http(409, _add(db, acc, receipt, PaymentKind.PLATA, "500.00", PaymentMethod.CARD))
    assert "deja incasat integral" in detail

    payments = await svc.list_payments(db, acc.id, receipt.id)
    assert [Decimal(p.amount) for p in payments] == [Decimal("500.00")]
    summary = svc.summarize(payments, receipt.total)
    assert summary["incasat_net"] == Decimal("500.00")
    assert summary["rest_de_plata"] == Decimal("0.00")
    assert receipt.pay_method == PayMethod.CASH, "plata refuzata nu schimba metoda"


async def test_payment_above_the_remaining_balance_is_rejected():
    db, acc, receipt = await _fixture("500.00")
    await _add(db, acc, receipt, PaymentKind.AVANS, "300.00")
    detail = await raises_http(409, _add(db, acc, receipt, PaymentKind.PLATA, "300.00"))
    assert "200.00" in detail, "mesajul spune cat mai e de incasat"
    assert len(await svc.list_payments(db, acc.id, receipt.id)) == 1
    assert receipt.pay_method == PayMethod.PARTIAL
    assert Decimal(receipt.partial_pay) == Decimal("300.00")

    # Exact restul trece.
    _p, summary = await _add(db, acc, receipt, PaymentKind.PLATA, "200.00")
    assert summary["rest_de_plata"] == Decimal("0.00")


async def test_advance_above_the_current_total_is_accepted_then_resynced():
    """Deviz cu o singura linie de 50 lei, avans 500. Avansul trece, apoi se
    adauga restul lucrarilor si statusul se reciteste fata de noul total."""
    db, acc, receipt = await _fixture("50.00")
    _p, summary = await _add(db, acc, receipt, PaymentKind.AVANS, "500.00")
    assert summary["incasat_net"] == Decimal("500.00")
    assert summary["rest_de_plata"] == Decimal("-450.00")
    assert receipt.pay_method == PayMethod.CASH

    receipt.total = Decimal("1200.00")  # s-au adaugat liniile ramase
    await svc.resync_after_total_change(db, acc.id, receipt)
    assert receipt.pay_method == PayMethod.PARTIAL
    assert Decimal(receipt.partial_pay) == Decimal("500.00")

    # Dupa ce totalul e cunoscut, PLATA ramane plafonata la rest.
    detail = await raises_http(409, _add(db, acc, receipt, PaymentKind.PLATA, "800.00"))
    assert "700.00" in detail
    _p, summary = await _add(db, acc, receipt, PaymentKind.PLATA, "700.00")
    assert summary["rest_de_plata"] == Decimal("0.00")


async def test_second_simultaneous_full_advance_is_rejected():
    """Avansul nu are plafon la rest, dar pe un bon deja acoperit nu mai intra:
    dublul click pe un avans integral nu dubleaza incasarea."""
    db, acc, receipt = await _fixture("500.00")
    await _add(db, acc, receipt, PaymentKind.AVANS, "500.00")
    for amount in ("500.00", "0.01"):
        detail = await raises_http(409, _add(db, acc, receipt, PaymentKind.AVANS, amount))
        assert "deja incasat integral" in detail
    payments = await svc.list_payments(db, acc.id, receipt.id)
    assert [Decimal(p.amount) for p in payments] == [Decimal("500.00")]
    assert receipt.pay_method == PayMethod.CASH


async def test_refund_reopens_room_for_a_new_payment():
    db, acc, receipt = await _fixture("500.00")
    await _add(db, acc, receipt, PaymentKind.AVANS, "500.00")
    await _add(db, acc, receipt, PaymentKind.RESTITUIRE, "100.00")
    await raises_http(409, _add(db, acc, receipt, PaymentKind.PLATA, "150.00"))
    _p, summary = await _add(db, acc, receipt, PaymentKind.PLATA, "100.00")
    assert summary["incasat_net"] == Decimal("500.00")


async def test_legacy_partial_counts_against_the_remaining_balance():
    """Bon vechi cu `partial_pay` si fara registru: avansul vechi se scade din
    rest inainte de comparatie."""
    db = await make_session()
    acc = await make_account(db)
    receipt = await make_receipt(
        db, acc, "500.00", pay_method=PayMethod.PARTIAL, partial_pay=Decimal("100.00"),
    )
    await db.commit()
    detail = await raises_http(409, _add(db, acc, receipt, PaymentKind.PLATA, "500.00"))
    assert "400.00" in detail


async def test_receipt_without_total_still_accepts_an_advance():
    """Deviz fara linii (total 0): avansul se ia inainte de a trece lucrarile pe
    bon, deci plafonul nu se aplica."""
    db, acc, receipt = await _fixture("0.00")
    _p, summary = await _add(db, acc, receipt, PaymentKind.AVANS, "200.00")
    assert summary["incasat_net"] == Decimal("200.00")
    assert receipt.pay_method == PayMethod.PARTIAL


async def test_non_numeric_amount_is_rejected():
    db, acc, receipt = await _fixture()
    await raises_http(400, _add(db, acc, receipt, PaymentKind.PLATA, "NaN"))
    await raises_http(400, _add(db, acc, receipt, PaymentKind.PLATA, "Infinity"))
    assert await svc.list_payments(db, acc.id, receipt.id) == []


async def test_deleting_a_refund_cannot_push_collections_above_the_total():
    db, acc, receipt = await _fixture("500.00")
    await _add(db, acc, receipt, PaymentKind.AVANS, "300.00")
    refund, _ = await _add(db, acc, receipt, PaymentKind.RESTITUIRE, "100.00")
    await _add(db, acc, receipt, PaymentKind.PLATA, "250.00")  # net 450

    await raises_http(409, svc.delete_payment(db, acc.id, receipt.id, refund.id))
    assert refund.is_deleted is False
    assert receipt.pay_method == PayMethod.PARTIAL
    assert Decimal(receipt.partial_pay) == Decimal("450.00")


async def test_deleting_a_refund_within_the_total_still_works():
    db, acc, receipt = await _fixture("500.00")
    await _add(db, acc, receipt, PaymentKind.AVANS, "300.00")
    refund, _ = await _add(db, acc, receipt, PaymentKind.RESTITUIRE, "100.00")
    summary = await svc.delete_payment(db, acc.id, receipt.id, refund.id)
    assert summary["incasat_net"] == Decimal("300.00")


async def test_second_delete_of_the_same_payment_gets_404():
    """Doua stergeri simultane: a doua cauta plata dupa lock si n-o mai gaseste."""
    db, acc, receipt = await _fixture("500.00")
    first, _ = await _add(db, acc, receipt, PaymentKind.AVANS, "200.00")
    await _add(db, acc, receipt, PaymentKind.AVANS, "100.00")
    await svc.delete_payment(db, acc.id, receipt.id, first.id)
    await raises_http(404, svc.delete_payment(db, acc.id, receipt.id, first.id))
    assert Decimal(receipt.partial_pay) == Decimal("100.00")


# ─── Garda apelantului, sub lock ──────────────────────────────────────────────

async def test_guard_runs_on_the_fresh_receipt_and_blocks_before_any_write():
    db, acc, receipt = await _fixture("500.00")
    payment, _ = await _add(db, acc, receipt, PaymentKind.AVANS, "200.00")
    seen: list[PayMethod] = []

    async def guard(_db, r):
        seen.append(r.pay_method)
        raise HTTPException(423, "Bonul a fost trimis la ANAF.")

    await raises_http(423, svc.add_payment(
        db, account_id=acc.id, receipt_id=receipt.id, kind=PaymentKind.PLATA,
        amount=Decimal("300.00"), method=PaymentMethod.CASH, guard=guard,
    ))
    await raises_http(423, svc.delete_payment(db, acc.id, receipt.id, payment.id, guard=guard))
    assert seen == [PayMethod.PARTIAL, PayMethod.PARTIAL]
    assert len(await svc.list_payments(db, acc.id, receipt.id)) == 1
    assert Decimal(receipt.partial_pay) == Decimal("200.00")


async def test_deleting_one_of_two_recomputes_the_rest():
    db, acc, receipt = await _fixture("500.00")
    first, _ = await _add(db, acc, receipt, PaymentKind.AVANS, "200.00")
    await _add(db, acc, receipt, PaymentKind.PLATA, "300.00")
    summary = await svc.delete_payment(db, acc.id, receipt.id, first.id)
    assert summary["incasat_net"] == Decimal("300.00")
    assert receipt.pay_method == PayMethod.PARTIAL
    assert Decimal(receipt.partial_pay) == Decimal("300.00")


# ─── Izolare intre bonuri si intre conturi ────────────────────────────────────

async def test_payment_of_another_receipt_cannot_be_deleted_through_this_one():
    db, acc, receipt_a = await _fixture("500.00")
    receipt_b = await make_receipt(db, acc, "500.00")
    await db.commit()

    payment_b, _ = await _add(db, acc, receipt_b, PaymentKind.PLATA, "500.00")
    # Bonul A e neplatit, deci ar trece de orice garda pusa pe bonul din path;
    # plata insa e a bonului B si nu are ce cauta aici.
    await raises_http(404, svc.delete_payment(db, acc.id, receipt_a.id, payment_b.id))
    assert receipt_b.pay_method == PayMethod.CASH  # neatins


async def test_payment_of_another_account_is_invisible():
    db, acc, receipt = await _fixture("500.00")
    other = await make_account(db, username="alta", code="alta")
    other_receipt = await make_receipt(db, other, "100.00")
    await db.commit()
    payment, _ = await _add(db, other, other_receipt, PaymentKind.PLATA, "100.00")
    await raises_http(404, svc.delete_payment(db, acc.id, receipt.id, payment.id))


async def test_legacy_payment_linked_to_a_foreign_employee_hides_the_name():
    """Miscare salvata inainte de verificarea de apartenenta, cu angajatul altui
    cont: id-ul ramane in raspuns, numele nu."""
    db, acc, receipt = await _fixture("500.00")
    other = await make_account(db, username="alta", code="alta")
    own = await make_employee(db, acc, "Ion")
    foreign = await make_employee(db, other, "Strain")
    for emp in (own, foreign):
        db.add(ReceiptPayment(
            receipt_id=receipt.id, account_id=acc.id, kind=PaymentKind.AVANS,
            amount=Decimal("10.00"), method=PaymentMethod.CASH, employee_id=emp.id,
        ))
        await db.flush()
    await db.commit()

    res = await list_payments_route(receipt.id, db=db, account_id=acc.id)
    assert [(p["employee_id"], p["employee_name"]) for p in res["payments"]] == [
        (own.id, "Ion"), (foreign.id, None),
    ]


# ─── Statusul dedus din registru ──────────────────────────────────────────────

async def test_status_follows_the_method_of_the_last_positive_movement():
    db, acc, receipt = await _fixture("500.00")
    await _add(db, acc, receipt, PaymentKind.AVANS, "200.00", PaymentMethod.CASH)
    await _add(db, acc, receipt, PaymentKind.PLATA, "300.00", PaymentMethod.CARD)
    assert receipt.pay_method == PayMethod.CARD


async def test_legacy_partial_is_seeded_once_into_the_register():
    """Bon vechi, cu `partial_pay` dar fara registru: suma existenta devine prima
    inregistrare, ca sa nu para ca banii au aparut din senin."""
    db = await make_session()
    acc = await make_account(db)
    receipt = await make_receipt(
        db, acc, "500.00", pay_method=PayMethod.PARTIAL, partial_pay=Decimal("100.00"),
    )
    await db.commit()

    _p, summary = await _add(db, acc, receipt, PaymentKind.PLATA, "400.00")
    assert summary["incasat_net"] == Decimal("500.00")
    payments = await svc.list_payments(db, acc.id, receipt.id)
    assert len(payments) == 2, "avansul vechi trebuia preluat exact o data"
    assert receipt.pay_method == PayMethod.CASH


async def test_resync_after_discount_clears_a_stale_partial_status():
    """Bon incasat partial, apoi redus pana sub suma incasata: statusul stocat nu
    are voie sa ramana „Platit Partial"."""
    db, acc, receipt = await _fixture("500.00")
    await _add(db, acc, receipt, PaymentKind.PLATA, "300.00")
    assert receipt.pay_method == PayMethod.PARTIAL

    receipt.total = Decimal("250.00")  # s-a aplicat o reducere
    await svc.resync_after_total_change(db, acc.id, receipt)
    assert receipt.pay_method == PayMethod.CASH
    assert receipt.partial_pay is None


async def test_resync_without_register_caps_an_advance_above_the_new_total():
    db = await make_session()
    acc = await make_account(db)
    receipt = await make_receipt(
        db, acc, "100.00", pay_method=PayMethod.PARTIAL, partial_pay=Decimal("400.00"),
    )
    await db.commit()
    await svc.resync_after_total_change(db, acc.id, receipt)
    assert Decimal(receipt.partial_pay) == Decimal("100.00")


TESTS = [v for k, v in sorted(globals().items()) if k.startswith("test_")]

if __name__ == "__main__":
    for t in TESTS:
        run(t())
    print(f"OK — {len(TESTS)} scenarii de registru de plati trecute.")
