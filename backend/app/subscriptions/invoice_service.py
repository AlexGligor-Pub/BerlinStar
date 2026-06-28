"""Emiterea facturii pentru o plata Stripe a abonamentului BerlinStar.

Flow:
1. issue_invoice_async(payment_id) — apelata din webhook handler dupa
   payment_intent.succeeded. Aloca seria/numarul, construieste payload-ul
   UBL (refolosind app.efactura.mapping.InvoicePayload), randeaza XML,
   genereaza PDF cu reportlab, stocheaza in S3, apoi face upload in SPV.
2. PDF + XML + ZIP-ul oficial ANAF sunt disponibile la
   /api/subscription/invoices/{id}/pdf si /anaf-zip.
"""
from __future__ import annotations

import io
import logging
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal
from app.efactura.anaf_client import AnafEFacturaClient
from app.efactura.exceptions import EFacturaError
from app.efactura.mapping import (
    CIUS_RO_CUSTOMIZATION_ID,
    InvoiceLineData,
    InvoicePayload,
    Party,
    PartyAddress,
    PaymentMeansData,
    TaxSubtotalData,
    normalize_county_code,
    normalize_ro_b_city,
)
from app.efactura.xml_builder import build_xml
from app.models.account import Account
from app.models.global_settings import GlobalSettings
from app.models.subscription import SubscriptionPayment
from app.subscriptions import platform_anaf_oauth
from app.subscriptions.settings import get_or_create_global_settings, validate_issuer_complete

log = logging.getLogger("berlinstar.subscriptions.invoice")


# ---------- S3 ----------

def _s3_put(key: str, body: bytes, content_type: str) -> None:
    import os

    import boto3
    from botocore.client import Config

    bucket = os.getenv("S3_BUCKET", "professorprimedev")
    client = boto3.client(
        "s3",
        endpoint_url=os.getenv("S3_ENDPOINT_URL", "https://nbg1.your-objectstorage.com"),
        aws_access_key_id=os.getenv("S3_ACCESS_KEY"),
        aws_secret_access_key=os.getenv("S3_SECRET_KEY"),
        config=Config(signature_version="s3v4"),
    )
    client.put_object(Bucket=bucket, Key=key, Body=body, ContentType=content_type)


def _s3_get(key: str) -> bytes:
    import os

    import boto3
    from botocore.client import Config

    bucket = os.getenv("S3_BUCKET", "professorprimedev")
    client = boto3.client(
        "s3",
        endpoint_url=os.getenv("S3_ENDPOINT_URL", "https://nbg1.your-objectstorage.com"),
        aws_access_key_id=os.getenv("S3_ACCESS_KEY"),
        aws_secret_access_key=os.getenv("S3_SECRET_KEY"),
        config=Config(signature_version="s3v4"),
    )
    obj = client.get_object(Bucket=bucket, Key=key)
    return obj["Body"].read()


# ---------- Issue invoice ----------


def _allocate_invoice_number(gs: GlobalSettings) -> tuple[str, int]:
    """Aloca atomic seria+numarul facturii. Caller-ul detine row-lock prin
    SELECT FOR UPDATE (vezi `_issue_locked`)."""
    series = (gs.subscription_invoice_series or "BS-SUB").strip() or "BS-SUB"
    number = int(gs.subscription_next_invoice_number or 1)
    gs.subscription_next_invoice_number = number + 1
    return series, number


