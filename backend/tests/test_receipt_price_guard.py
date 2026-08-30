"""Un `worker` nu poate ieftini un bon — nici cu reducere, nici pe furis.

Regula are doua cai de ocolire si amandoua trebuie inchise:
  1. `original_price` — reducerea explicita, acordata din modalul de Reducere;
  2. pur si simplu un `price` mai mic, fara sa marcheze nimic ca reducere.
Fara (2), restrictia ar fi decorativa: POS-ul permite oricum editarea pretului
pe linie, deci ar fi de ajuns sa scrii 1 in loc de 100.

Vezi app/routers/receipts.py :: _assert_may_change_prices

Rulabil cu pytest sau direct:  python -m tests.test_receipt_price_guard
"""
from __future__ import annotations

from app.models.user import UserRole
from app.routers.receipts import _assert_may_change_prices
from tests._harness import (
    FakeCtx, Line, add_line, make_account, make_item, make_receipt, make_session,
    raises_http, run,
)

WORKER = FakeCtx(UserRole.WORKER)
MANAGER = FakeCtx(UserRole.MANAGER)
ADMIN = FakeCtx(UserRole.ADMIN)


async def _fixture():
    db = await make_session()
    acc = await make_account(db)
    item = await make_item(db, acc, "Ulei 5W30", "100.00")
    receipt = await make_receipt(db, acc, "100.00")
    return db, acc, item, receipt


# ─── 1. Reducerea explicita ───────────────────────────────────────────────────

async def test_worker_cannot_add_a_discount():
    db, acc, item, receipt = await _fixture()
    await add_line(db, receipt, "Ulei 5W30", "100.00", item_id=item.id)
    await raises_http(403, _assert_may_change_prices(
        db, acc.id, receipt.id,
        [Line("Ulei 5W30", "80.00", original_price="100.00", item_id=item.id)],
        WORKER,
    ))


async def test_worker_may_resend_an_existing_discount_untouched():
    """Cazul normal: managerul a acordat reducerea, worker-ul doar mai adauga un
    articol si retrimite bonul intreg."""
    db, acc, item, receipt = await _fixture()
    await add_line(db, receipt, "Ulei 5W30", "80.00", original_price="100.00", item_id=item.id)
    await _assert_may_change_prices(
        db, acc.id, receipt.id,
        [
            Line("Ulei 5W30", "80.00", original_price="100.00", item_id=item.id),
            Line("Manopera", "50.00"),
        ],
        WORKER,
    )


async def test_worker_cannot_deepen_an_existing_discount():
    db, acc, item, receipt = await _fixture()
    await add_line(db, receipt, "Ulei 5W30", "80.00", original_price="100.00", item_id=item.id)
    await raises_http(403, _assert_may_change_prices(
        db, acc.id, receipt.id,
        [Line("Ulei 5W30", "60.00", original_price="100.00", item_id=item.id)],
        WORKER,
    ))


async def test_worker_cannot_strip_a_discount_off_a_kept_line():
    db, acc, item, receipt = await _fixture()
    await add_line(db, receipt, "Ulei 5W30", "80.00", original_price="100.00", item_id=item.id)
    await raises_http(403, _assert_may_change_prices(
        db, acc.id, receipt.id,
        [Line("Ulei 5W30", "100.00", item_id=item.id)],
        WORKER,
    ))


async def test_worker_may_delete_a_discounted_line_entirely():
    """Stergerea unei linii nu e o modificare de reducere."""
    db, acc, item, receipt = await _fixture()
    await add_line(db, receipt, "Ulei 5W30", "80.00", original_price="100.00", item_id=item.id)
    await add_line(db, receipt, "Manopera", "50.00")
    await _assert_may_change_prices(
        db, acc.id, receipt.id, [Line("Manopera", "50.00")], WORKER,
    )


async def test_worker_cannot_duplicate_a_discounted_line():
    """Regresie: cu o comparatie pe multime (nu multiset), a doua copie a unei
    linii reduse trecea, adica reducerea se putea inmulti."""
    db, acc, item, receipt = await _fixture()
    await add_line(db, receipt, "Ulei 5W30", "80.00", original_price="100.00", item_id=item.id)
    await raises_http(403, _assert_may_change_prices(
        db, acc.id, receipt.id,
        [
            Line("Ulei 5W30", "80.00", original_price="100.00", item_id=item.id),
            Line("Ulei 5W30", "80.00", original_price="100.00", item_id=item.id),
        ],
        WORKER,
    ))


