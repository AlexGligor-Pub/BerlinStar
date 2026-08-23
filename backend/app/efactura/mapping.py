"""Maparea Receipt (BerlinStar) -> InvoicePayload (UBL 2.1 friendly).

Toate validarile pre-upload trec prin acest modul. Generam un dataclass-style
Pydantic payload care apoi e dat catre xml_builder.py pentru randare XML.

Reguli de fallback:
- vat_percent per line -> daca lipseste, foloseste company.tva_percentage
- unit_code per line -> daca lipseste, mapeaza din `unit` text catre UNECE
- currency -> default RON
- DueDate -> created_at + anaf_settings.payment_terms_days
- adresa (street/city) -> daca lipseste, foloseste address text (best-effort)
"""
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field
from datetime import date, timedelta
from decimal import ROUND_HALF_UP, Decimal
from typing import Iterable

from app.efactura.exceptions import AnafValidationError
from app.models.client import Client
from app.models.company import Company
from app.models.receipt import PayMethod, Receipt, ReceiptItem


CIUS_RO_CUSTOMIZATION_ID = (
    "urn:cen.eu:en16931:2017#compliant#urn:efactura.mfinante.ro:CIUS-RO:1.0.1"
)

ALLOWED_VAT_CATEGORIES = {"S", "Z", "E", "O", "K", "G", "L", "M", "AE"}
ALLOWED_VAT_PERCENTS = {Decimal("0"), Decimal("5"), Decimal("9"), Decimal("19")}

# ISO 4461 / UNCL4461 payment means codes (PEPPOL)
PAY_METHOD_TO_CODE = {
    PayMethod.CASH: "10",       # cash in hand
    PayMethod.CARD: "48",       # bank card
    PayMethod.OP: "30",         # credit transfer
    PayMethod.NEPLATIT: "30",
    PayMethod.PARTIAL: "30",
}

# UNECE Recommendation 20 - common units
UNIT_TEXT_TO_CODE = {
    "buc": "C62", "buc.": "C62", "bucati": "C62", "bucăți": "C62", "pc": "C62",
    "kg": "KGM", "kilogram": "KGM",
    "g": "GRM", "gram": "GRM",
    "l": "LTR", "litru": "LTR", "litri": "LTR",
    "ml": "MLT",
    "m": "MTR", "metru": "MTR", "metri": "MTR",
    "m2": "MTK", "m²": "MTK",
    "m3": "MTQ", "m³": "MTQ",
    "h": "HUR", "ora": "HUR", "ore": "HUR", "oră": "HUR",
    "min": "MIN", "minut": "MIN",
    "set": "SET",
    "pereche": "PR",
    "serviciu": "C62",
    "service": "C62",
}


@dataclass
class PartyAddress:
    street: str
    city: str
    county_code: str
    country_code: str = "RO"
    postal_zone: str | None = None


@dataclass
class Party:
    name: str
    tax_id: str | None  # ex. RO12345678
    legal_id: str | None  # ex. J40/1234/2020
    legal_name: str | None
    address: PartyAddress
    phone: str | None = None
    email: str | None = None
    party_id_scheme: str | None = None  # pentru clienti fizici cu CNP


@dataclass
class InvoiceLineData:
    line_id: int
    name: str
    quantity: Decimal
    unit_code: str
    line_extension_amount: Decimal  # qty * unit_price (fara TVA)
    unit_price: Decimal
    vat_category: str
    vat_percent: Decimal
    tax_exemption_reason: str | None = None
    item_id_ref: int | None = None


@dataclass
class TaxSubtotalData:
    taxable_amount: Decimal
    tax_amount: Decimal
    vat_category: str
    vat_percent: Decimal
    tax_exemption_reason_code: str | None = None  # BT-121 (ex. VATEX-EU-O pt. neplatitor)


@dataclass
class AllowanceChargeData:
    """Reducere la nivel de document (BG-20, ChargeIndicator=false).

    EN16931 / CIUS-RO NU permite preturi unitare negative pe linii (BR-27).
    Reducerile din POS (linii cu pret negativ, ex. "Reducere fidelitate" -100)
    se traduc aici, cu suma in valoare absoluta si cota de TVA a liniei
    originale — ca sa scada corect si baza impozabila a acelei cote.
    """
    amount: Decimal          # BT-92 (pozitiv)
    vat_category: str        # BT-95
    vat_percent: Decimal     # BT-96
    reason: str              # BT-97