def _q2(value: Decimal | float | int) -> Decimal:
    from decimal import ROUND_HALF_UP

    if not isinstance(value, Decimal):
        value = Decimal(str(value))
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _build_payload(
    payment: SubscriptionPayment,
    gs: GlobalSettings,
    customer: dict[str, Any],
    invoice_number: str,
    issue_date: date,
) -> InvoicePayload:
    """Construieste InvoicePayload pentru o singura linie de abonament."""
    # Supplier: BerlinStar SRL
    # Canonicalizeaza judetul ('B'/'Bucuresti'/'RO-B ' -> 'RO-B') ca sa nu ocoleasca BR-RO-100
    # si sa emita un <CountrySubentity> valid; RO-B doar ca ultim resort.
    issuer_county = normalize_county_code(gs.issuer_county_code) or "RO-B"
    supplier_addr = PartyAddress(
        street=(gs.issuer_street or gs.issuer_address or "—")[:255],
        # BR-RO-100: pentru RO-B localitatea trebuie sa fie SECTORn, nu text liber.
        city=normalize_ro_b_city(issuer_county, gs.issuer_city or "—", gs.issuer_address),
        county_code=issuer_county,
        country_code=gs.issuer_country_code or "RO",
        postal_zone=gs.issuer_postal_code,
    )
    supplier_cui = (gs.issuer_cui or "").strip().upper()
    if gs.issuer_is_vat_payer and supplier_cui and not supplier_cui.startswith("RO"):
        supplier_cui = f"RO{supplier_cui}"
    supplier = Party(
        name=gs.issuer_name or "BerlinStar SRL",
        tax_id=supplier_cui if supplier_cui else None,
        legal_id=gs.issuer_reg_com,
        legal_name=gs.issuer_name,
        address=supplier_addr,
        phone=gs.issuer_phone,
        email=gs.issuer_email,
    )

    # Customer: snapshot la momentul platii
    cust_tip = (customer.get("tip") or "juridic").lower()
    cust_county = normalize_county_code(customer.get("county_code")) or "RO-B"
    cust_addr = PartyAddress(
        street=(customer.get("street") or customer.get("adresa") or "—")[:255],
        # BR-RO-100: pentru RO-B localitatea trebuie sa fie SECTORn, nu text liber.
        city=normalize_ro_b_city(cust_county, customer.get("city") or "—", customer.get("adresa")),
        county_code=cust_county,
        country_code=customer.get("country_code") or "RO",
        postal_zone=customer.get("postal_code"),
    )
    cust_cui = (customer.get("cui") or "").strip()
    cust_party_id_scheme = None
    cust_tax_id = None
    if cust_cui:
        if cust_tip == "juridic":
            cust_tax_id = cust_cui.upper() if cust_cui.upper().startswith("RO") else f"RO{cust_cui}"
        else:
            cust_party_id_scheme = cust_cui  # CNP
    customer_party = Party(
        name=customer.get("nume") or "Client BerlinStar",
        tax_id=cust_tax_id,
        legal_id=None,
        legal_name=customer.get("nume") or None,
        address=cust_addr,
        phone=customer.get("telefon"),
        email=customer.get("email"),
        party_id_scheme=cust_party_id_scheme,
    )

    # O singura linie: "Abonament BerlinStar — 12 luni"
    tax_inclusive_total = _q2(payment.amount_ron)
    tax_amount = _q2(payment.vat_amount_ron)
    tax_exclusive_total = _q2(tax_inclusive_total - tax_amount)
    vat_pct = _q2(gs.subscription_vat_percent or 0)
    vat_cat = "S" if vat_pct > 0 else "Z"

    period_label = ""
    if payment.period_start and payment.period_end:
        period_label = (
            f" ({payment.period_start.isoformat()} — {payment.period_end.isoformat()})"
        )

    line = InvoiceLineData(
        line_id=1,
        name=f"Abonament BerlinStar — 12 luni{period_label}",
        quantity=Decimal("1"),
        unit_code="C62",
        line_extension_amount=tax_exclusive_total,
        unit_price=tax_exclusive_total,
        vat_category=vat_cat,
        vat_percent=vat_pct,
        tax_exemption_reason=None,
        item_id_ref=None,
    )

    tax_subtotal = TaxSubtotalData(
        taxable_amount=tax_exclusive_total,
        tax_amount=tax_amount,
        vat_category=vat_cat,
        vat_percent=vat_pct,
    )

    payment_means = None
    if gs.issuer_iban:
        payment_means = PaymentMeansData(
            code="48",  # bank card (Stripe)
            iban=gs.issuer_iban,
            bank_name=gs.issuer_bank_name,
            payment_id=invoice_number,
        )

    note_parts = [
        f"Plata online prin Stripe — PaymentIntent {payment.stripe_payment_intent_id}",
        f"Curs BNR EUR/RON {payment.fx_rate_eur_ron} la data {payment.fx_date.isoformat()}",
    ]

    payload = InvoicePayload(
        customization_id=CIUS_RO_CUSTOMIZATION_ID,
        invoice_number=invoice_number,
        issue_date=issue_date,
        due_date=issue_date,  # plata e deja efectuata
        invoice_type_code="380",
        currency="RON",
        note=" | ".join(note_parts),
        supplier=supplier,
        customer=customer_party,
        lines=[line],
        tax_subtotals=[tax_subtotal],
        tax_total=tax_amount,
        line_extension_total=tax_exclusive_total,
        tax_exclusive_total=tax_exclusive_total,
        tax_inclusive_total=tax_inclusive_total,
        payable_amount=Decimal("0.00"),  # incasata integral via Stripe
        payment_means=payment_means,
        issues=[],
    )
    return payload


