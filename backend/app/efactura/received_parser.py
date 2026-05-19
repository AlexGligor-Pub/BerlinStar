"""Parser pentru facturi primite din SPV (UBL 2.1 / CIUS-RO).

ANAF returneaza un ZIP cu factura XML + semnatura XML. Extragem doar XML-ul
de factura (root Invoice sau CreditNote) si parsam campurile relevante pentru
afisare in modal: parti, linii, TVA, totaluri, IBAN, scadenta.
"""
from __future__ import annotations

import zipfile
from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation
from io import BytesIO
from typing import Any

from lxml import etree


NS = {
    "inv": "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2",
    "cn": "urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2",
    "cac": "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2",
    "cbc": "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2",
}


class UBLParseError(Exception):
    """XML-ul nu este un UBL Invoice/CreditNote valid."""


def extract_invoice_xml_from_zip(zip_bytes: bytes) -> bytes:
    """Returneaza primul XML din ZIP care este Invoice sau CreditNote.

    ANAF impacheteaza factura + un fisier semnatura (xades). Ignoram semnatura
    si orice alt continut non-UBL.
    """
    try:
        zf = zipfile.ZipFile(BytesIO(zip_bytes))
    except zipfile.BadZipFile as exc:
        raise UBLParseError(f"Fisier ZIP invalid de la ANAF: {exc}") from exc

    candidates: list[tuple[str, bytes]] = []
    for name in zf.namelist():
        lname = name.lower()
        if not lname.endswith(".xml"):
            continue
        if "semnatura" in lname or "signature" in lname:
            continue
        try:
            content = zf.read(name)
        except KeyError:
            continue
        candidates.append((name, content))

    for _name, content in candidates:
        try:
            root = etree.fromstring(content)
        except etree.XMLSyntaxError:
            continue
        local = etree.QName(root).localname
        if local in ("Invoice", "CreditNote"):
            return content

    if candidates:
        return candidates[0][1]
    raise UBLParseError("Nu am gasit XML de factura in ZIP-ul ANAF.")


def _text(el: etree._Element | None, xpath: str) -> str | None:
    if el is None:
        return None
    found = el.xpath(xpath, namespaces=NS)
    if not found:
        return None
    node = found[0]
    if isinstance(node, str):
        return node.strip() or None
    val = (node.text or "").strip()
    return val or None


def _dec(el: etree._Element | None, xpath: str) -> Decimal | None:
    raw = _text(el, xpath)
    if raw is None:
        return None
    try:
        return Decimal(raw)
    except (InvalidOperation, ValueError):
        return None


def _attr(el: etree._Element | None, xpath: str, attr: str) -> str | None:
    if el is None:
        return None
    found = el.xpath(xpath, namespaces=NS)
    if not found:
        return None
    node = found[0]
    if hasattr(node, "get"):
        v = node.get(attr)
        return (v or "").strip() or None
    return None


@dataclass
class PartyInfo:
    name: str | None = None
    cui: str | None = None
    registration_id: str | None = None
    address_line: str | None = None
    city: str | None = None
    country_subentity: str | None = None
    country_code: str | None = None
    contact_email: str | None = None
    contact_phone: str | None = None


@dataclass
class InvoiceLineOut:
    line_id: str | None = None
    description: str | None = None
    quantity: Decimal | None = None
    unit_code: str | None = None
    unit_price: Decimal | None = None
    line_net: Decimal | None = None
    vat_percent: Decimal | None = None
    vat_category: str | None = None


@dataclass
class TaxSubtotalOut:
    taxable_amount: Decimal | None = None
    tax_amount: Decimal | None = None
    percent: Decimal | None = None
    category: str | None = None


@dataclass
class InvoiceDetailsOut:
    doc_type: str = "Invoice"
    invoice_number: str | None = None
    issue_date: str | None = None
    due_date: str | None = None
    currency: str | None = None
    invoice_type_code: str | None = None
    note: str | None = None
    supplier: PartyInfo = field(default_factory=PartyInfo)
    customer: PartyInfo = field(default_factory=PartyInfo)
    payment_iban: str | None = None
    payment_bank: str | None = None
    payment_terms: str | None = None
    lines: list[InvoiceLineOut] = field(default_factory=list)
    tax_breakdown: list[TaxSubtotalOut] = field(default_factory=list)
    total_without_vat: Decimal | None = None
    total_vat: Decimal | None = None
    total_with_vat: Decimal | None = None
    payable_amount: Decimal | None = None
    prepaid_amount: Decimal | None = None

    def to_dict(self) -> dict[str, Any]:
        def _conv(v: Any) -> Any:
            if isinstance(v, Decimal):
                return str(v)
            if isinstance(v, list):
                return [_conv(x) for x in v]
            if hasattr(v, "__dataclass_fields__"):
                return {k: _conv(getattr(v, k)) for k in v.__dataclass_fields__}
            return v

        return _conv(self)