@dataclass
class PaymentMeansData:
    code: str  # ISO 4461 (10, 48, 30...)
    iban: str | None
    bank_name: str | None
    payment_id: str | None  # de obicei numarul facturii


@dataclass
class InvoicePayload:
    customization_id: str
    invoice_number: str
    issue_date: date
    due_date: date | None
    invoice_type_code: str  # 380, 381, 386, 751
    currency: str
    note: str | None
    supplier: Party
    customer: Party
    lines: list[InvoiceLineData]
    tax_subtotals: list[TaxSubtotalData]
    tax_total: Decimal
    line_extension_total: Decimal
    tax_exclusive_total: Decimal
    tax_inclusive_total: Decimal
    payable_amount: Decimal
    # Reduceri la nivel de document + totalul lor (BT-107) si avansul incasat (BT-113).
    allowances: list[AllowanceChargeData] = field(default_factory=list)
    allowance_total: Decimal = Decimal("0.00")
    prepaid_amount: Decimal = Decimal("0.00")
    payment_means: PaymentMeansData | None = None
    issues: list[str] = field(default_factory=list)  # warnings, non-fatale


# ---------- Utility ----------

def _q2(value: Decimal | float | int | None) -> Decimal:
    if value is None:
        return Decimal("0.00")
    if not isinstance(value, Decimal):
        value = Decimal(str(value))
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _resolve_unit_code(item: ReceiptItem) -> str:
    if item.unit_code:
        return item.unit_code.strip().upper()
    raw = (item.unit or "").strip().lower()
    if raw in UNIT_TEXT_TO_CODE:
        return UNIT_TEXT_TO_CODE[raw]
    # fallback bucati (cel mai comun)
    return "C62"


def _resolve_vat_percent(item: ReceiptItem, company: Company) -> Decimal:
    if item.vat_percent is not None:
        return _q2(item.vat_percent)
    if company.tva_percentage is not None:
        return _q2(company.tva_percentage)
    return Decimal("0.00")


def _resolve_supplier_tax_id(company: Company) -> str:
    cui_str = str(company.cui)
    if company.is_vat_payer and not cui_str.upper().startswith("RO"):
        return f"RO{cui_str}"
    return cui_str.upper() if cui_str.upper().startswith("RO") else cui_str


def _resolve_customer_tax_info(client: Client) -> tuple[str | None, str | None]:
    """Returneaza (tax_id, party_id_scheme).

    Pentru clientii juridici cu CUI -> ('RO12345', None) (folosim PartyTaxScheme).
    Pentru fizici, identificarea (CNP sau 13 zerouri) e tratata in build_invoice_payload
    (CNP in PartyLegalEntity/CompanyID), nu aici — valoarea returnata pt. fizic e ignorata.
    """
    cui = (client.cui or "").strip()
    if not cui:
        return None, None
    if client.tip == "juridic":
        if not cui.upper().startswith("RO"):
            cui = f"RO{cui}"
        return cui.upper(), None
    return None, cui  # fizic: CNP folosit ca scheme PartyIdentification


# Cod scutire TVA pentru emitent neplatitor de TVA (BT-121), conform ghid ANAF e-Factura.
VATEX_NON_VAT_PAYER = "VATEX-EU-O"

