"""Izolarea intre conturi in rutele e-Factura: compania emitenta si clientul
unui bon se iau doar din contul apelantului, iar /companies/{id}/... raspunde la
fel pentru o companie inexistenta si pentru una a altui cont.

Rulabil cu pytest sau direct:  python -m tests.test_izolare_router  (din backend/)
"""
from __future__ import annotations
from contextlib import contextmanager

import app.efactura.router as ef
from app.models.company import Company
from app.models.location import Location
from tests._harness import make_account, make_client, make_receipt, make_session, raises_http, run


async def _company(db, account, name: str, cui: int) -> Company:
    comp = Company(account_id=account.id, name=name, cui=cui)
    db.add(comp)
    await db.flush()
    return comp


async def _location(db, account, name: str, company_id: int | None = None) -> Location:
    loc = Location(account_id=account.id, name=name, company_id=company_id)
    db.add(loc)
    await db.flush()
    return loc


async def _fixture():
    db = await make_session()
    acc = await make_account(db)
    other = await make_account(db, username="alta", code="alta")
    comp = await _company(db, acc, "Firma SRL", 111)
    foreign_comp = await _company(db, other, "Straina SRL", 222)
    return db, acc, other, comp, foreign_comp


async def _reload(db) -> None:
    """Handlerele trebuie sa-si incarce singure randurile, ca in productie
    (relatiile `selectin` se populeaza la SELECT, nu din obiectele testului)."""
    await db.commit()
    db.expunge_all()


class _Payload:
    issues: list[str] = []


@contextmanager
def _patched(obj, **attrs):
    old = {k: getattr(obj, k) for k in attrs}
    for k, v in attrs.items():
        setattr(obj, k, v)
    try:
        yield
    finally:
        for k, v in old.items():
            setattr(obj, k, v)


def _capture(calls: list):
    """Inlocuitor pentru build_invoice_payload: retine compania si clientul primite."""
    def _fake(receipt, company, client, **_kw):
        calls.append((company, client))
        return _Payload()
    return _fake


# ─── _require_company_access ──────────────────────────────────────────────────

async def test_company_access_own_company_works():
    db, acc, _, comp, _ = await _fixture()
    got = await ef._require_company_access(db, comp.id, acc.id)
    assert got.id == comp.id


async def test_company_access_same_answer_for_foreign_missing_deleted():
    db, acc, _, comp, foreign_comp = await _fixture()
    foreign = await raises_http(404, ef._require_company_access(db, foreign_comp.id, acc.id))
    missing = await raises_http(404, ef._require_company_access(db, 99999, acc.id))
    comp.is_deleted = True
    await db.commit()
    deleted = await raises_http(404, ef._require_company_access(db, comp.id, acc.id))
    assert foreign == missing == deleted == "Compania nu exista."


async def test_company_access_platform_account_keeps_bypass():
    db, _, _, _, foreign_comp = await _fixture()
    platform = await make_account(db, username="admin", code="admin")
    got = await ef._require_company_access(db, foreign_comp.id, platform.id)
    assert got.id == foreign_comp.id
    await raises_http(404, ef._require_company_access(db, 99999, platform.id))


# ─── _resolve_supplier_company ────────────────────────────────────────────────

async def test_supplier_company_from_own_location():
    db, acc, _, _, _ = await _fixture()
    second = await _company(db, acc, "A doua SRL", 333)
    loc = await _location(db, acc, "Punct 2", company_id=second.id)
    receipt = await make_receipt(db, acc, location_id=loc.id)
    got = await ef._resolve_supplier_company(db, acc.id, receipt)
    assert got is not None and got.id == second.id


async def test_supplier_company_ignores_foreign_location():
    db, acc, other, comp, foreign_comp = await _fixture()
    foreign_loc = await _location(db, other, "Punct strain", company_id=foreign_comp.id)
    receipt = await make_receipt(db, acc, location_id=foreign_loc.id)
    got = await ef._resolve_supplier_company(db, acc.id, receipt)
    assert got is not None and got.id == comp.id


async def test_supplier_company_ignores_foreign_company_on_own_location():
    db, acc, _, comp, foreign_comp = await _fixture()
    loc = await _location(db, acc, "Punct", company_id=foreign_comp.id)
    receipt = await make_receipt(db, acc, location_id=loc.id)
    got = await ef._resolve_supplier_company(db, acc.id, receipt)
    assert got is not None and got.id == comp.id


async def test_supplier_company_never_falls_back_to_another_account():
    db = await make_session()
    acc = await make_account(db)
    other = await make_account(db, username="alta", code="alta")
    foreign_comp = await _company(db, other, "Straina SRL", 222)
    loc = await _location(db, acc, "Punct", company_id=foreign_comp.id)
    receipt = await make_receipt(db, acc, location_id=loc.id)
    assert await ef._resolve_supplier_company(db, acc.id, receipt) is None


# ─── validate / xml / audit: clientul bonului ─────────────────────────────────

async def test_validate_does_not_use_foreign_client_or_company():
    db, acc, other, comp, foreign_comp = await _fixture()
    foreign_client = await make_client(db, other, "Client Strain")
    foreign_loc = await _location(db, other, "Punct strain", company_id=foreign_comp.id)
    receipt = await make_receipt(db, acc, client_id=foreign_client.id, location_id=foreign_loc.id)
    await _reload(db)
    calls: list = []
    with _patched(ef, build_invoice_payload=_capture(calls)):
        res = await ef.validate_receipt(receipt_id=receipt.id, account_id=acc.id, db=db)
    assert res.is_valid is True
    (company, client), = calls
    assert company.id == comp.id and client is None


