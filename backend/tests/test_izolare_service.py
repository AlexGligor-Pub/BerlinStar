"""Izolare intre conturi in serviciul eFactura: compania emitenta a unui bon se
rezolva doar din contul bonului, chiar daca locatia sau compania legata e straina.

Rulabil cu pytest sau direct:  python -m tests.test_izolare_service  (din backend/)
"""
from __future__ import annotations
from contextlib import contextmanager

from sqlalchemy import select

# Harness-ul importa `app.main`; fara el, `app.efactura.models` intra intr-un
# import circular cu `app.models`.
from tests._harness import make_account, make_client, make_receipt, make_session, run
import app.efactura.service as svc
from app.efactura.exceptions import AnafConfigError, AnafValidationError
from app.efactura.models import AnafSettings, EFacturaRecord
from app.efactura.service import (
    _resolve_company_for_receipt, get_or_create_record, mark_pending_upload, prepare_and_upload,
)
from app.models.company import Company
from app.models.location import Location
from app.models.receipt import Receipt


async def _company(db, acc, name: str, cui: int) -> Company:
    comp = Company(account_id=acc.id, name=name, cui=cui)
    db.add(comp)
    await db.flush()
    return comp


async def _location(db, acc, name: str, company: Company | None = None) -> Location:
    loc = Location(account_id=acc.id, name=name, company_id=company.id if company else None)
    db.add(loc)
    await db.flush()
    return loc


async def _fixture():
    db = await make_session()
    acc = await make_account(db)
    other = await make_account(db, username="alta", code="alta")
    own = await _company(db, acc, "Firma SRL", 111)
    own2 = await _company(db, acc, "Firma Doi SRL", 222)
    foreign = await _company(db, other, "Straina SRL", 999)
    return db, acc, other, own, own2, foreign


async def _records(db) -> list[EFacturaRecord]:
    return list((await db.execute(select(EFacturaRecord))).scalars().all())


async def test_own_location_company_is_used():
    db, acc, _, _, own2, _ = await _fixture()
    loc = await _location(db, acc, "Sediu", own2)
    receipt = await make_receipt(db, acc, location_id=loc.id)
    comp = await _resolve_company_for_receipt(db, receipt)
    assert comp is not None and comp.id == own2.id


async def test_without_location_falls_back_to_first_own_company():
    db, acc, _, own, *_ = await _fixture()
    receipt = await make_receipt(db, acc)
    comp = await _resolve_company_for_receipt(db, receipt)
    assert comp is not None and comp.id == own.id


async def test_foreign_location_is_ignored():
    db, acc, other, own, _, foreign = await _fixture()
    foreign_loc = await _location(db, other, "Sediu strain", foreign)
    receipt = await make_receipt(db, acc, location_id=foreign_loc.id)
    comp = await _resolve_company_for_receipt(db, receipt)
    assert comp is not None and comp.id == own.id


async def test_own_location_with_foreign_company_is_ignored():
    db, acc, _, own, _, foreign = await _fixture()
    loc = await _location(db, acc, "Sediu", foreign)
    receipt = await make_receipt(db, acc, location_id=loc.id)
    comp = await _resolve_company_for_receipt(db, receipt)
    assert comp is not None and comp.id == own.id


async def test_missing_location_falls_back_like_foreign():
    db, acc, _, own, *_ = await _fixture()
    receipt = await make_receipt(db, acc, location_id=99999)
    comp = await _resolve_company_for_receipt(db, receipt)
    assert comp is not None and comp.id == own.id


async def test_deleted_own_location_company_still_resolves():
    # Comportament existent: bonurile vechi raman pe compania locatiei lor.
    db, acc, _, _, own2, _ = await _fixture()
    loc = await _location(db, acc, "Sediu", own2)
    loc.is_deleted = True
    own2.is_deleted = True
    await db.flush()
    receipt = await make_receipt(db, acc, location_id=loc.id)
    comp = await _resolve_company_for_receipt(db, receipt)
    assert comp is not None and comp.id == own2.id


async def test_mark_pending_upload_never_stores_foreign_company():
    db, acc, other, own, _, foreign = await _fixture()
    foreign_loc = await _location(db, other, "Sediu strain", foreign)
    receipt = await make_receipt(db, acc, location_id=foreign_loc.id)
    rec = await mark_pending_upload(db, receipt)
    assert (rec.company_id, rec.cui, rec.status) == (own.id, "111", "pending_upload")
    assert [r.company_id for r in await _records(db)] == [own.id]


async def test_mark_pending_upload_with_own_location_company():
    db, acc, _, _, own2, _ = await _fixture()
    loc = await _location(db, acc, "Sediu", own2)
    receipt = await make_receipt(db, acc, location_id=loc.id)
    rec = await mark_pending_upload(db, receipt)
    assert (rec.company_id, rec.cui) == (own2.id, "222")


async def test_account_without_company_gets_no_record():
    db, _, other, _, _, foreign = await _fixture()
    empty = await make_account(db, username="goala", code="goala")
    foreign_loc = await _location(db, other, "Sediu strain", foreign)
    receipt = await make_receipt(db, empty, location_id=foreign_loc.id)
    for call in (mark_pending_upload, prepare_and_upload):
        try:
            await call(db, receipt)
        except AnafConfigError:
            pass
        else:
            raise AssertionError("astept AnafConfigError, dar apelul a reusit")
    assert await _records(db) == []