# Judetele Romaniei: nume normalizat (fara diacritice, uppercase) -> cod ISO 3166-2:RO.
RO_COUNTY_CODES = {
    "ALBA": "RO-AB", "ARAD": "RO-AR", "ARGES": "RO-AG", "BACAU": "RO-BC",
    "BIHOR": "RO-BH", "BISTRITA-NASAUD": "RO-BN", "BISTRITA NASAUD": "RO-BN",
    "BOTOSANI": "RO-BT", "BRASOV": "RO-BV", "BRAILA": "RO-BR",
    "BUCURESTI": "RO-B", "BUZAU": "RO-BZ", "CARAS-SEVERIN": "RO-CS",
    "CARAS SEVERIN": "RO-CS", "CALARASI": "RO-CL", "CLUJ": "RO-CJ",
    "CONSTANTA": "RO-CT", "COVASNA": "RO-CV", "DAMBOVITA": "RO-DB",
    "DOLJ": "RO-DJ", "GALATI": "RO-GL", "GIURGIU": "RO-GR", "GORJ": "RO-GJ",
    "HARGHITA": "RO-HR", "HUNEDOARA": "RO-HD", "IALOMITA": "RO-IL",
    "IASI": "RO-IS", "ILFOV": "RO-IF", "MARAMURES": "RO-MM",
    "MEHEDINTI": "RO-MH", "MURES": "RO-MS", "NEAMT": "RO-NT", "OLT": "RO-OT",
    "PRAHOVA": "RO-PH", "SATU MARE": "RO-SM", "SALAJ": "RO-SJ",
    "SIBIU": "RO-SB", "SUCEAVA": "RO-SV", "TELEORMAN": "RO-TR",
    "TIMIS": "RO-TM", "TULCEA": "RO-TL", "VASLUI": "RO-VS", "VALCEA": "RO-VL",
    "VRANCEA": "RO-VN",
}

_RO_COUNTY_CODE_SET = set(RO_COUNTY_CODES.values())  # {"RO-AB", ..., "RO-B"}


def _strip_diacritics(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c))


def normalize_county_code(raw: str | None) -> str:
    """Canonicalizeaza judetul la cod ISO 3166-2:RO (ex: 'B' / 'Bucuresti' / 'RO-B ' -> 'RO-B').

    Accepta: cod ISO complet ('RO-CJ'), cod scurt fara prefix ('CJ', 'B') sau numele
    judetului ('Cluj', 'Bucuresti'). Returneaza '' daca nu poate determina codul.

    Necesar deoarece <CountrySubentity> (BT-54) trebuie sa fie cod ISO valid, iar regula
    BR-RO-100 (sector obligatoriu) se declanseaza DOAR cand judetul e exact 'RO-B'. Fara
    canonicalizare, un judet trimis ca 'B'/'Bucuresti' ar ocoli normalize_ro_b_city si ar
    emite si un cod de subdiviziune invalid. Vezi [[normalize_ro_b_city]].
    """
    if not raw:
        return ""
    s = _strip_diacritics(raw).strip().upper()
    compact = s.replace(" ", "")
    if re.fullmatch(r"RO-[A-Z]{1,2}", compact):  # deja ISO complet
        return compact
    if re.fullmatch(r"[A-Z]{1,2}", compact):  # cod scurt fara prefix: B, CJ, IF...
        candidate = f"RO-{compact}"
        if candidate in _RO_COUNTY_CODE_SET:
            return candidate
    return RO_COUNTY_CODES.get(s, "")  # nume de judet -> cod


