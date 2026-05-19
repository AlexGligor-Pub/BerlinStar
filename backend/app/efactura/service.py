"""Orchestrator pentru fluxul end-to-end: receipt -> validare -> XML -> upload -> tracking.

Acest modul contine logica de business între anaf_client (HTTP) si DB (efactura_records).
"""
from __future__ import annotations

import logging
import os
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.efactura import oauth_service
from app.efactura.anaf_client import AnafEFacturaClient
from app.efactura.exceptions import (
    AnafConfigError,
    AnafTokenMissing,
    AnafUploadError,
    AnafValidationError,
    EFacturaError,
)
from app.efactura.mapping import build_invoice_payload
from app.efactura.models import AnafSettings, AnafToken, EFacturaRecord, EFacturaReceivedIndex
from app.efactura.xml_builder import build_xml
from app.efactura.xml_validator import validate_schematron
from app.models.client import Client
from app.models.company import Company
from app.models.location import Location
from app.models.receipt import Receipt

log = logging.getLogger("berlinstar.efactura.service")


def _add_business_days(start: date, days: int) -> date:
    """Adauga `days` zile lucratoare la `start` (Lun-Vin)."""
    current = start
    added = 0
    while added < days:
        current += timedelta(days=1)
        if current.weekday() < 5:
            added += 1
    return current


async def _resolve_company_for_receipt(
    db: AsyncSession, receipt: Receipt
) -> Company | None:
    if receipt.location_id:
        loc = (
            await db.execute(select(Location).where(Location.id == receipt.location_id))
        ).scalar_one_or_none()
        if loc and loc.company_id:
            comp = (
                await db.execute(select(Company).where(Company.id == loc.company_id))
            ).scalar_one_or_none()
            if comp is not None:
                return comp
    return (
        await db.execute(
            select(Company)
            .where(Company.account_id == receipt.account_id, Company.is_deleted == False)
            .order_by(Company.id)
            .limit(1)
        )
    ).scalar_one_or_none()


async def _get_settings(db: AsyncSession, company_id: int) -> AnafSettings:
    row = (
        await db.execute(select(AnafSettings).where(AnafSettings.company_id == company_id))
    ).scalar_one_or_none()
    if row is None:
        raise AnafConfigError(
            f"Nu exista setari ANAF pentru company_id={company_id}. Configureaza-le mai intai."
        )
    return row


async def get_or_create_record(
    db: AsyncSession, receipt: Receipt, company: Company
) -> EFacturaRecord:
    rec = (
        await db.execute(
            select(EFacturaRecord).where(
                EFacturaRecord.receipt_id == receipt.id,
                EFacturaRecord.direction == "sent",
            )
        )
    ).scalar_one_or_none()
    if rec is not None:
        return rec

    issue_date = receipt.created_at.date() if hasattr(receipt.created_at, "date") else date.today()
    deadline = _add_business_days(issue_date, 5)

    rec = EFacturaRecord(
        company_id=company.id,
        receipt_id=receipt.id,
        cui=str(company.cui),
        direction="sent",
        standard="UBL",
        invoice_type=receipt.invoice_type_code or "380",
        status="draft",
        invoice_issue_date=issue_date,
        deadline_transmit=deadline,
    )
    db.add(rec)
    await db.flush()
    return rec


