"""TVA-ul, totalul si data emiterii din XML-ul e-Factura (mapping.build_invoice_payload).

Pretul unei linii fara vat_percent (POS/receptie) contine deja TVA-ul firmei, iar
PDF-ul il extrage din pret. XML-ul il adauga peste: un bon de 119 lei pleca la ANAF
cu baza 119, TVA 22.61, total 141.61. Aici fixam regula: totalul din XML este cel
incasat, pentru fiecare fel de bon, iar o diferenta opreste trimiterea.

Functii pure, fara baza de date: bonul, firma si clientul sunt obiecte simple.

Rulabil cu pytest sau direct:  python -m tests.test_efactura_mapping_tva
"""
from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from types import SimpleNamespace

from tests._harness import run
from app.efactura.exceptions import AnafValidationError
from app.efactura.mapping import (
    ALLOWED_VAT_PERCENTS,
    _calculate_due_date,
    build_invoice_payload,
    invoice_issue_date,
    local_date,
    today_local,
)
from app.efactura.xml_builder import build_xml
from app.models.receipt import PayMethod

D = Decimal


def _company(*, is_vat_payer=True, tva=21):
    return SimpleNamespace(
        id=1, cui=12345678, name="Firma Test SRL", nr_reg_com="J35/1/2020",
        street="Str. Glad 60", city="Timisoara", county_code="RO-TM", postal_code=None,
        country_code="RO", address=None, phone=None, email=None,
        iban=None, bank_name=None,
        is_vat_payer=is_vat_payer, tva_percentage=(D(str(tva)) if tva is not None else None),
    )


def _client():
    return SimpleNamespace(
        nume="Client SRL", cui="87654321", tip="juridic",
        street="Str. Lunga 1", city="Arad", county_code="RO-AR", postal_code=None,
        country_code="RO", adresa=None, telefon=None, email=None,
    )


def _line(name, price, qty=1, vat=None):
    return SimpleNamespace(
        name=name, price=D(str(price)), qty=qty, unit="buc", unit_code=None,
        vat_category="S", vat_percent=(D(str(vat)) if vat is not None else None),
        tax_exemption_reason=None, item_id=None,
    )


def _receipt(lines, total, *, created_at=None, **kw):
    fields = dict(
        id=7, factura_serie="FT", factura_nr=101,
        created_at=created_at or datetime.now(timezone.utc),
        receipt_items=lines, total=D(str(total)),
        pay_method=PayMethod.CASH, partial_pay=None, due_date=None,
        titlu="Bon test", descriere=None, invoice_type_code="380", currency="RON",
    )
    fields.update(kw)
    return SimpleNamespace(**fields)


def _assert_consistent(p):
    """Regulile EN16931 pe care ANAF le verifica la totaluri."""
    assert sum((ln.line_extension_amount for ln in p.lines), D("0")) == p.line_extension_total  # BR-CO-10
    assert p.tax_exclusive_total == p.line_extension_total - p.allowance_total              # BR-CO-13
    assert sum((s.tax_amount for s in p.tax_subtotals), D("0")) == p.tax_total              # BR-CO-14
    assert p.tax_inclusive_total == p.tax_exclusive_total + p.tax_total                     # BR-CO-15
    assert sum((s.taxable_amount for s in p.tax_subtotals), D("0")) == p.tax_exclusive_total
    for s in p.tax_subtotals:
        # BR-CO-17: TVA-ul cotei = baza x cota, cu cel mult un ban din rotunjire.
        exact = (s.taxable_amount * s.vat_percent / 100).quantize(D("0.01"))
        assert abs(s.tax_amount - exact) <= D("0.01"), (s.tax_amount, exact)
    for ln in p.lines:
        assert ln.line_extension_amount >= 0 and ln.unit_price >= 0


def _xml_amount(xml: str, tag: str) -> str:
    return re.search(rf"<cbc:{tag}[^>]*>([^<]+)</cbc:{tag}>", xml).group(1)


# ---------- preturi brute (POS / receptie) ----------

async def test_pos_gross_price_at_19_is_split_into_net_and_vat():
    """Cazul din raport: 119 lei cu TVA inclus nu mai devine 141.61."""
    p = build_invoice_payload(_receipt([_line("Manopera", "119.00")], "119.00"), _company(tva=19), _client())
    assert p.lines[0].line_extension_amount == D("100.00")
    assert p.lines[0].unit_price == D("100.00")
    assert p.tax_exclusive_total == D("100.00")
    assert p.tax_total == D("19.00")
    assert p.tax_inclusive_total == D("119.00")
    assert p.payable_amount == D("119.00")
    assert p.issues == [], p.issues
    _assert_consistent(p)