def _parse_county_city(text: str | None) -> tuple[str | None, str | None]:
    """Best-effort: extrage (cod_judet, localitate) din adresa text-liber RO.

    Ex: "JUD. TIMIS, MUN. TIMISOARA, STR. GLAD, NR.60" -> ("RO-TM", "Timisoara").
    Pentru Bucuresti, localitatea trebuie sa fie SECTORn (regula BR-RO-100).
    Returneaza (None, None) daca nu poate determina.
    """
    if not text:
        return None, None
    up = _strip_diacritics(text).upper()

    # 1) Sector explicit -> sigur Bucuresti (BR-RO-100), indiferent de restul adresei.
    sm = re.search(r"\bSECTOR(?:UL)?\s*([1-6])\b", up)
    if sm:
        return "RO-B", f"SECTOR{sm.group(1)}"

    # 2) Judet explicit "JUD. X / JUDETUL X" — are PRIORITATE fata de o mentiune de oras
    #    (altfel o adresa din Ilfov gen "Sos. Bucuresti-Ploiesti, Otopeni, jud Ilfov" ar fi
    #    etichetata gresit RO-B). De aceea il evaluam inaintea detectiei "BUCURESTI".
    county_code = None
    jm = re.search(r"JUD(?:ETUL|ET|\.)?\s+([A-Z][A-Z \-]*?)(?:,|$|\s+MUN|\s+ORAS|\s+SAT|\s+COM|\s+STR|\s+NR)", up + " ")
    if jm:
        name = jm.group(1).strip()
        county_code = RO_COUNTY_CODES.get(name) or (
            RO_COUNTY_CODES.get(name.split()[0]) if name.split() else None
        )

    # 3) "BUCURESTI" ca localitate de sine statatoare (NU parte dintr-un nume de strada gen
    #    "Bucuresti-Ploiesti" sau "Bd. Bucurestiului"), doar daca nu s-a gasit alt judet.
    if county_code is None and re.search(r"(?<![A-Z-])BUCURESTI(?![A-Z-])", up):
        return "RO-B", None  # sector nedeterminat -> normalize_ro_b_city pune SECTOR1

    # localitate: MUN./ORAS/SAT/COM.
    city = None
    cm = re.search(
        r"(?:MUN(?:ICIPIUL|\.)?|ORAS(?:UL)?|SAT|COM(?:UNA|\.)?)\s+([A-Z][A-Z \-]*?)"
        r"(?:,|$|\s+STR|\s+NR|\s+JUD|\s+COM|\s+MUN|\s+ORAS|\s+SAT)",
        up + " ",
    )
    if cm:
        city = cm.group(1).strip().title()
    return county_code, city


def normalize_ro_b_city(county_code: str, city: str, fallback_text: str | None = None) -> str:
    """Regula ANAF BR-RO-100: daca judetul (BT-54) e RO-B (Bucuresti), localitatea (BT-52)
    trebuie sa fie EXACT unul din SECTOR1..6 — nu text liber ("Bucuresti") si nici variante
    gen "Sector 3" / "SECTORUL 5". Normalizam orice forma la cea canonica, cautand numarul
    de sector atat in localitate cat si in adresa text-liber. Daca nu-l putem determina,
    folosim SECTOR1 ca fallback valid (ANAF accepta orice sector din lista; text liber e
    respins si factura nu poate fi depusa deloc). Pentru alte judete, returneaza city neatins.
    """
    # Canonicalizam intai (accepta 'B', 'Bucuresti', 'RO-B ' etc.) ca regula sa nu fie ocolita.
    if normalize_county_code(county_code) != "RO-B":
        return city
    sm = re.search(
        r"SECTOR(?:UL)?\s*([1-6])",
        _strip_diacritics(f"{city} {fallback_text or ''}").upper(),
    )
    return f"SECTOR{sm.group(1)}" if sm else "SECTOR1"


def _resolve_address(structured_parts: dict, fallback_text: str | None, country_code: str = "RO") -> PartyAddress:
    street = (structured_parts.get("street") or "").strip()
    city = (structured_parts.get("city") or "").strip()
    county_code = (structured_parts.get("county_code") or "").strip()
    postal = (structured_parts.get("postal_code") or "").strip()

    # Daca lipsesc campurile structurate, deriva-le din adresa text-liber.
    if (not county_code or not city) and fallback_text:
        parsed_county, parsed_city = _parse_county_city(fallback_text)
        county_code = county_code or (parsed_county or "")
        city = city or (parsed_city or "")

    # Canonicalizeaza codul de judet (ex: 'B'/'Bucuresti' -> 'RO-B') ca <CountrySubentity> sa
    # fie cod ISO valid. Aplicam ultim-resortul 'RO-B' AICI, INAINTE de normalizarea localitatii:
    # altfel un client fara adresa (judet nedeterminat -> default RO-B) ar pastra city='—' cu
    # county RO-B = respins de ANAF (BR-RO-100). Vezi normalize_ro_b_city.
    county_code = normalize_county_code(county_code) or county_code or "RO-B"

    # BR-RO-100: pentru RO-B localitatea trebuie codificata SECTORn (vezi normalize_ro_b_city).
    city = normalize_ro_b_city(county_code, city, fallback_text)

    if not street and fallback_text:
        # Best-effort: pune tot textul ca street
        street = fallback_text.strip().split("\n")[0][:255]
    return PartyAddress(
        street=street or "—",
        city=city or "—",
        county_code=county_code,
        country_code=country_code or "RO",
        postal_zone=postal or None,
    )