async def prepare_and_upload(
    db: AsyncSession,
    receipt: Receipt,
    *,
    archive_xml: bool = True,
) -> EFacturaRecord:
    """Genereaza XML, valideaza, urca la ANAF si actualizeaza EFacturaRecord."""
    company = await _resolve_company_for_receipt(db, receipt)
    if company is None:
        raise AnafConfigError("Nu am gasit compania emitenta a facturii.")

    settings = await _get_settings(db, company.id)

    payload = build_invoice_payload(
        receipt, company, receipt.client, payment_terms_days=settings.payment_terms_days
    )
    xml = build_xml(payload)

    if settings.validate_schematron:
        issues = validate_schematron(xml)
        if issues:
            raise AnafValidationError(issues)

    rec = await get_or_create_record(db, receipt, company)
    rec.invoice_type = payload.invoice_type_code
    rec.upload_attempts = (rec.upload_attempts or 0) + 1
    rec.last_attempt_at = datetime.now(timezone.utc)
    rec.status = "pending_upload"
    rec.anaf_error_message = None

    if archive_xml:
        rec.xml_s3_key = await _archive_xml_to_s3(receipt.account_id, payload.invoice_number, xml)
    else:
        rec.xml_content = xml

    await db.commit()
    await db.refresh(rec)

    # Upload
    try:
        access_token = await oauth_service.get_valid_access_token(db, company.id)
    except AnafTokenMissing as exc:
        rec.status = "error"
        rec.anaf_error_message = str(exc)
        await db.commit()
        raise

    client = AnafEFacturaClient(access_token, str(company.cui), use_test=settings.use_test_env)
    try:
        result = await client.upload_invoice(xml, standard="UBL", extern=receipt.is_extern)
    except AnafUploadError as exc:
        rec.status = "rejected"
        rec.anaf_stare = "nok"
        rec.anaf_error_message = str(exc)[:2000]
        await db.commit()
        log.warning("ANAF upload rejected for receipt_id=%s: %s", receipt.id, exc)
        raise

    rec.index_incarcare = int(result.get("index_incarcare") or 0) or None
    rec.data_creare_anaf = str(result.get("data_creare") or "")[:20]
    rec.status = "in_prelucrare"
    rec.anaf_stare = "in prelucrare"
    rec.next_retry_at = datetime.now(timezone.utc) + timedelta(minutes=15)
    await db.commit()
    await db.refresh(rec)

    log.info(
        "ANAF upload OK receipt_id=%s index_incarcare=%s test=%s",
        receipt.id, rec.index_incarcare, settings.use_test_env,
    )
    return rec


async def poll_status(db: AsyncSession, rec: EFacturaRecord) -> EFacturaRecord:
    """Verifica /stareMesaj si actualizeaza statusul (accepted/rejected)."""
    if not rec.index_incarcare:
        raise EFacturaError("Record fara index_incarcare — nu poate fi pollat.")

    settings = await _get_settings(db, rec.company_id)
    access_token = await oauth_service.get_valid_access_token(db, rec.company_id)
    client = AnafEFacturaClient(access_token, rec.cui, use_test=settings.use_test_env)
    resp = await client.check_status(rec.index_incarcare)

    stare = (resp.get("stare") or "").strip().lower()
    rec.anaf_stare = stare[:50]
    rec.last_attempt_at = datetime.now(timezone.utc)

    if stare == "ok":
        rec.status = "accepted"
        rec.download_id = int(resp.get("id_descarcare") or 0) or None
    elif stare == "nok":
        rec.status = "rejected"
        rec.download_id = int(resp.get("id_descarcare") or 0) or None
        rec.anaf_error_message = "Factura respinsa de ANAF (vezi ZIP-ul de raspuns)."
    elif stare == "in prelucrare":
        rec.status = "in_prelucrare"
        rec.next_retry_at = datetime.now(timezone.utc) + timedelta(minutes=10)
    elif "eroare" in stare or "erori" in stare:
        rec.status = "error"
        rec.anaf_error_message = str(resp.get("Errors") or resp.get("eroare") or "Eroare validare")[:2000]
    else:
        log.info("Stare ANAF necunoscuta: %s pentru rec=%s", stare, rec.id)

    await db.commit()
    await db.refresh(rec)
    return rec


async def download_and_archive(db: AsyncSession, rec: EFacturaRecord) -> EFacturaRecord:
    if not rec.download_id:
        raise EFacturaError("Record fara download_id.")
    if rec.response_zip_s3_key:
        return rec

    settings = await _get_settings(db, rec.company_id)
    access_token = await oauth_service.get_valid_access_token(db, rec.company_id)
    client = AnafEFacturaClient(access_token, rec.cui, use_test=settings.use_test_env)
    zip_bytes = await client.download_response(rec.download_id)

    rec.response_zip_s3_key = await _archive_zip_to_s3(rec.company_id, rec.id, zip_bytes)
    await db.commit()
    await db.refresh(rec)
    return rec


# ---------- S3 helpers ----------

async def _archive_xml_to_s3(account_id: int, invoice_number: str, xml: str) -> str:
    """Salveaza XML-ul in S3 si returneaza key-ul (sau fallback la inline)."""
    try:
        from app.utils.storage import _s3_client  # type: ignore[attr-defined]
    except ImportError:
        return ""

    bucket = os.getenv("S3_BUCKET", "professorprimedev")
    year = datetime.now(timezone.utc).year
    safe_num = "".join(c for c in invoice_number if c.isalnum() or c in ("-", "_"))[:60]
    key = f"accounts/{account_id}/efactura/sent/{year}/{safe_num}.xml"
    try:
        s3 = _s3_client()
        s3.put_object(
            Bucket=bucket,
            Key=key,
            Body=xml.encode("utf-8"),
            ContentType="application/xml",
            ACL="private",
        )
        return key
    except Exception as exc:  # noqa: BLE001
        log.warning("Nu am putut arhiva XML in S3: %s", exc)
        return ""


