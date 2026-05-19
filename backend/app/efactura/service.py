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


def _looks_like_zip(data: bytes | None) -> bool:
    """Heuristic rapid: orice ZIP valid incepe cu `PK\\x03\\x04` (local file header)
    sau `PK\\x05\\x06` (empty central directory) sau `PK\\x07\\x08` (spanned)."""
    if not data or len(data) < 4:
        return False
    return data[:2] == b"PK" and data[2:4] in (b"\x03\x04", b"\x05\x06", b"\x07\x08")


def _anaf_error_excerpt(data: bytes) -> str:
    """Decodifica primii ~400 octeti ca text utilizator-friendly pentru log/eroare."""
    try:
        text = data[:400].decode("utf-8", errors="replace").strip()
    except Exception:  # noqa: BLE001
        return repr(data[:120])
    return " ".join(text.split())[:400]


async def ensure_received_downloaded(
    db: AsyncSession, idx: EFacturaReceivedIndex
) -> bytes:
    """Asigura ca ZIP-ul facturii primite este descarcat (S3 cache) si returneaza bytes.

    1. Daca avem deja un s3 key valid -> citim din S3 (cu validare ZIP).
    2. Daca nu / cache corupt, descarcam de la ANAF si validam ca e ZIP real
       inainte de a-l arhiva (altfel cache-uim un XML de eroare la nesfarsit).
    """
    if idx.response_zip_s3_key:
        cached = await _load_zip_from_s3(idx.response_zip_s3_key)
        if cached and _looks_like_zip(cached):
            return cached
        # Cache invalid (zero bytes / XML eroare arhivat anterior) -> retry ANAF
        log.warning(
            "Cache S3 invalid pentru received %s (key=%s) — redescarcam de la ANAF.",
            idx.id, idx.response_zip_s3_key,
        )
        idx.response_zip_s3_key = None

    token = (
        await db.execute(select(AnafToken).where(AnafToken.company_id == idx.company_id))
    ).scalar_one_or_none()
    if token is None:
        raise EFacturaError("Compania nu are token ANAF (deconectata).")
    settings = await _get_settings(db, idx.company_id)

    access_token = await oauth_service.get_valid_access_token(db, idx.company_id)
    client = AnafEFacturaClient(access_token, str(token.cui), use_test=settings.use_test_env)
    zip_bytes = await client.download_response(int(idx.id_solicitare))

    if not _looks_like_zip(zip_bytes):
        # Self-heal pentru bug-ul vechi: id_solicitare a fost setat din m["id_solicitare"]
        # (id-ul incarcarii expeditorului) in loc de m["id"] (download id). Daca avem
        # raw_payload cu un `id` diferit, retry cu valoarea corecta si corectam randul.
        retry_id: int | None = None
        if isinstance(idx.raw_payload, dict):
            raw_id = idx.raw_payload.get("id")
            try:
                raw_id_int = int(raw_id) if raw_id is not None else None
            except (TypeError, ValueError):
                raw_id_int = None
            if raw_id_int and raw_id_int != int(idx.id_solicitare):
                retry_id = raw_id_int

        if retry_id is not None:
            log.info(
                "Retry ANAF /descarcare cu download id=%s (raw_payload.id) pentru "
                "received %s — id_solicitare=%s nu era valid.",
                retry_id, idx.id, idx.id_solicitare,
            )
            zip_bytes_retry = await client.download_response(retry_id)
            if _looks_like_zip(zip_bytes_retry):
                # Evitam coliziunea pe (company_id, id_solicitare) — daca un sync
                # ulterior (cu fix-ul) a inserat deja un rand cu id_solicitare=retry_id,
                # pastram vechea valoare in DB si returnam ZIP-ul fara update.
                existing_dup = (
                    await db.execute(
                        select(EFacturaReceivedIndex.id).where(
                            EFacturaReceivedIndex.company_id == idx.company_id,
                            EFacturaReceivedIndex.id_solicitare == retry_id,
                            EFacturaReceivedIndex.id != idx.id,
                        )
                    )
                ).scalar_one_or_none()
                if existing_dup is None:
                    idx.id_solicitare = retry_id
                else:
                    log.warning(
                        "Self-heal received %s: download id=%s exista deja pe randul %s "
                        "— pastram id_solicitare vechi, dar returnam ZIP-ul corect.",
                        idx.id, retry_id, existing_dup,
                    )
                zip_bytes = zip_bytes_retry
            else:
                excerpt = _anaf_error_excerpt(zip_bytes_retry)
                log.warning(
                    "ANAF /descarcare?id=%s (retry) tot non-ZIP pentru received %s: %s",
                    retry_id, idx.id, excerpt,
                )
                raise EFacturaError(
                    f"ANAF nu a returnat ZIP pentru id={retry_id}. Raspuns: {excerpt}"
                )
        else:
            # ANAF a raspuns 200 dar continutul nu e ZIP (de obicei XML "id invalid"
            # sau "factura nu exista"). Nu arhivam in S3 ca sa nu poluam cache-ul.
            excerpt = _anaf_error_excerpt(zip_bytes)
            log.warning(
                "ANAF /descarcare?id=%s a returnat non-ZIP pentru received %s: %s",
                idx.id_solicitare, idx.id, excerpt,
            )
            raise EFacturaError(
                f"ANAF nu a returnat ZIP pentru id={idx.id_solicitare}. Raspuns: {excerpt}"
            )

    s3_key = await _archive_received_zip_to_s3(idx.company_id, idx.id, zip_bytes)
    idx.downloaded = True
    if s3_key:
        idx.response_zip_s3_key = s3_key
    await db.commit()
    await db.refresh(idx)
    return zip_bytes