def _parse_party(party_el: etree._Element | None) -> PartyInfo:
    if party_el is None:
        return PartyInfo()
    info = PartyInfo()
    info.name = _text(party_el, "cac:PartyLegalEntity/cbc:RegistrationName") or _text(
        party_el, "cac:PartyName/cbc:Name"
    )
    info.cui = _text(party_el, "cac:PartyTaxScheme/cbc:CompanyID") or _text(
        party_el, "cac:PartyLegalEntity/cbc:CompanyID"
    )
    info.registration_id = _text(party_el, "cac:PartyLegalEntity/cbc:CompanyID")
    info.address_line = _text(party_el, "cac:PostalAddress/cbc:StreetName")
    extra = _text(party_el, "cac:PostalAddress/cbc:AdditionalStreetName")
    if extra:
        info.address_line = (info.address_line + ", " + extra) if info.address_line else extra
    info.city = _text(party_el, "cac:PostalAddress/cbc:CityName")
    info.country_subentity = _text(party_el, "cac:PostalAddress/cbc:CountrySubentity")
    info.country_code = _text(party_el, "cac:PostalAddress/cac:Country/cbc:IdentificationCode")
    info.contact_email = _text(party_el, "cac:Contact/cbc:ElectronicMail")
    info.contact_phone = _text(party_el, "cac:Contact/cbc:Telephone")
    return info


def parse_ubl_invoice(xml_bytes: bytes) -> InvoiceDetailsOut:
    """Parseaza un UBL Invoice/CreditNote si returneaza un model plat pentru UI."""
    try:
        root = etree.fromstring(xml_bytes)
    except etree.XMLSyntaxError as exc:
        raise UBLParseError(f"XML invalid: {exc}") from exc

    local = etree.QName(root).localname
    if local not in ("Invoice", "CreditNote"):
        raise UBLParseError(f"Root XML necunoscut: {local}")

    out = InvoiceDetailsOut(doc_type=local)

    out.invoice_number = _text(root, "cbc:ID")
    out.issue_date = _text(root, "cbc:IssueDate")
    out.due_date = _text(root, "cbc:DueDate")
    out.currency = _text(root, "cbc:DocumentCurrencyCode")
    out.invoice_type_code = _text(root, "cbc:InvoiceTypeCode") or _text(root, "cbc:CreditNoteTypeCode")
    out.note = _text(root, "cbc:Note")

    supplier_party = root.xpath("cac:AccountingSupplierParty/cac:Party", namespaces=NS)
    customer_party = root.xpath("cac:AccountingCustomerParty/cac:Party", namespaces=NS)
    out.supplier = _parse_party(supplier_party[0] if supplier_party else None)
    out.customer = _parse_party(customer_party[0] if customer_party else None)

    out.payment_iban = _text(root, "cac:PaymentMeans/cac:PayeeFinancialAccount/cbc:ID")
    out.payment_bank = _text(
        root, "cac:PaymentMeans/cac:PayeeFinancialAccount/cac:FinancialInstitutionBranch/cbc:Name"
    )
    out.payment_terms = _text(root, "cac:PaymentTerms/cbc:Note")

    # Linii
    line_tag = "cac:InvoiceLine" if local == "Invoice" else "cac:CreditNoteLine"
    qty_tag = "cbc:InvoicedQuantity" if local == "Invoice" else "cbc:CreditedQuantity"
    for line_el in root.xpath(line_tag, namespaces=NS):
        line = InvoiceLineOut()
        line.line_id = _text(line_el, "cbc:ID")
        line.description = _text(line_el, "cac:Item/cbc:Name")
        line.quantity = _dec(line_el, qty_tag)
        line.unit_code = _attr(line_el, qty_tag, "unitCode")
        line.unit_price = _dec(line_el, "cac:Price/cbc:PriceAmount")
        line.line_net = _dec(line_el, "cbc:LineExtensionAmount")
        line.vat_percent = _dec(line_el, "cac:Item/cac:ClassifiedTaxCategory/cbc:Percent")
        line.vat_category = _text(line_el, "cac:Item/cac:ClassifiedTaxCategory/cbc:ID")
        out.lines.append(line)

    # Breakdown TVA (TaxTotal/TaxSubtotal)
    for sub_el in root.xpath("cac:TaxTotal/cac:TaxSubtotal", namespaces=NS):
        sub = TaxSubtotalOut()
        sub.taxable_amount = _dec(sub_el, "cbc:TaxableAmount")
        sub.tax_amount = _dec(sub_el, "cbc:TaxAmount")
        sub.percent = _dec(sub_el, "cac:TaxCategory/cbc:Percent")
        sub.category = _text(sub_el, "cac:TaxCategory/cbc:ID")
        out.tax_breakdown.append(sub)

    out.total_without_vat = _dec(root, "cac:LegalMonetaryTotal/cbc:TaxExclusiveAmount")
    out.total_with_vat = _dec(root, "cac:LegalMonetaryTotal/cbc:TaxInclusiveAmount")
    out.payable_amount = _dec(root, "cac:LegalMonetaryTotal/cbc:PayableAmount")
    out.prepaid_amount = _dec(root, "cac:LegalMonetaryTotal/cbc:PrepaidAmount")

    total_tax = _dec(root, "cac:TaxTotal/cbc:TaxAmount")
    if total_tax is not None:
        out.total_vat = total_tax
    elif out.total_with_vat is not None and out.total_without_vat is not None:
        out.total_vat = out.total_with_vat - out.total_without_vat

    return out