def _render_pdf(payment: SubscriptionPayment, gs: GlobalSettings, payload: InvoicePayload) -> bytes:
    """PDF simplu A4 cu datele facturii. Foloseste reportlab (instalat in requirements)."""
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.lib.units import mm
    from reportlab.platypus import (
        Paragraph,
        SimpleDocTemplate,
        Spacer,
        Table,
        TableStyle,
    )

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
        title=f"Factura {payload.invoice_number}",
    )
    styles = getSampleStyleSheet()
    s_normal = styles["Normal"]
    s_h1 = styles["Heading1"]
    s_h3 = styles["Heading3"]

    story: list = []
    story.append(Paragraph(f"Factura fiscala {payload.invoice_number}", s_h1))
    story.append(Paragraph(f"Data emiterii: {payload.issue_date.isoformat()}", s_normal))
    story.append(Spacer(1, 6 * mm))

    def party_block(title: str, p: Party) -> list:
        lines = [
            f"<b>{title}</b>",
            p.name or "—",
        ]
        if p.tax_id:
            lines.append(f"CUI: {p.tax_id}")
        if p.legal_id:
            lines.append(f"Reg. Com.: {p.legal_id}")
        addr = f"{p.address.street}, {p.address.city}"
        if p.address.county_code:
            addr += f", {p.address.county_code}"
        if p.address.postal_zone:
            addr += f", {p.address.postal_zone}"
        addr += f", {p.address.country_code}"
        lines.append(addr)
        if p.email:
            lines.append(f"Email: {p.email}")
        if p.phone:
            lines.append(f"Tel: {p.phone}")
        return [Paragraph(line, s_normal) for line in lines]

    parties_table = Table(
        [
            [party_block("Furnizor", payload.supplier), party_block("Client", payload.customer)],
        ],
        colWidths=[doc.width / 2 - 2 * mm, doc.width / 2 - 2 * mm],
        hAlign="LEFT",
    )
    parties_table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("BOX", (0, 0), (-1, -1), 0.25, colors.grey),
                ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.grey),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    story.append(parties_table)
    story.append(Spacer(1, 8 * mm))

    story.append(Paragraph("Produse / Servicii", s_h3))
    items_data = [["#", "Descriere", "Cant.", "Pret unitar", "Total fara TVA", "TVA %"]]
    for line in payload.lines:
        items_data.append(
            [
                str(line.line_id),
                line.name,
                f"{line.quantity}",
                f"{line.unit_price:.2f}",
                f"{line.line_extension_amount:.2f}",
                f"{line.vat_percent:.2f}",
            ]
        )
    items_table = Table(items_data, hAlign="LEFT", repeatRows=1)
    items_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.lightgrey),
                ("BOX", (0, 0), (-1, -1), 0.25, colors.grey),
                ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.grey),
                ("ALIGN", (2, 0), (5, -1), "RIGHT"),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    story.append(items_table)
    story.append(Spacer(1, 6 * mm))

    totals_data = [
        ["Total fara TVA:", f"{payload.tax_exclusive_total:.2f} {payload.currency}"],
        ["Total TVA:", f"{payload.tax_total:.2f} {payload.currency}"],
        ["Total cu TVA:", f"{payload.tax_inclusive_total:.2f} {payload.currency}"],
        ["De plata:", f"{payload.payable_amount:.2f} {payload.currency}"],
    ]
    totals_table = Table(totals_data, hAlign="RIGHT", colWidths=[60 * mm, 50 * mm])
    totals_table.setStyle(
        TableStyle(
            [
                ("ALIGN", (1, 0), (1, -1), "RIGHT"),
                ("FONTNAME", (0, -2), (-1, -1), "Helvetica-Bold"),
                ("TOPPADDING", (0, 0), (-1, -1), 2),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
            ]
        )
    )
    story.append(totals_table)
    story.append(Spacer(1, 8 * mm))

    if payload.note:
        story.append(Paragraph(f"<i>{payload.note}</i>", s_normal))

    doc.build(story)
    return buf.getvalue()