async def test_pos_gross_price_at_21_gives_the_receipt_total_in_the_xml():
    p = build_invoice_payload(_receipt([_line("Anvelopa", "121.00", qty=2)], "242.00"), _company(tva=21), _client())
    assert (p.tax_exclusive_total, p.tax_total, p.tax_inclusive_total) == (D("200.00"), D("42.00"), D("242.00"))
    assert p.tax_subtotals[0].vat_percent == D("21.00")
    xml = build_xml(p)
    assert _xml_amount(xml, "TaxInclusiveAmount") == "242.00"
    assert _xml_amount(xml, "PayableAmount") == "242.00"
    assert _xml_amount(xml, "TaxExclusiveAmount") == "200.00"
    assert "<cbc:Percent>21.00</cbc:Percent>" in xml


async def test_pos_receipt_with_a_gross_line_and_a_21_percent_line():
    """O linie bruta la cota firmei (19) si una cu cota proprie 21 (pret net)."""
    lines = [_line("Manopera", "119.00"), _line("Piesa", "100.00", vat=21)]
    p = build_invoice_payload(_receipt(lines, "240.00"), _company(tva=19), _client())
    by_rate = {s.vat_percent: s for s in p.tax_subtotals}
    assert (by_rate[D("19.00")].taxable_amount, by_rate[D("19.00")].tax_amount) == (D("100.00"), D("19.00"))
    assert (by_rate[D("21.00")].taxable_amount, by_rate[D("21.00")].tax_amount) == (D("100.00"), D("21.00"))
    assert p.tax_inclusive_total == D("240.00")
    _assert_consistent(p)


async def test_gross_totals_always_match_the_receipt_whatever_the_rounding():
    """Sume care nu se impart frumos: totalul ramane cel incasat, la ban."""
    for tva in (19, 21, 11, 9):
        for prices in (["100.00"], ["0.03"], ["33.33", "33.33", "33.34"], ["9.99"] * 7, ["1.00", "250.50", "17.25"]):
            total = sum((D(x) for x in prices), D("0"))
            lines = [_line(f"Articol {i}", x) for i, x in enumerate(prices)]
            p = build_invoice_payload(_receipt(lines, total), _company(tva=tva), _client())
            assert p.tax_inclusive_total == total, (tva, prices, p.tax_inclusive_total)
            # Baza cotei este cea extrasa din totalul brut, ca pe PDF.
            assert p.tax_exclusive_total == (total / (1 + D(tva) / 100)).quantize(D("0.01")), (tva, prices)
            _assert_consistent(p)


async def test_pos_discount_line_is_a_net_allowance_and_the_total_still_matches():
    """Reducerea din POS (linie negativa) e si ea cu TVA inclus."""
    lines = [_line("Anvelopa", "242.00"), _line("Reducere fidelitate", "-24.20")]
    p = build_invoice_payload(_receipt(lines, "217.80"), _company(tva=21), _client())
    assert p.allowances[0].amount == D("20.00")
    assert p.allowance_total == D("20.00")
    assert p.line_extension_total == D("200.00")
    assert (p.tax_exclusive_total, p.tax_total, p.tax_inclusive_total) == (D("180.00"), D("37.80"), D("217.80"))
    _assert_consistent(p)


async def test_advance_payment_is_deducted_from_the_matching_total():
    p = build_invoice_payload(
        _receipt([_line("Manopera", "119.00")], "119.00", pay_method=PayMethod.PARTIAL, partial_pay=D("19.00")),
        _company(tva=19), _client(),
    )
    assert p.tax_inclusive_total == D("119.00")
    assert p.payable_amount == D("100.00")


# ---------- ce NU se schimba ----------

async def test_quick_invoice_net_prices_are_unchanged():
    """Factura Rapida: pret net pe linie, TVA adaugat — ca pana acum."""
    lines = [_line("Servicii", "100.00", qty=2, vat=21), _line("Carte", "50.00", vat=11)]
    p = build_invoice_payload(_receipt(lines, "297.50"), _company(tva=21), _client())
    assert [ln.line_extension_amount for ln in p.lines] == [D("200.00"), D("50.00")]
    assert [ln.unit_price for ln in p.lines] == [D("100.00"), D("50.00")]
    by_rate = {s.vat_percent: s for s in p.tax_subtotals}
    assert by_rate[D("21.00")].tax_amount == D("42.00")
    assert by_rate[D("11.00")].tax_amount == D("5.50")
    assert (p.tax_exclusive_total, p.tax_total, p.tax_inclusive_total) == (D("250.00"), D("47.50"), D("297.50"))
    assert p.issues == [], p.issues
    _assert_consistent(p)


async def test_non_vat_payer_is_unchanged():
    """Neplatitor: categorie O, fara TVA, totalul = suma liniilor — chiar daca firma are o cota trecuta."""
    lines = [_line("Manopera", "119.00"), _line("Reducere", "-19.00")]
    p = build_invoice_payload(_receipt(lines, "100.00"), _company(is_vat_payer=False, tva=21), _client())
    assert p.lines[0].line_extension_amount == D("119.00")
    assert p.lines[0].unit_price == D("119.00")
    assert p.lines[0].vat_category == "O"
    assert p.allowances[0].amount == D("19.00")
    assert (p.tax_exclusive_total, p.tax_total, p.tax_inclusive_total) == (D("100.00"), D("0.00"), D("100.00"))
    assert p.tax_subtotals[0].tax_exemption_reason_code == "VATEX-EU-O"
    assert p.issues == [], p.issues