def _format_invoice_number(receipt: Receipt) -> str:
    serie = (receipt.factura_serie or "").strip()
    nr = receipt.factura_nr or 0
    if serie and nr:
        return f"{serie}{nr}"
    if serie:
        return serie
    return str(nr or receipt.id)


def _calculate_due_date(receipt: Receipt, payment_terms_days: int) -> date:
    if receipt.due_date:
        return receipt.due_date
    base = receipt.created_at.date() if hasattr(receipt.created_at, "date") else date.today()
    return base + timedelta(days=max(0, payment_terms_days))


# ---------- Validation ----------

_CUI_REGEX = re.compile(r"^(RO)?\d{2,10}$", re.IGNORECASE)
_CNP_REGEX = re.compile(r"^\d{13}$")
_IBAN_REGEX = re.compile(r"^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$")


def _validate_iban(iban: str) -> bool:
    """ISO 13616 mod-97 check."""
    iban = re.sub(r"\s+", "", iban).upper()
    if not _IBAN_REGEX.match(iban):
        return False
    rearranged = iban[4:] + iban[:4]
    converted = "".join(str(int(ch, 36)) if ch.isalpha() else ch for ch in rearranged)
    try:
        return int(converted) % 97 == 1
    except ValueError:
        return False


def _validate_supplier(company: Company, errors: list[str]) -> None:
    cui_str = str(company.cui)
    if not _CUI_REGEX.match(cui_str):
        errors.append(f"CUI furnizor invalid: {cui_str}")
    if not (company.name or "").strip():
        errors.append("Numele furnizorului lipseste.")
    if not (company.city or company.address):
        errors.append("Adresa furnizorului lipseste complet.")
    if not company.county_code:
        # warning only
        pass


def _validate_customer(client: Client | None, errors: list[str]) -> None:
    if client is None:
        errors.append("Clientul facturii lipseste.")
        return
    if not (client.nume or "").strip():
        errors.append("Numele clientului lipseste.")
    if client.cui:
        cui = client.cui.strip()
        if client.tip == "juridic":
            if not _CUI_REGEX.match(cui):
                errors.append(f"CUI client invalid: {cui}")
        elif client.tip == "fizic":
            # CNP-ul este optional pentru B2C
            if cui and not _CNP_REGEX.match(cui):
                errors.append(f"CNP client invalid: {cui}")


def _validate_receipt_header(receipt: Receipt, errors: list[str]) -> None:
    if not receipt.factura_serie and not receipt.factura_nr:
        errors.append("Receipt-ul nu are factura_serie/factura_nr setate.")
    if not receipt.created_at:
        errors.append("Receipt-ul nu are data emiterii.")
    else:
        age_days = (date.today() - receipt.created_at.date()).days
        if age_days > 60:
            errors.append(f"Factura este mai veche de 60 zile ({age_days} zile).")


def _validate_lines(lines: Iterable[ReceiptItem], errors: list[str]) -> None:
    has_line = False
    has_positive_line = False
    for line in lines:
        has_line = True
        if line.qty <= 0:
            errors.append(f"Linia '{line.name}' are cantitate invalida: {line.qty}")
        if line.price is None:
            errors.append(f"Linia '{line.name}' are pret invalid: {line.price}")
        elif line.price >= 0:
            has_positive_line = True
        # Pret negativ NU mai e eroare: linia devine reducere la nivel de document
        # (cac:AllowanceCharge) in build_invoice_payload, conform EN16931 BR-27.
        if line.vat_category and line.vat_category not in ALLOWED_VAT_CATEGORIES:
            errors.append(
                f"Linia '{line.name}' are vat_category invalid: {line.vat_category} "
                f"(permise: {sorted(ALLOWED_VAT_CATEGORIES)})"
            )
        if line.vat_percent is not None:
            pct = _q2(line.vat_percent)
            if pct not in ALLOWED_VAT_PERCENTS:
                errors.append(
                    f"Linia '{line.name}' are vat_percent {pct} (permise: 0/5/9/19)"
                )
    if not has_line:
        errors.append("Factura nu are linii.")
    elif not has_positive_line:
        # BR-16: factura trebuie sa aiba cel putin o linie reala; o factura numai
        # din reduceri ar avea total negativ (caz de stornare, nu de factura 380).
        errors.append(
            "Factura are numai linii de reducere. Trebuie sa existe cel putin un "
            "articol facturat (BR-16)."
        )