async def _issue_locked(db: AsyncSession, payment: SubscriptionPayment) -> SubscriptionPayment:
    """Aloca numar factura sub row-lock pe global_settings ca sa nu existe duplicate."""
    # Lock pesimist pe rand singleton (id=1)
    row = (
        await db.execute(
            select(GlobalSettings).order_by(GlobalSettings.id).limit(1).with_for_update()
        )
    ).scalar_one_or_none()
    if row is None:
        # creeaza singleton-ul daca lipseste — caz teoretic, dar safe
        row = GlobalSettings()
        db.add(row)
        await db.flush()

    missing = validate_issuer_complete(row)
    if missing:
        payment.anaf_status = "blocked_config"
        payment.anaf_error_message = "Datele firmei BerlinStar incomplete: " + ", ".join(missing)
        await db.commit()
        return payment

    series, number = _allocate_invoice_number(row)
    payment.invoice_series = series
    payment.invoice_number = number
    today = date.today()
    payment.invoice_issue_date = today

    payload = _build_payload(
        payment=payment,
        gs=row,
        customer=payment.customer_snapshot or {},
        invoice_number=f"{series}{number:04d}",
        issue_date=today,
    )

    try:
        xml = build_xml(payload)
    except EFacturaError as exc:
        payment.anaf_status = "xml_error"
        payment.anaf_error_message = str(exc)
        await db.commit()
        return payment

    pdf_bytes = _render_pdf(payment, row, payload)

    s3_xml_key = f"subscription/{payment.account_id}/{payment.id}_{series}{number:04d}.xml"
    s3_pdf_key = f"subscription/{payment.account_id}/{payment.id}_{series}{number:04d}.pdf"
    import asyncio

    await asyncio.to_thread(_s3_put, s3_xml_key, xml.encode("utf-8"), "application/xml")
    await asyncio.to_thread(_s3_put, s3_pdf_key, pdf_bytes, "application/pdf")
    payment.xml_s3_key = s3_xml_key
    payment.pdf_s3_key = s3_pdf_key
    await db.commit()
    return payment


async def _upload_to_spv(db: AsyncSession, payment: SubscriptionPayment) -> None:
    """Trimite XML-ul in SPV ANAF folosind tokenul platforma."""
    gs = await get_or_create_global_settings(db)
    if not gs.platform_anaf_auto_upload:
        payment.anaf_status = "upload_disabled"
        await db.commit()
        return

    if not payment.xml_s3_key:
        return

    try:
        access_token = await platform_anaf_oauth.get_valid_access_token(db)
    except EFacturaError as exc:
        payment.anaf_status = "token_error"
        payment.anaf_error_message = str(exc)
        await db.commit()
        return
    except Exception as exc:  # noqa: BLE001
        payment.anaf_status = "token_error"
        payment.anaf_error_message = str(exc)
        await db.commit()
        return

    import asyncio

    xml_bytes = await asyncio.to_thread(_s3_get, payment.xml_s3_key)
    xml_str = xml_bytes.decode("utf-8")

    cui_clean = (gs.issuer_cui or "").replace("RO", "").strip()
    client = AnafEFacturaClient(
        access_token=access_token,
        cui=cui_clean,
        use_test=gs.platform_anaf_use_test_env,
    )
    try:
        resp = await client.upload_invoice(xml_str, standard="UBL")
    except EFacturaError as exc:
        payment.anaf_status = "upload_error"
        payment.anaf_error_message = str(exc)
        await db.commit()
        return

    idx = resp.get("index_incarcare")
    if idx is not None:
        payment.anaf_index_incarcare = int(idx)
        payment.anaf_status = "in_prelucrare"
        payment.anaf_error_message = None
    else:
        payment.anaf_status = "unknown_response"
        payment.anaf_error_message = str(resp)[:500]
    await db.commit()
    log.info(
        "Subscription invoice %s%s uploaded la ANAF SPV (index=%s)",
        payment.invoice_series, payment.invoice_number, payment.anaf_index_incarcare,
    )


