"""Abonament Stripe: sume, perioada, reconciliere webhook (PaymentIntent + Checkout Session).

Regresiile pe care le prinde:
  - `replace(year+1)` pica pe 29 februarie;
  - un cont fara rand de abonament primea perioada „de la anul viitor" (un an gratis);
  - `payment_intent.succeeded` livrat de doua ori (sau dupa `checkout.session.completed`)
    emitea a doua factura si muta scadenta cu inca un an;
  - in modul EUR, amount_ron primea suma in EUR, iar factura iesea gresita.

Stripe e inlocuit cu fake-uri la nivel de `_stripe_call`; nu se face nicio cerere reala.
Rulabil direct:  python -m tests.test_subscription_stripe
"""
from __future__ import annotations
from datetime import date, timedelta
from decimal import Decimal

from app.models.global_settings import GlobalSettings
from app.models.subscription import AccountSubscription, SubscriptionPayment
from app.subscriptions import fx_service, stripe_service as svc
from tests._harness import make_account, make_session, run


class _FakeStripe:
    """Raspunsuri canned per functie Stripe (identificata dupa __name__)."""

    def __init__(self, **responses):
        self.responses = responses
        self.calls: list[tuple[str, dict]] = []

    async def __call__(self, fn, *args, **kwargs):
        name = getattr(fn, "__name__", str(fn))
        self.calls.append((name, kwargs))
        return self.responses[name]


def _patch(monkeypatch_targets: dict):
    saved = {k: getattr(svc, k) for k in monkeypatch_targets}
    for k, v in monkeypatch_targets.items():
        setattr(svc, k, v)
    return saved


def _restore(saved: dict):
    for k, v in saved.items():
        setattr(svc, k, v)


async def _fake_fx():
    return fx_service.FxRate(base="EUR", target="RON", rate=Decimal("5.0000"), date=date.today())


async def _fixture(currency="RON", vat="19.00"):
    db = await make_session()
    acc = await make_account(db)
    gs = GlobalSettings(
        subscription_price_eur=Decimal("700.00"),
        subscription_vat_percent=Decimal(vat),
        subscription_currency_charge=currency,
        issuer_name="Professor Prime SRL", issuer_cui="RO123", issuer_city="Timisoara",
        issuer_county_code="RO-TM", stripe_publishable_key="pk_test_x",
    )
    db.add(gs)
    await db.commit()
    return db, acc, gs


_CUSTOMER = {"nume": "Client SRL", "tip": "juridic", "cui": "456", "email": "c@x.ro"}


def _base_patches(fake):
    spawned: list = []
    return {
        "_stripe_call": fake,
        "_stripe_with_key": lambda gs: None,
        "_spawn_bg": lambda coro: (spawned.append(coro), coro.close()),
        "_fetch_charge_details": _fake_charge_details,
    }, spawned


async def _fake_charge_details(gs, intent_id, charge_id):
    return (charge_id or "ch_fake"), "google_pay"


# ─── Utilitare pure ───────────────────────────────────────────────────────────

def test_add_year_handles_leap_day():
    assert svc.add_year(date(2028, 2, 29)) == date(2029, 2, 28)
    assert svc.add_year(date(2026, 9, 4)) == date(2027, 9, 4)


def test_period_without_subscription_starts_today():
    today = date(2026, 9, 4)
    assert svc._period_for(None, today) == (today, date(2027, 9, 4))
    sub = AccountSubscription(account_id=1, next_payment_date=date(2026, 12, 1))
    assert svc._period_for(sub, today) == (date(2026, 12, 1), date(2027, 12, 1))
    expired = AccountSubscription(account_id=1, next_payment_date=date(2026, 1, 1))
    assert svc._period_for(expired, today) == (today, date(2027, 9, 4))