# ---------- Main entrypoint ----------

def build_invoice_payload(
    receipt: Receipt,
    company: Company,
    client: Client | None,
    payment_terms_days: int = 30,
    *,
    raise_on_error: bool = True,
) -> InvoicePayload:
    """Construieste payload-ul UBL friendly + valideaza pre-upload.

    Daca raise_on_error=True, ridica AnafValidationError la prima eroare critica.
    Daca False, returneaza payload cu .issues populat (pentru audit UI).
    """
    errors: list[str] = []
    warnings: list[str] = []

    _validate_supplier(company, errors)
    _validate_customer(client, errors)
    _validate_receipt_header(receipt, errors)
    _validate_lines(receipt.receipt_items, errors)

    # IBAN warning daca pay_method e OP/PARTIAL/NEPLATIT si IBAN lipseste/invalid
    if receipt.pay_method in (PayMethod.OP, PayMethod.PARTIAL, PayMethod.NEPLATIT):
        if not company.iban:
            warnings.append("IBAN furnizor lipseste pentru plata prin transfer.")
        elif not _validate_iban(company.iban):
            warnings.append(f"IBAN furnizor invalid (mod-97): {company.iban}")

    # Emitent neplatitor de TVA -> linii cu categorie "O" (neimpozabil), fara cod TVA pe
    # parti (regula BR-O-02), cod scutire VATEX-EU-O la breakdown. Ghid ANAF e-Factura.
    # Tratam ca neplatitor DOAR cand e explicit False; daca is_vat_payer e None (necunoscut)
    # pastram comportamentul de platitor (categorie S) ca sa NU subdeclaram TVA din greseala.
    vat_payer = company.is_vat_payer is not False
    if company.is_vat_payer is None:
        warnings.append(
            "Status TVA necunoscut (is_vat_payer=None); factura emisa ca platitor de TVA. "
            "Verifica si reimprospateaza statusul firmei la ANAF."
        )

    # build payload chiar daca avem erori — util pentru UI audit
    supplier_addr = _resolve_address(
        {
            "street": company.street,
            "city": company.city,
            "county_code": company.county_code,
            "postal_code": company.postal_code,
        },
        company.address,
        company.country_code or "RO",
    )
    supplier = Party(
        name=company.name or "—",
        tax_id=(_resolve_supplier_tax_id(company) if vat_payer else None),
        # Neplatitor de TVA: fara PartyTaxScheme, deci CUI-ul emitentului merge in
        # PartyLegalEntity/CompanyID (altfel ANAF raporteaza "CUI emitent =0"). Model ANAF.
        legal_id=(company.nr_reg_com if vat_payer else (str(company.cui).strip() or company.nr_reg_com)),
        legal_name=company.name,
        address=supplier_addr,
        phone=company.phone,
        email=company.email,
    )

    if client is not None:
        customer_addr = _resolve_address(
            {
                "street": client.street,
                "city": client.city,
                "county_code": client.county_code,
                "postal_code": client.postal_code,
            },
            client.adresa,
            client.country_code or "RO",
        )
        # Audit: daca adresa clientului a ajuns la Bucuresti/SECTOR fara o indicatie explicita
        # in datele sursa, valorile sunt PRESUPUSE (judet default RO-B sau sector default
        # SECTOR1). ANAF accepta, dar pot fi gresite — le semnalam pentru verificare.
        if customer_addr.county_code == "RO-B":
            _src = _strip_diacritics(
                f"{client.city or ''} {client.county_code or ''} {client.adresa or ''}"
            ).upper()
            if (
                not re.search(r"(?<![A-Z-])BUCURESTI(?![A-Z-])", _src)
                and normalize_county_code(client.county_code) != "RO-B"
            ):
                warnings.append(
                    "Judetul clientului nu a putut fi determinat; presupus Bucuresti (RO-B). "
                    "Verifica adresa clientului."
                )
            elif not re.search(r"\bSECTOR(?:UL)?\s*[1-6]\b", _src):
                warnings.append(
                    f"Sectorul Bucuresti al clientului nu a fost gasit; emis {customer_addr.city} "
                    "implicit (BR-RO-100). Verifica sectorul corect."
                )
        cust_tax_id, cust_scheme = _resolve_customer_tax_info(client)
        cust_legal_id: str | None = None
        if client.tip == "fizic":
            # B2C: cumparator persoana fizica. CNP-ul (sau 13 zerouri daca lipseste/e invalid)
            # merge in PartyLegalEntity/CompanyID (BT-47), conform regulilor ANAF B2C. Fara cod
            # TVA si fara PartyIdentification. Cu 13 zerouri ANAF accepta factura (nu o livreaza
            # in SPV-ul cumparatorului, dar e valida).
            cnp = (client.cui or "").strip()
            cust_legal_id = cnp if re.fullmatch(r"\d{13}", cnp) else "0000000000000"
            cust_tax_id = None
            cust_scheme = None
        elif not vat_payer:
            # Emitent neplatitor (categorie O): codul TVA al cumparatorului NU trebuie prezent
            # (regula BR-O-02); punem CUI-ul in PartyLegalEntity/CompanyID (altfel ANAF:
            # "nu a fost identificat cui cumparator").
            if client.cui:
                cust_legal_id = str(client.cui).strip().upper().removeprefix("RO") or None
            cust_tax_id = None
        customer = Party(
            name=client.nume or "—",
            tax_id=cust_tax_id,
            legal_id=cust_legal_id,
            legal_name=client.nume,
            address=customer_addr,
            phone=client.telefon,
            email=client.email,
            party_id_scheme=cust_scheme,
        )
    else:
        customer = Party(
            name="—",
            tax_id=None,
            legal_id=None,
            legal_name=None,
            # county RO-B impune localitate SECTORn (BR-RO-100); SECTOR1 ca fallback valid.
            address=PartyAddress(street="—", city="SECTOR1", county_code="RO-B"),
        )

    # Lines + reduceri
    #
    # Liniile cu total negativ (ex. "Reducere fidelitate" -100) NU pot fi trimise
    # ca linii de factura: EN16931 BR-27 cere pret unitar >= 0. Standardul le
    # exprima ca reduceri la nivel de document (BG-20 / cac:AllowanceCharge), pe
    # cota de TVA a liniei originale, ca sa scada si baza impozabila a acelei cote.
    lines_data: list[InvoiceLineData] = []
    tax_groups: dict[tuple[str, Decimal], Decimal] = {}       # (cat, pct) -> net linii
    allowance_groups: dict[tuple[str, Decimal], Decimal] = {}  # (cat, pct) -> reduceri
    allowances: list[AllowanceChargeData] = []
    line_no = 0
    for item in receipt.receipt_items:
        if vat_payer:
            vat_cat = (item.vat_category or "S").upper()
            vat_pct = _resolve_vat_percent(item, company)
        else:
            # Neplatitor de TVA -> categorie "O" (neimpozabil), cota 0.
            vat_cat = "O"
            vat_pct = Decimal("0")
        line_total = _q2(Decimal(item.qty) * Decimal(item.price))
        key = (vat_cat, vat_pct)

        if line_total < 0:
            allowances.append(
                AllowanceChargeData(
                    amount=_q2(-line_total),
                    vat_category=vat_cat,
                    vat_percent=vat_pct,
                    reason=item.name or "Reducere",
                )
            )
            allowance_groups[key] = allowance_groups.get(key, Decimal("0")) + _q2(-line_total)
            continue

        line_no += 1
        lines_data.append(
            InvoiceLineData(
                line_id=line_no,
                name=item.name,
                quantity=Decimal(item.qty),
                unit_code=_resolve_unit_code(item),
                line_extension_amount=line_total,
                unit_price=_q2(item.price),
                vat_category=vat_cat,
                vat_percent=vat_pct,
                tax_exemption_reason=item.tax_exemption_reason,
                item_id_ref=item.item_id,
            )
        )
        tax_groups[key] = tax_groups.get(key, Decimal("0")) + line_total

    allowance_total = _q2(sum(allowance_groups.values(), Decimal("0")))

    # Tax subtotals: baza impozabila per cota = net linii - reduceri pe aceeasi cota
    # (BR-45). O baza negativa ar fi respinsa de ANAF, deci o semnalam ca eroare.
    tax_subtotals: list[TaxSubtotalData] = []
    tax_total = Decimal("0.00")
    line_extension_total = Decimal("0.00")
    for key in sorted(set(tax_groups) | set(allowance_groups)):
        cat, pct = key
        lines_net = _q2(tax_groups.get(key, Decimal("0")))
        reduceri = _q2(allowance_groups.get(key, Decimal("0")))
        line_extension_total += lines_net
        taxable_q = _q2(lines_net - reduceri)
        if taxable_q < 0:
            errors.append(
                f"Reducerile pe cota TVA {pct}% ({reduceri}) depasesc valoarea "
                f"articolelor pe aceeasi cota ({lines_net}). Factura nu poate avea "
                "baza impozabila negativa — foloseste o factura de stornare."
            )
        tax_amt = _q2(taxable_q * pct / Decimal("100"))
        tax_total += tax_amt
        tax_subtotals.append(
            TaxSubtotalData(
                taxable_amount=taxable_q,
                tax_amount=tax_amt,
                vat_category=cat,
                vat_percent=pct,
                tax_exemption_reason_code=(VATEX_NON_VAT_PAYER if cat == "O" else None),
            )
        )

    # BT-109 = BT-106 - BT-107 (BR-CO-13)
    tax_exclusive_total = _q2(line_extension_total - allowance_total)
    tax_total_q = _q2(tax_total)
    tax_inclusive_total = _q2(tax_exclusive_total + tax_total_q)

    # Sanity check vs receipt.total
    if receipt.total is not None:
        expected = _q2(receipt.total)
        diff = abs(tax_inclusive_total - expected)
        if diff > Decimal("0.02"):
            warnings.append(
                f"Totalul calculat ({tax_inclusive_total}) difera de receipt.total ({expected}) cu {diff}"
            )

    # BT-113 (avans incasat) trebuie declarat explicit in XML, altfel
    # PayableAmount != TaxInclusiveAmount - Prepaid si ANAF respinge (BR-CO-16).
    prepaid = _q2(receipt.partial_pay or Decimal("0"))
    payable = _q2(tax_inclusive_total - prepaid)

    invoice_number = _format_invoice_number(receipt)
    due_date = _calculate_due_date(receipt, payment_terms_days)

    # Payment means
    payment_means: PaymentMeansData | None = None
    if receipt.pay_method:
        pm_code = PAY_METHOD_TO_CODE.get(receipt.pay_method, "30")
        payment_means = PaymentMeansData(
            code=pm_code,
            iban=company.iban,
            bank_name=company.bank_name,
            payment_id=invoice_number,
        )

    note_parts = []
    if receipt.titlu:
        note_parts.append(receipt.titlu)
    if receipt.descriere:
        note_parts.append(receipt.descriere)
    note = " | ".join(note_parts) if note_parts else None

    payload = InvoicePayload(
        customization_id=CIUS_RO_CUSTOMIZATION_ID,
        invoice_number=invoice_number,
        issue_date=receipt.created_at.date() if hasattr(receipt.created_at, "date") else date.today(),
        due_date=due_date,
        invoice_type_code=receipt.invoice_type_code or "380",
        currency=receipt.currency or "RON",
        note=note,
        supplier=supplier,
        customer=customer,
        lines=lines_data,
        tax_subtotals=tax_subtotals,
        tax_total=tax_total_q,
        line_extension_total=_q2(line_extension_total),
        tax_exclusive_total=tax_exclusive_total,
        tax_inclusive_total=tax_inclusive_total,
        payable_amount=payable,
        allowances=allowances,
        allowance_total=allowance_total,
        prepaid_amount=prepaid,
        payment_means=payment_means,
        issues=warnings,
    )

    if errors and raise_on_error:
        raise AnafValidationError(errors)
    if errors:
        payload.issues = errors + warnings

    return payload
