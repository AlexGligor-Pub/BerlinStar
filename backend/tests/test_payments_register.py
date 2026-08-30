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

from app.models.receipt import PayMethod
from app.models.receipt_payment import PaymentKind, PaymentMethod
from app.services import payments_service as svc
from tests._harness import make_account, make_receipt, make_session, raises_http, run


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
    """Scenariul concret: 2000 in loc de 200 pe un bon de 500."""
    db, acc, receipt = await _fixture("500.00")
    payment, _ = await _add(db, acc, receipt, PaymentKind.PLATA, "2000.00")
    assert receipt.pay_method == PayMethod.CASH  # aparent achitat

    summary = await svc.delete_payment(db, acc.id, receipt.id, payment.id)
    assert summary["incasat_net"] == Decimal("0.00")
    assert receipt.pay_method == PayMethod.NEPLATIT
    assert receipt.partial_pay is None


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