async def test_vat_payer_without_a_rate_keeps_gross_as_net():
    """Firma platitoare fara cota configurata: cota 0, nimic de extras (comportament vechi)."""
    p = build_invoice_payload(
        _receipt([_line("Manopera", "119.00")], "119.00"), _company(tva=None), _client(), raise_on_error=False,
    )
    assert (p.tax_exclusive_total, p.tax_total, p.tax_inclusive_total) == (D("119.00"), D("0.00"), D("119.00"))


# ---------- plasa de siguranta ----------

async def test_total_mismatch_stops_the_upload():
    """Linii nete (cota proprie) pe un bon al carui total e doar suma preturilor."""
    receipt = _receipt([_line("Piesa", "100.00", vat=19)], "100.00")
    try:
        build_invoice_payload(receipt, _company(tva=19), _client())
    except AnafValidationError as exc:
        assert any("difera de totalul bonului" in m for m in exc.issues), exc.issues
    else:
        raise AssertionError("o factura cu alt total decat bonul nu trebuie sa treaca de validare")
    # Fara raise (ecranul de audit) aceeasi problema apare in lista.
    p = build_invoice_payload(receipt, _company(tva=19), _client(), raise_on_error=False)
    assert any("difera de totalul bonului" in m for m in p.issues), p.issues


async def test_two_cents_of_rounding_are_tolerated():
    p = build_invoice_payload(_receipt([_line("Piesa", "100.00", vat=19)], "119.02"), _company(tva=19), _client())
    assert p.tax_inclusive_total == D("119.00")
    assert p.issues == [], p.issues


# ---------- cote ----------

async def test_rates_21_and_11_are_accepted_and_unknown_rates_are_not():
    assert {D("11"), D("21")} <= ALLOWED_VAT_PERCENTS
    assert {D("0"), D("5"), D("9"), D("19")} <= ALLOWED_VAT_PERCENTS
    for cota, total in ((21, "121.00"), (11, "111.00")):
        p = build_invoice_payload(_receipt([_line("Articol", "100.00", vat=cota)], total), _company(), _client())
        assert p.tax_total == D(total) - D("100.00")
        assert p.lines[0].vat_category == "S"
    try:
        build_invoice_payload(_receipt([_line("Articol", "100.00", vat=24)], "124.00"), _company(), _client())
    except AnafValidationError as exc:
        assert any("vat_percent 24.00 (permise: 0/5/9/11/19/21)" in m for m in exc.issues), exc.issues
    else:
        raise AssertionError("cota 24% nu e in lista permisa")


# ---------- data emiterii ----------

async def test_issue_date_is_the_bucharest_day_not_the_utc_day():
    """23:30 UTC este deja a doua zi in Romania, vara (UTC+3) si iarna (UTC+2)."""
    assert local_date(datetime(2026, 7, 14, 23, 30, tzinfo=timezone.utc)).isoformat() == "2026-07-15"
    assert local_date(datetime(2026, 1, 14, 23, 30, tzinfo=timezone.utc)).isoformat() == "2026-01-15"
    assert local_date(datetime(2026, 7, 14, 12, 0, tzinfo=timezone.utc)).isoformat() == "2026-07-14"
    # SQLite (si orice datetime fara fus) = UTC.
    assert local_date(datetime(2026, 7, 14, 23, 30)).isoformat() == "2026-07-15"


async def test_payload_issue_date_due_date_and_age_use_the_local_day():
    ieri_seara = (datetime.now(timezone.utc) - timedelta(days=1)).replace(hour=23, minute=30, second=0, microsecond=0)
    receipt = _receipt([_line("Manopera", "119.00")], "119.00", created_at=ieri_seara)
    emitere = ieri_seara.date() + timedelta(days=1)
    assert invoice_issue_date(receipt) == emitere
    p = build_invoice_payload(receipt, _company(tva=19), _client(), payment_terms_days=15)
    assert p.issue_date == emitere
    assert p.due_date == emitere + timedelta(days=15)
    assert _calculate_due_date(receipt, 15) == emitere + timedelta(days=15)
    assert f"<cbc:IssueDate>{emitere.isoformat()}</cbc:IssueDate>" in build_xml(p)


async def test_the_60_day_limit_is_counted_in_local_days():
    veche = datetime.now(timezone.utc) - timedelta(days=62)
    p = build_invoice_payload(
        _receipt([_line("Manopera", "119.00")], "119.00", created_at=veche), _company(tva=19), _client(),
        raise_on_error=False,
    )
    asteptat = (today_local() - local_date(veche)).days
    assert any(f"mai veche de 60 zile ({asteptat} zile)" in m for m in p.issues), p.issues


TESTS = [v for k, v in sorted(globals().items()) if k.startswith("test_")]

if __name__ == "__main__":
    for t in TESTS:
        run(t())
    print(f"OK — {len(TESTS)} scenarii TVA / total / data emiterii e-Factura trecute.")