async def test_legacy_record_on_foreign_company_is_realigned():
    db, acc, _, own, _, foreign = await _fixture()
    receipt = await make_receipt(db, acc)
    legacy = await get_or_create_record(db, receipt, foreign)
    assert legacy.company_id == foreign.id
    rec = await mark_pending_upload(db, receipt)
    assert rec.id == legacy.id
    assert (rec.company_id, rec.cui) == (own.id, "111")
    assert len(await _records(db)) == 1


async def test_existing_record_on_other_own_company_is_kept():
    db, acc, _, own, own2, _ = await _fixture()
    receipt = await make_receipt(db, acc)
    first = await get_or_create_record(db, receipt, own2)
    rec = await get_or_create_record(db, receipt, own)
    assert rec.id == first.id
    assert (rec.company_id, rec.cui) == (own2.id, "222")


# ─── prepare_and_upload: clientul bonului ─────────────────────────────────────

class _Payload:
    invoice_type_code = "380"
    invoice_number = "F1"


@contextmanager
def _anaf_stubs(clients: list, uploads: list):
    """Inlocuieste tot ce ar iesi din proces. `clients` retine clientul primit de
    build_invoice_payload, `uploads` XML-urile care ar fi plecat la ANAF."""
    def _build(receipt, company, client, **_kw):
        clients.append(client)
        if client is None:
            # Ca `_validate_customer` din mapping.
            raise AnafValidationError(["Clientul facturii lipseste."])
        return _Payload()

    async def _token(_db, _company_id):
        return "tok"

    class _Client:
        def __init__(self, access_token, cui, use_test=False):
            pass

        async def upload_invoice(self, xml, standard="UBL", extern=False):
            uploads.append(xml)
            return {"index_incarcare": 42, "data_creare": "202609011200"}

    patches = [
        (svc, "build_invoice_payload", _build),
        (svc, "build_xml", lambda payload: "<Invoice/>"),
        (svc, "AnafEFacturaClient", _Client),
        (svc.oauth_service, "get_valid_access_token", _token),
    ]
    old = [(obj, name, getattr(obj, name)) for obj, name, _ in patches]
    for obj, name, new in patches:
        setattr(obj, name, new)
    try:
        yield
    finally:
        for obj, name, orig in old:
            setattr(obj, name, orig)


async def _reloaded(db, receipt_id: int) -> Receipt:
    """Bonul incarcat ca in job-ul de upload: cu SELECT, ca `Receipt.client`
    (selectin) sa vina din baza, nu din obiectele testului."""
    await db.commit()
    db.expunge_all()
    return (await db.execute(select(Receipt).where(Receipt.id == receipt_id))).scalar_one()


async def test_prepare_and_upload_treats_foreign_client_as_missing():
    db, acc, other, own, _, _ = await _fixture()
    db.add(AnafSettings(company_id=own.id))
    foreign_client = await make_client(db, other, "Client Strain")
    created = await make_receipt(db, acc, client_id=foreign_client.id)
    receipt = await _reloaded(db, created.id)
    assert receipt.client is not None and receipt.client.account_id == other.id
    clients: list = []
    uploads: list = []
    with _anaf_stubs(clients, uploads):
        try:
            await prepare_and_upload(db, receipt, archive_xml=False)
        except AnafValidationError:
            pass
        else:
            raise AssertionError("astept AnafValidationError, dar apelul a reusit")
    assert clients == [None]
    assert uploads == []
    rec, = await _records(db)
    assert rec.status == "error"
    assert "Clientul facturii lipseste." in rec.anaf_error_message
    assert rec.index_incarcare is None and not rec.xml_content


async def test_prepare_and_upload_with_own_client_still_uploads():
    db, acc, _, own, _, _ = await _fixture()
    db.add(AnafSettings(company_id=own.id))
    client = await make_client(db, acc, "Client Propriu")
    # Clientul sters intre timp ramane valabil: factura lui trebuie sa plece.
    deleted_client = await make_client(db, acc, "Client Sters")
    deleted_client.is_deleted = True
    first = await make_receipt(db, acc, client_id=client.id)
    second = await make_receipt(db, acc, client_id=deleted_client.id)
    receipt_ids = [first.id, second.id]
    expected = [client.id, deleted_client.id]
    clients: list = []
    uploads: list = []
    with _anaf_stubs(clients, uploads):
        for receipt_id in receipt_ids:
            receipt = await _reloaded(db, receipt_id)
            rec = await prepare_and_upload(db, receipt, archive_xml=False)
            assert (rec.status, rec.index_incarcare, rec.company_id) == ("in_prelucrare", 42, own.id)
    assert [c.id for c in clients] == expected
    assert uploads == ["<Invoice/>", "<Invoice/>"]


TESTS = [v for k, v in sorted(globals().items()) if k.startswith("test_")]

if __name__ == "__main__":
    for t in TESTS:
        run(t())
    print(f"OK — {len(TESTS)} scenarii izolare serviciu eFactura trecute.")
