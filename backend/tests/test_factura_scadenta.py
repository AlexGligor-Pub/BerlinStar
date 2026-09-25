"""Scadența facturii, stabilită la alocarea numărului.

PDF-ul scrie „Data scadenta" doar dacă bonul are `due_date`; până acum îl
completa numai Factura Rapidă, deci facturile din Recepție ieșeau fără scadență,
deși XML-ul trimis la ANAF avea una (data bonului + termenul de plată din
Configurări › eFactura). Regula e acum aceeași în ambele locuri.

Rulabil cu pytest sau direct:  python -m tests.test_factura_scadenta
"""
from __future__ import annotations

from datetime import date, timedelta

from app.models.company import Company
from app.models.location import Location
from app.models.register import Register
# `app.efactura.models` se importă abia după `app.models`: invers, importurile
# se încolăcesc (app.models.__init__ îl încarcă la rândul lui).
from app.efactura.models import AnafSettings
from app.routers.receipts import assign_number
from app.schemas.receipt import AssignNumberRequest
from tests._harness import make_account, make_receipt, make_session, run

TERMEN_FIRMA = 15


async def _fixture(db, *, termen: int | None = TERMEN_FIRMA):
    acc = await make_account(db)
    company = Company(account_id=acc.id, name="Firma Test", cui=123456)
    register = Register(
        account_id=acc.id, name="Registru", factura_serie="FT", factura_numar=100,
        deviz_serie="DV", deviz_numar=0, chitanta_serie="CH", chitanta_numar=0,
    )
    db.add_all([company, register])
    await db.flush()
    location = Location(
        account_id=acc.id, name="Punct lucru", company_id=company.id, register_id=register.id,
    )
    db.add(location)
    await db.flush()
    if termen is not None:
        db.add(AnafSettings(company_id=company.id, payment_terms_days=termen))
    await db.commit()
    return acc, location


async def test_the_invoice_number_sets_the_due_date_from_the_company_settings():
    db = await make_session()
    acc, location = await _fixture(db)
    receipt = await make_receipt(db, acc, location_id=location.id)
    await db.commit()
    emitere = receipt.created_at.date()

    await assign_number(
        receipt.id, AssignNumberRequest(doc_type="factura", location_id=location.id), db, acc.id,
    )

    await db.refresh(receipt)
    assert receipt.due_date == emitere + timedelta(days=TERMEN_FIRMA), receipt.due_date


async def test_without_anaf_settings_the_default_term_applies():
    """Facturarea nu se oprește fiindcă eFactura nu e configurată."""
    db = await make_session()
    acc, location = await _fixture(db, termen=None)
    receipt = await make_receipt(db, acc, location_id=location.id)
    await db.commit()
    emitere = receipt.created_at.date()

    await assign_number(
        receipt.id, AssignNumberRequest(doc_type="factura", location_id=location.id), db, acc.id,
    )

    await db.refresh(receipt)
    assert receipt.due_date == emitere + timedelta(days=30), receipt.due_date


async def test_an_existing_due_date_is_kept():
    """Factura Rapidă își trimite scadența din formular; nu se rescrie."""
    db = await make_session()
    acc, location = await _fixture(db)
    aleasa = date.today() + timedelta(days=3)
    receipt = await make_receipt(db, acc, location_id=location.id, due_date=aleasa)
    await db.commit()

    await assign_number(
        receipt.id, AssignNumberRequest(doc_type="factura", location_id=location.id), db, acc.id,
    )

    await db.refresh(receipt)
    assert receipt.due_date == aleasa, receipt.due_date


async def test_a_deviz_number_sets_no_due_date():
    db = await make_session()
    acc, location = await _fixture(db)
    receipt = await make_receipt(db, acc, location_id=location.id)
    await db.commit()

    await assign_number(
        receipt.id, AssignNumberRequest(doc_type="deviz", location_id=location.id), db, acc.id,
    )

    await db.refresh(receipt)
    assert receipt.due_date is None, receipt.due_date


TESTS = [v for k, v in sorted(globals().items()) if k.startswith("test_")]

if __name__ == "__main__":
    for t in TESTS:
        run(t())
    print(f"OK — {len(TESTS)} scenarii de scadență pe factură trecute.")