async def test_amounts_ron_and_eur():
    saved = {"get_eur_to_ron": fx_service.get_eur_to_ron}
    fx_service.get_eur_to_ron = _fake_fx
    try:
        _db, _acc, gs = await _fixture("RON")
        a = await svc.compute_amounts(gs)
        assert (a.ron_total, a.ron_net, a.ron_vat) == (Decimal("3500.00"), Decimal("2941.18"), Decimal("558.82"))
        assert (a.stripe_amount, a.stripe_currency) == (350000, "ron")

        gs.subscription_currency_charge = "EUR"
        a = await svc.compute_amounts(gs)
        # Stripe incaseaza EUR, dar factura ramane in RON la cursul BNR.
        assert (a.stripe_amount, a.stripe_currency) == (70000, "eur")
        assert a.ron_total == Decimal("3500.00") and a.fx_rate == Decimal("5.0000")
    finally:
        fx_service.get_eur_to_ron = saved["get_eur_to_ron"]


# ─── Checkout Session (QR) + webhook ──────────────────────────────────────────

def _cs_event(kind, payment_status="paid", pi="pi_1"):
    return {"type": kind, "data": {"object": {
        "object": "checkout.session", "id": "cs_1", "payment_intent": pi,
        "payment_status": payment_status, "client_reference_id": None, "metadata": {},
    }}}


def _pi_event(kind, pi="pi_1", **extra):
    return {"type": kind, "data": {"object": {
        "object": "payment_intent", "id": pi, "latest_charge": "ch_1", "metadata": {}, **extra,
    }}}


async def test_checkout_session_then_duplicate_webhooks_are_idempotent():
    fake = _FakeStripe(create={"id": "cs_1", "url": "https://checkout.stripe.com/c/pay/cs_1", "payment_intent": None})
    patches, spawned = _base_patches(fake)
    saved = _patch(patches)
    fx_saved = fx_service.get_eur_to_ron
    fx_service.get_eur_to_ron = _fake_fx
    try:
        db, acc, _gs = await _fixture()
        acc.is_locked = True
        await db.commit()

        out = await svc.create_checkout_session(db, acc, _CUSTOMER, "http://localhost:2000/configurari?topic=abonament")
        assert out["url"].startswith("https://checkout.stripe.com/")
        kw = fake.calls[-1][1]
        assert kw["success_url"] == f"http://localhost:2000/configurari?topic=abonament&payment=success&payment_id={out['payment_id']}"
        assert kw["line_items"][0]["price_data"] == {"currency": "ron", "unit_amount": 350000, "product_data": {"name": svc.DESCRIPTION}}
        assert kw["payment_intent_data"]["metadata"]["payment_id"] == str(out["payment_id"])

        payment = await db.get(SubscriptionPayment, out["payment_id"])
        assert payment.status == "requires_payment"
        assert payment.stripe_checkout_session_id == "cs_1" and payment.stripe_payment_intent_id is None
        assert payment.period_start == date.today()

        await svc.handle_event(db, _cs_event("checkout.session.completed"))
        await db.refresh(payment)
        assert payment.status == "succeeded"
        assert payment.stripe_payment_intent_id == "pi_1"
        assert payment.payment_method_type == "google_pay"
        assert len(spawned) == 1

        sub = (await db.execute(
            __import__("sqlalchemy").select(AccountSubscription).where(AccountSubscription.account_id == acc.id)
        )).scalar_one()
        assert sub.next_payment_date == svc.add_year(date.today())
        await db.refresh(acc)
        assert acc.is_locked is False

        # Stripe reincearca / livreaza si evenimentul de PI: nimic nu se dubleaza.
        await svc.handle_event(db, _cs_event("checkout.session.completed"))
        await svc.handle_event(db, _pi_event("payment_intent.succeeded"))
        await db.refresh(sub)
        assert sub.next_payment_date == svc.add_year(date.today())
        assert len(spawned) == 1
    finally:
        _restore(saved)
        fx_service.get_eur_to_ron = fx_saved