async def test_same_name_discounted_and_not_is_not_a_false_positive():
    """Regresie: verificarea pe NUME respingea un bon perfect legitim in care
    acelasi articol apare o data redus si o data la pret intreg."""
    db, acc, item, receipt = await _fixture()
    await add_line(db, receipt, "Ulei 5W30", "80.00", original_price="100.00", item_id=item.id)
    await add_line(db, receipt, "Ulei 5W30", "100.00", item_id=item.id)
    await _assert_may_change_prices(
        db, acc.id, receipt.id,
        [
            Line("Ulei 5W30", "80.00", original_price="100.00", item_id=item.id),
            Line("Ulei 5W30", "100.00", item_id=item.id),
        ],
        WORKER,
    )


# ─── 2. Reducerea mascata: pretul scazut direct ───────────────────────────────

async def test_worker_cannot_lower_the_price_of_an_existing_line():
    db, acc, item, receipt = await _fixture()
    await add_line(db, receipt, "Ulei 5W30", "100.00", item_id=item.id)
    detail = await raises_http(403, _assert_may_change_prices(
        db, acc.id, receipt.id, [Line("Ulei 5W30", "1.00", item_id=item.id)], WORKER,
    ))
    assert "sub pretul de referinta" in detail


async def test_worker_cannot_add_a_catalog_item_below_list_price():
    db, acc, item, receipt = await _fixture()
    await raises_http(403, _assert_may_change_prices(
        db, acc.id, receipt.id, [Line("Ulei 5W30", "40.00", item_id=item.id)], WORKER,
    ))


async def test_worker_may_raise_a_price():
    db, acc, item, receipt = await _fixture()
    await add_line(db, receipt, "Ulei 5W30", "100.00", item_id=item.id)
    await _assert_may_change_prices(
        db, acc.id, receipt.id, [Line("Ulei 5W30", "120.00", item_id=item.id)], WORKER,
    )


async def test_worker_may_change_quantity():
    db, acc, item, receipt = await _fixture()
    await add_line(db, receipt, "Ulei 5W30", "100.00", item_id=item.id)
    await _assert_may_change_prices(
        db, acc.id, receipt.id, [Line("Ulei 5W30", "100.00", qty=4, item_id=item.id)], WORKER,
    )


async def test_manual_new_line_has_no_reference_price():
    """Linie tastata in POS, fara corespondent in catalog: n-avem fata de ce sa o
    masuram, iar introducerea manuala e un flux legitim."""
    db, acc, item, receipt = await _fixture()
    await _assert_may_change_prices(
        db, acc.id, receipt.id, [Line("Diverse consumabile", "7.50")], WORKER,
    )


async def test_reference_is_the_line_not_the_catalog_when_manager_already_discounted():
    """Regresie: daca referinta ar fi mereu catalogul, retrimiterea unui bon pe
    care managerul l-a redus deja ar fi respinsa la orice editare a worker-ului."""
    db, acc, item, receipt = await _fixture()
    await add_line(db, receipt, "Ulei 5W30", "70.00", item_id=item.id)  # sub catalog, fara flag
    await _assert_may_change_prices(
        db, acc.id, receipt.id,
        [Line("Ulei 5W30", "70.00", qty=2, item_id=item.id)],
        WORKER,
    )


# ─── 3. Bon nou (receipt_id=None) ─────────────────────────────────────────────

async def test_new_receipt_cannot_start_discounted():
    db, acc, item, _ = await _fixture()
    await raises_http(403, _assert_may_change_prices(
        db, acc.id, None,
        [Line("Ulei 5W30", "80.00", original_price="100.00", item_id=item.id)],
        WORKER,
    ))


async def test_new_receipt_cannot_start_below_catalog():
    db, acc, item, _ = await _fixture()
    await raises_http(403, _assert_may_change_prices(
        db, acc.id, None, [Line("Ulei 5W30", "10.00", item_id=item.id)], WORKER,
    ))


# ─── 4. Rolurile privilegiate trec neatinse ───────────────────────────────────

async def test_manager_and_admin_are_unrestricted():
    db, acc, item, receipt = await _fixture()
    await add_line(db, receipt, "Ulei 5W30", "100.00", item_id=item.id)
    payload = [Line("Ulei 5W30", "10.00", original_price="100.00", item_id=item.id)]
    for ctx in (MANAGER, ADMIN):
        await _assert_may_change_prices(db, acc.id, receipt.id, payload, ctx)


TESTS = [v for k, v in sorted(globals().items()) if k.startswith("test_")]

if __name__ == "__main__":
    for t in TESTS:
        run(t())
    print(f"OK — {len(TESTS)} scenarii de pret/reducere trecute.")