async def _archive_zip_to_s3(company_id: int, record_id: int, zip_bytes: bytes) -> str:
    try:
        from app.utils.storage import _s3_client  # type: ignore[attr-defined]
    except ImportError:
        return ""
    bucket = os.getenv("S3_BUCKET", "professorprimedev")
    year = datetime.now(timezone.utc).year
    key = f"efactura/companies/{company_id}/responses/{year}/{record_id}.zip"
    try:
        s3 = _s3_client()
        s3.put_object(
            Bucket=bucket,
            Key=key,
            Body=zip_bytes,
            ContentType="application/zip",
            ACL="private",
        )
        return key
    except Exception as exc:  # noqa: BLE001
        log.warning("Nu am putut arhiva ZIP in S3: %s", exc)
        return ""


async def _archive_received_zip_to_s3(company_id: int, received_id: int, zip_bytes: bytes) -> str:
    try:
        from app.utils.storage import _s3_client  # type: ignore[attr-defined]
    except ImportError:
        return ""
    bucket = os.getenv("S3_BUCKET", "professorprimedev")
    year = datetime.now(timezone.utc).year
    key = f"efactura/companies/{company_id}/received/{year}/{received_id}.zip"
    try:
        s3 = _s3_client()
        s3.put_object(
            Bucket=bucket,
            Key=key,
            Body=zip_bytes,
            ContentType="application/zip",
            ACL="private",
        )
        return key
    except Exception as exc:  # noqa: BLE001
        log.warning("Nu am putut arhiva ZIP primit in S3: %s", exc)
        return ""


async def _load_zip_from_s3(s3_key: str) -> bytes | None:
    """Reincarca un ZIP din S3 ca bytes. Returneaza None daca cheia lipseste/eroare."""
    if not s3_key:
        return None
    try:
        from app.utils.storage import _s3_client  # type: ignore[attr-defined]
    except ImportError:
        return None
    bucket = os.getenv("S3_BUCKET", "professorprimedev")
    import asyncio

    def _get() -> bytes | None:
        try:
            s3 = _s3_client()
            obj = s3.get_object(Bucket=bucket, Key=s3_key)
            return obj["Body"].read()
        except Exception as exc:  # noqa: BLE001
            log.warning("Nu am putut citi ZIP din S3 (%s): %s", s3_key, exc)
            return None

    return await asyncio.to_thread(_get)


async def ensure_received_downloaded(
    db: AsyncSession, idx: EFacturaReceivedIndex
) -> bytes:
    """Asigura ca ZIP-ul facturii primite este descarcat (S3 cache) si returneaza bytes.

    1. Daca avem deja un s3 key valid -> citim din S3.
    2. Daca nu, descarcam de la ANAF, salvam in S3, marcam downloaded=True.
    """
    if idx.response_zip_s3_key:
        zip_bytes = await _load_zip_from_s3(idx.response_zip_s3_key)
        if zip_bytes:
            return zip_bytes
        # S3 key invalid -> retry de la ANAF
        log.warning(
            "Cheie S3 invalida pentru received %s, redescarcam de la ANAF.", idx.id
        )

    token = (
        await db.execute(select(AnafToken).where(AnafToken.company_id == idx.company_id))
    ).scalar_one_or_none()
    if token is None:
        raise EFacturaError("Compania nu are token ANAF (deconectata).")
    settings = await _get_settings(db, idx.company_id)

    access_token = await oauth_service.get_valid_access_token(db, idx.company_id)
    client = AnafEFacturaClient(access_token, str(token.cui), use_test=settings.use_test_env)
    zip_bytes = await client.download_response(int(idx.id_solicitare))

    s3_key = await _archive_received_zip_to_s3(idx.company_id, idx.id, zip_bytes)
    idx.downloaded = True
    if s3_key:
        idx.response_zip_s3_key = s3_key
    await db.commit()
    await db.refresh(idx)
    return zip_bytes