async def test_payment_intent_flow_failed_then_expired_session():
    fake = _FakeStripe(create={"id": "pi_9", "client_secret": "pi_9_secret"})
    patches, spawned = _base_patches(fake)
    saved = _patch(patches)
    fx_saved = fx_service.get_eur_to_ron
    fx_service.get_eur_to_ron = _fake_fx
    try:
        db, acc, _gs = await _fixture()
        sub = AccountSubscription(account_id=acc.id, next_payment_date=date.today() + timedelta(days=100))
        db.add(sub)
        await db.commit()

        out = await svc.create_payment_intent(db, acc, _CUSTOMER)
        payment = await db.get(SubscriptionPayment, out["payment_id"])
        # Prelungire de la scadenta curenta, nu de azi.
        assert payment.period_start == sub.next_payment_date
        assert payment.period_end == svc.add_year(sub.next_payment_date)

        await svc.handle_event(db, _pi_event("payment_intent.payment_failed", pi="pi_9",
                                             last_payment_error={"message": "Card declinat."}))
        await db.refresh(payment)
        assert (payment.status, payment.failure_reason) == ("failed", "Card declinat.")
        assert spawned == []

        # Eveniment pentru un obiect necunoscut: ignorat, fara exceptie.
        await svc.handle_event(db, _pi_event("payment_intent.succeeded", pi="pi_unknown"))

        # Sesiune QR expirata -> canceled.
        qr = _FakeStripe(create={"id": "cs_2", "url": "https://checkout.stripe.com/c/pay/cs_2", "payment_intent": None})
        svc._stripe_call = qr
        out2 = await svc.create_checkout_session(db, acc, _CUSTOMER, "http://localhost:2000/x")
        ev = _cs_event("checkout.session.expired", payment_status="unpaid", pi=None)
        ev["data"]["object"]["id"] = "cs_2"
        await svc.handle_event(db, ev)
        p2 = await db.get(SubscriptionPayment, out2["payment_id"])
        assert p2.status == "canceled"
    finally:
        _restore(saved)
        fx_service.get_eur_to_ron = fx_saved


async def test_sync_payment_reads_state_from_stripe():
    fake = _FakeStripe(
        create={"id": "cs_3", "url": "https://checkout.stripe.com/c/pay/cs_3", "payment_intent": None},
        retrieve={"id": "cs_3", "object": "checkout.session", "payment_intent": "pi_3", "status": "complete", "payment_status": "paid"},
    )
    patches, spawned = _base_patches(fake)
    saved = _patch(patches)
    fx_saved = fx_service.get_eur_to_ron
    fx_service.get_eur_to_ron = _fake_fx
    try:
        db, acc, _gs = await _fixture("EUR")
        out = await svc.create_checkout_session(db, acc, _CUSTOMER, "http://localhost:2000/x")
        payment = await db.get(SubscriptionPayment, out["payment_id"])

        # Al doilea retrieve (PaymentIntent) trebuie sa vada succeeded.
        class _Two(_FakeStripe):
            async def __call__(self, fn, *args, **kwargs):
                name = getattr(fn, "__name__", str(fn))
                if name == "retrieve" and args and str(args[0]).startswith("pi_"):
                    return {"id": "pi_3", "object": "payment_intent", "status": "succeeded", "latest_charge": "ch_3"}
                return await super().__call__(fn, *args, **kwargs)

        svc._stripe_call = _Two(**fake.responses)
        await svc.sync_payment(db, payment)
        assert payment.status == "succeeded"
        assert payment.stripe_payment_intent_id == "pi_3" and payment.stripe_charge_id == "ch_3"
        assert Decimal(payment.amount_ron) == Decimal("3500.00")
        assert len(spawned) == 1
    finally:
        _restore(saved)
        fx_service.get_eur_to_ron = fx_saved


def main() -> None:
    test_add_year_handles_leap_day()
    test_period_without_subscription_starts_today()
    run(test_amounts_ron_and_eur())
    run(test_checkout_session_then_duplicate_webhooks_are_idempotent())
    run(test_payment_intent_flow_failed_then_expired_session())
    run(test_sync_payment_reads_state_from_stripe())
    print("OK test_subscription_stripe")


if __name__ == "__main__":
    main()