async def test_validate_uses_own_client_even_if_deleted_meanwhile():
    db, acc, _, comp, _ = await _fixture()
    own = await make_client(db, acc, "Client Propriu")
    receipt = await make_receipt(db, acc, client_id=own.id)
    await _reload(db)
    calls: list = []
    with _patched(ef, build_invoice_payload=_capture(calls)):
        await ef.validate_receipt(receipt_id=receipt.id, account_id=acc.id, db=db)
    (company, client), = calls
    assert company.id == comp.id and client is not None and client.id == own.id

    # Bon vechi, cu clientul sters intre timp: factura lui trebuie sa mearga in continuare.
    client.is_deleted = True
    await _reload(db)
    calls.clear()
    with _patched(ef, build_invoice_payload=_capture(calls)):
        await ef.validate_receipt(receipt_id=receipt.id, account_id=acc.id, db=db)
    assert calls[0][1] is not None and calls[0][1].id == own.id


async def test_validate_foreign_receipt_is_404():
    db, acc, other, _, _ = await _fixture()
    foreign_receipt = await make_receipt(db, other)
    await _reload(db)
    await raises_http(404, ef.validate_receipt(receipt_id=foreign_receipt.id, account_id=acc.id, db=db))


async def test_xml_preview_does_not_use_foreign_client_or_company():
    db, acc, other, comp, foreign_comp = await _fixture()
    foreign_client = await make_client(db, other, "Client Strain")
    own = await make_client(db, acc, "Client Propriu")
    loc = await _location(db, acc, "Punct", company_id=foreign_comp.id)
    polluted = await make_receipt(db, acc, client_id=foreign_client.id, location_id=loc.id)
    clean = await make_receipt(db, acc, client_id=own.id)
    await _reload(db)
    calls: list = []
    with _patched(
        ef,
        build_invoice_payload=_capture(calls),
        build_xml=lambda payload: "<Invoice/>",
        pretty_print=lambda xml: xml,
    ):
        await ef.preview_receipt_xml(receipt_id=polluted.id, account_id=acc.id, db=db)
        await ef.preview_receipt_xml(receipt_id=clean.id, account_id=acc.id, db=db)
    (company1, client1), (company2, client2) = calls
    assert company1.id == comp.id and client1 is None
    assert company2.id == comp.id and client2 is not None and client2.id == own.id


async def test_audit_reports_foreign_client_as_missing():
    db, acc, other, comp, _ = await _fixture()
    foreign_client = await make_client(db, other, "Client Strain")
    own = await make_client(db, acc, "Client Propriu")
    polluted = await make_receipt(db, acc, client_id=foreign_client.id, factura_serie="F", factura_nr=1)
    clean = await make_receipt(db, acc, client_id=own.id, factura_serie="F", factura_nr=2)
    await _reload(db)
    calls: list = []
    with _patched(ef, build_invoice_payload=_capture(calls)):
        out = await ef.audit_mapping(company_id=comp.id, account_id=acc.id, limit=50, db=db)
    assert all(client is None or client.id == own.id for _, client in calls)
    by_id = {e.receipt_id: e.issues for e in out}
    assert "Client lipseste pe factura." in by_id[polluted.id]
    assert "Client lipseste pe factura." not in by_id[clean.id]


# ─── upload / retry ───────────────────────────────────────────────────────────

async def test_upload_and_retry_reject_foreign_client_before_anything_is_sent():
    db, acc, other, _, _ = await _fixture()
    foreign_client = await make_client(db, other, "Client Strain")
    receipt = await make_receipt(db, acc, client_id=foreign_client.id, factura_serie="F", factura_nr=1)
    await _reload(db)
    sent: list = []

    async def _mark(_db, _receipt):
        sent.append(_receipt.id)

    with _patched(ef.efactura_service, mark_pending_upload=_mark):
        await raises_http(400, ef.upload_receipt(receipt_id=receipt.id, account_id=acc.id, db=db))
        await raises_http(400, ef.retry_receipt(receipt_id=receipt.id, account_id=acc.id, db=db))
    assert sent == []


async def test_retry_with_own_client_still_works():
    db, acc, _, _, _ = await _fixture()
    own = await make_client(db, acc, "Client Propriu")
    receipt = await make_receipt(db, acc, client_id=own.id, factura_serie="F", factura_nr=1)
    no_client = await make_receipt(db, acc, factura_serie="F", factura_nr=2)
    await _reload(db)
    sent: list = []

    async def _mark(_db, _receipt):
        sent.append(_receipt.id)
        return "rec"

    class _Broadcaster:
        def notify(self, _account_id) -> None:
            pass

    with _patched(ef.efactura_service, mark_pending_upload=_mark, upload_to_anaf_async=lambda *_a: None), \
            _patched(ef, _spawn_bg=lambda _coro: None, broadcaster=_Broadcaster()):
        assert await ef.retry_receipt(receipt_id=receipt.id, account_id=acc.id, db=db) == "rec"
        # Fara client: /retry nu cerea client nici inainte; comportamentul ramane.
        assert await ef.retry_receipt(receipt_id=no_client.id, account_id=acc.id, db=db) == "rec"
    assert sent == [receipt.id, no_client.id]


TESTS = [v for k, v in sorted(globals().items()) if k.startswith("test_")]

if __name__ == "__main__":
    for t in TESTS:
        run(t())
    print(f"OK — {len(TESTS)} scenarii de izolare e-Factura trecute.")
