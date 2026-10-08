"""Modificarile unui bon facute de pe un dispozitiv ajung pe celelalte.

Recepția si POS-ul asculta `/api/receipts/events`; fiecare ruta care schimba un
bon trebuie sa anunte contul prin `broadcaster.notify`. Registrul de plati
(avans din POS) si legarea clientului nu anuntau: bonul aparea neschimbat in
Recepție pana la reincarcarea paginii.

Rulabil cu pytest sau direct:  python -m tests.test_receipts_broadcast  (din backend/)
"""
from __future__ import annotations

from decimal import Decimal

from app.broadcaster import broadcaster
from app.models.receipt import PayMethod
from app.models.receipt_payment import PaymentKind
from app.routers import receipt_payments as pay_router
from app.routers import receipts as receipts_router
from app.schemas.receipt import ReceiptClientPatch
from app.schemas.receipt_payment import PaymentCreate
from tests._harness import make_account, make_client, make_receipt, make_session, raises_http, run

# Handlerul e invelit de rate limiter (slowapi), care cere un Request real.
_route_add_payment = getattr(pay_router.add_payment, "__wrapped__", pay_router.add_payment)


class _Listen:
    """Un ascultator pe cont, ca o Recepție deschisa; `events()` goleste coada."""

    def __init__(self, account_id: int):
        self.account_id = account_id

    def __enter__(self):
        self.q = broadcaster.subscribe(self.account_id)
        return self

    def __exit__(self, *exc):
        broadcaster.unsubscribe(self.account_id, self.q)

    def events(self) -> list[str]:
        out = []
        while not self.q.empty():
            out.append(self.q.get_nowait()["type"])
        return out


async def _unlocked(mod, call):
    """Fara interogarea de eFactura (bonurile din test nu au inregistrare)."""
    original = mod._assert_not_locked

    async def _noop(*_a, **_kw):
        return None

    mod._assert_not_locked = _noop
    try:
        return await call()
    finally:
        mod._assert_not_locked = original


async def _fixture():
    db = await make_session()
    acc = await make_account(db)
    other = await make_account(db, username="alta", code="alta")
    receipt = await make_receipt(db, acc, "300.00")
    await db.commit()
    return db, acc, other, receipt


async def test_advance_and_its_deletion_notify_the_account():
    db, acc, other, receipt = await _fixture()
    with _Listen(acc.id) as own, _Listen(other.id) as foreign:
        res = await _unlocked(pay_router, lambda: _route_add_payment(
            request=None, receipt_id=receipt.id,
            body=PaymentCreate(kind=PaymentKind.AVANS, amount=Decimal("100.00")),
            db=db, account_id=acc.id, actor="casier",
        ))
        assert receipt.pay_method == PayMethod.PARTIAL
        assert own.events() == ["receipts_changed"]

        await _unlocked(pay_router, lambda: pay_router.delete_payment(
            receipt.id, res["payments"][0]["id"], db=db, account_id=acc.id, actor="casier",
        ))
        assert receipt.pay_method == PayMethod.NEPLATIT
        assert own.events() == ["receipts_changed"]
        assert foreign.events() == [], "alt cont nu primeste nimic"


async def test_refused_payment_notifies_nobody():
    db, acc, _, receipt = await _fixture()
    with _Listen(acc.id) as own:
        await _unlocked(pay_router, lambda: raises_http(409, _route_add_payment(
            request=None, receipt_id=receipt.id,
            body=PaymentCreate(kind=PaymentKind.PLATA, amount=Decimal("999.00")),
            db=db, account_id=acc.id, actor="casier",
        )))
        assert own.events() == []


async def test_linking_the_client_notifies_the_account():
    db, acc, _, receipt = await _fixture()
    client = await make_client(db, acc)
    await db.commit()
    with _Listen(acc.id) as own:
        await _unlocked(receipts_router, lambda: receipts_router.patch_receipt_client(
            receipt.id, ReceiptClientPatch(client_id=client.id), db=db, account_id=acc.id,
        ))
        assert receipt.client_id == client.id
        assert own.events() == ["receipts_changed"]


TESTS = [v for k, v in sorted(globals().items()) if k.startswith("test_")]

if __name__ == "__main__":
    for t in TESTS:
        run(t())
    print(f"OK — {len(TESTS)} scenarii de anuntare a modificarilor de bon trecute.")