async def issue_invoice_async(payment_id: int) -> None:
    """Punctul de intrare apelat din webhook handler (asyncio.create_task)."""
    async with AsyncSessionLocal() as db:
        payment = (
            await db.execute(
                select(SubscriptionPayment).where(SubscriptionPayment.id == payment_id)
            )
        ).scalar_one_or_none()
        if payment is None:
            log.warning("issue_invoice_async: payment %s nu exista", payment_id)
            return
        if payment.status != "succeeded":
            log.info("issue_invoice_async: payment %s status=%s — skip", payment_id, payment.status)
            return

        if payment.invoice_number is None:
            try:
                await _issue_locked(db, payment)
            except Exception:  # noqa: BLE001
                log.exception("Issue invoice failed for payment %s", payment_id)
                return

        if payment.invoice_number and not payment.anaf_index_incarcare:
            try:
                await _upload_to_spv(db, payment)
            except Exception:  # noqa: BLE001
                log.exception("SPV upload failed for payment %s", payment_id)


async def poll_anaf_status(db: AsyncSession, payment: SubscriptionPayment) -> None:
    """Verifica statusul SPV pentru o factura in_prelucrare."""
    if payment.anaf_index_incarcare is None:
        return

    gs = await get_or_create_global_settings(db)
    try:
        access_token = await platform_anaf_oauth.get_valid_access_token(db)
    except Exception:  # noqa: BLE001
        return
    cui_clean = (gs.issuer_cui or "").replace("RO", "").strip()
    client = AnafEFacturaClient(
        access_token=access_token,
        cui=cui_clean,
        use_test=gs.platform_anaf_use_test_env,
    )
    try:
        resp = await client.check_status(payment.anaf_index_incarcare)
    except EFacturaError as exc:
        payment.anaf_error_message = str(exc)
        await db.commit()
        return

    stare = (resp.get("stare") or resp.get("stare_mesaj") or "").lower()
    if "ok" in stare or "validat" in stare:
        payment.anaf_status = "accepted"
    elif "nok" in stare or "respins" in stare:
        payment.anaf_status = "rejected"
        payment.anaf_error_message = str(resp)[:500]
    download_id = resp.get("id_descarcare") or resp.get("id")
    if download_id and not payment.anaf_download_id:
        payment.anaf_download_id = int(download_id)
    await db.commit()


async def download_anaf_zip(db: AsyncSession, payment: SubscriptionPayment) -> None:
    """Descarca ZIP-ul semnat ANAF si il salveaza in S3."""
    if payment.anaf_download_id is None or payment.anaf_response_zip_s3_key:
        return
    gs = await get_or_create_global_settings(db)
    access_token = await platform_anaf_oauth.get_valid_access_token(db)
    cui_clean = (gs.issuer_cui or "").replace("RO", "").strip()
    client = AnafEFacturaClient(
        access_token=access_token,
        cui=cui_clean,
        use_test=gs.platform_anaf_use_test_env,
    )
    try:
        zip_bytes = await client.download_response(payment.anaf_download_id)
    except EFacturaError as exc:
        payment.anaf_error_message = str(exc)
        await db.commit()
        return

    key = f"subscription/{payment.account_id}/{payment.id}_anaf.zip"
    import asyncio

    await asyncio.to_thread(_s3_put, key, zip_bytes, "application/zip")
    payment.anaf_response_zip_s3_key = key
    await db.commit()


def get_pdf_bytes(payment: SubscriptionPayment) -> bytes:
    if not payment.pdf_s3_key:
        raise FileNotFoundError("PDF not yet generated")
    return _s3_get(payment.pdf_s3_key)


def get_zip_bytes(payment: SubscriptionPayment) -> bytes:
    if not payment.anaf_response_zip_s3_key:
        raise FileNotFoundError("ZIP ANAF not yet available")
    return _s3_get(payment.anaf_response_zip_s3_key)
