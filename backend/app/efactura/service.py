"""Orchestrator pentru fluxul end-to-end: receipt -> validare -> XML -> upload -> tracking.

Acest modul contine logica de business între anaf_client (HTTP) si DB (efactura_records).
"""
from __future__ import annotations

import json
import logging
import os
import re
from datetime import date, datetime, timedelta, timezone

import httpx
from sqlalchemy import and_, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.efactura import oauth_service
from app.efactura.anaf_client import AnafEFacturaClient
from app.efactura.exceptions import (
    AnafConfigError,
    AnafRateLimited,
    AnafUploadError,
    AnafValidationError,
    EFacturaError,
)
from app.efactura.mapping import build_invoice_payload, invoice_issue_date
from app.efactura.models import AnafSettings, AnafToken, EFacturaRecord, EFacturaReceivedIndex
from app.efactura.xml_builder import build_xml
from app.efactura.xml_validator import validate_schematron
from app.models.client import Client
from app.models.company import Company
from app.models.location import Location
from app.models.receipt import Receipt
from app.models.register import Register

log = logging.getLogger("berlinstar.efactura.service")

# ---------- Masina de stari a unei facturi trimise ----------
#
# `status` ramane cel cunoscut de UI si de blocarea bonului (routers/receipts.py).
# Sub-starile lui 'pending_upload' se tin in `anaf_stare`, fara coloana noua:
#   STARE_QUEUED    — pusa in coada de mark_pending_upload, inca nepreluata
#   STARE_UPLOADING — preluata de UN apelant; trimiterea catre ANAF e in curs
# Trecerile se fac cu UPDATE conditionat (compare-and-set): request-ul, task-ul
# din fundal si job-ul nu pot prelua amandoi aceeasi factura, deci nu o pot
# trimite de doua ori.
STARE_QUEUED = "in coada"
STARE_UPLOADING = "se trimite"
# status='error' + anaf_stare=STARE_UNKNOWN: cererea a plecat, dar raspunsul nu a
# ajuns (timeout, conexiune rupta, 5xx). NU se retrimite automat.
STARE_UNKNOWN = "necunoscut"
# Peste acest interval un 'pending_upload' e considerat abandonat (proces repornit).
# Acopera cu mult timeout-urile reale: 30s refresh token + 60s POST.
CLAIM_TIMEOUT = timedelta(minutes=15)

MSG_UNKNOWN = (
    "Rezultat necunoscut: ANAF nu a confirmat primirea facturii. Verifica in SPV "
    "daca factura apare inainte de a o retrimite."
)
# O retrimitere inlocuieste incarcarea respinsa: indexul, id-ul de descarcare si
# arhiva raspunsului ei se sterg din record. Altfel un esec al noii incercari ar lasa
# 'error' CU index vechi — bon blocat la editare si fara „Trimite in SPV" — iar
# raspunsul unei retrimiteri acceptate nu s-ar mai arhiva (cheia veche l-ar opri).
_SUPERSEDED = {"index_incarcare": None, "download_id": None, "response_zip_s3_key": None}

MSG_NOT_STARTED = (
    "Trimiterea nu a pornit (serverul a fost repornit). Nimic nu a plecat la ANAF — "
    "trimite din nou."
)


class EFacturaStateError(EFacturaError):
    """Tranzitia ceruta nu e permisa din starea curenta a facturii."""


class UploadNotClaimed(EFacturaStateError):
    """Factura e deja preluata de alt apelant sau nu mai e in coada; nu s-a trimis nimic."""


class UploadOutcomeUnknown(EFacturaError):
    """Cererea a plecat spre ANAF, dar nu stim daca a fost primita."""


def _resendable():
    """Starile din care o (re)trimitere e corecta.

    'in_prelucrare' fara index e record-ul blocat de versiunile vechi (nepollabil).
    Restul — in coada, in curs, in prelucrare cu index, acceptata — ar dubla factura.
    """
    return or_(
        EFacturaRecord.status.in_(("draft", "error", "rejected")),
        and_(
            EFacturaRecord.status == "in_prelucrare",
            EFacturaRecord.index_incarcare.is_(None),
        ),
    )


def _serialize_raw(value: object) -> str | None:
    """Serializeaza raspunsul brut ANAF (dict sau text) ca JSON pentru anaf_raw_response.

    Fallback la str() daca nu e serializabil. Trunchiat la 8000 caractere. Returneaza
    None pentru valori goale (ex. fara raw atasat pe eroare).
    """
    if not value:
        return None
    try:
        return json.dumps(value, default=str, ensure_ascii=False)[:8000]
    except (TypeError, ValueError):
        return str(value)[:8000]


def _add_business_days(start: date, days: int) -> date:
    """Adauga `days` zile lucratoare la `start` (Lun-Vin)."""
    current = start
    added = 0
    while added < days:
        current += timedelta(days=1)
        if current.weekday() < 5:
            added += 1
    return current


async def _company_from_location(
    db: AsyncSession, receipt: Receipt
) -> Company | None:
    # Locatia si compania se cauta DOAR in contul bonului: cu un location_id sau
    # company_id strain, factura ar pleca la ANAF cu tokenul si CUI-ul altui cont.
    if receipt.location_id:
        loc = (
            await db.execute(
                select(Location).where(
                    Location.id == receipt.location_id,
                    Location.account_id == receipt.account_id,
                )
            )
        ).scalar_one_or_none()
        if loc and loc.company_id:
            comp = (
                await db.execute(
                    select(Company).where(
                        Company.id == loc.company_id,
                        Company.account_id == receipt.account_id,
                    )
                )
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


async def resolve_supplier(
    db: AsyncSession, receipt: Receipt
) -> tuple[Company | None, str | None]:
    """Compania emitenta a facturii + motivul pentru care nu e sigura (None = e sigura).

    Numarul, seria si antetul PDF-ului vin din locatia de pe care s-a facturat
    (`receipts.assign_number`), care poate fi alta decat locatia bonului. Bonul nu
    retine acea locatie, dar ii retine seria: daca seria apartine registrului unei
    singure firme a contului, aceea e emitentul — altfel XML-ul ar pleca la ANAF cu
    alt CUI (si alt token) decat cel tiparit pe factura.

    Regula veche (firma locatiei bonului, apoi prima firma a contului) ramane
    valabila ori de cate ori seria nu o contrazice: serie negasita in registre
    (schimbata intre timp) sau folosita si de firma bonului.
    """
    base = await _company_from_location(db, receipt)
    if base is None or not receipt.factura_nr or not receipt.factura_serie:
        return base, None
    company_ids = set(
        (
            await db.execute(
                select(Location.company_id)
                .join(Register, Register.id == Location.register_id)
                .where(
                    Location.account_id == receipt.account_id,
                    Register.account_id == receipt.account_id,
                    Register.factura_serie == receipt.factura_serie,
                    Location.company_id.isnot(None),
                )
            )
        ).scalars().all()
    )
    if not company_ids or base.id in company_ids:
        return base, None
    owners = (
        await db.execute(
            select(Company)
            .where(Company.id.in_(company_ids), Company.account_id == receipt.account_id)
            .order_by(Company.id)
        )
    ).scalars().all()
    if not owners:
        return base, None
    if len(owners) == 1:
        return owners[0], None
    return base, (
        f"Seria facturii ({receipt.factura_serie}) este folosita de mai multe firme ale "
        "contului, iar locatia bonului nu apartine niciuneia dintre ele. Nu pot stabili "
        "firma emitenta — verifica locatia si registrul bonului."
    )


async def _resolve_company_for_receipt(
    db: AsyncSession, receipt: Receipt
) -> Company | None:
    company, _problem = await resolve_supplier(db, receipt)
    return company


def own_client(receipt: Receipt) -> Client | None:
    """Clientul bonului, doar daca e al aceluiasi cont.

    `Receipt.client` nu filtreaza pe cont: un bon ramas legat de clientul altui
    cont (inainte de verificarea de la scriere) i-ar pune numele, CUI/CNP-ul si
    adresa in XML. Clientul sters intre timp ramane valabil — factura lui exista.
    """
    client = receipt.client
    if client is None or client.account_id != receipt.account_id:
        return None
    return client


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
        if rec.company_id != company.id:
            # Record vechi creat pe compania altui cont (inainte de filtrul pe cont):
            # il readucem pe compania bonului, altfel reincercarea ar ramane vizibila
            # in lista celuilalt cont. O companie proprie schimbata intre timp ramane.
            owned = await db.scalar(
                select(Company.id).where(
                    Company.id == rec.company_id,
                    Company.account_id == receipt.account_id,
                )
            )
            if owned is None:
                rec.company_id = company.id
                rec.cui = str(company.cui)
        return rec

    # Ziua din Romania, aceeasi ca in XML (mapping.invoice_issue_date), nu ziua UTC.
    issue_date = invoice_issue_date(receipt)
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


# Refuzul obisnuit al /upload: HTTP 200 cu XML
#   <header ... ExecutionStatus="1"><Errors errorMessage="..."/></header>
_XML_REFUSAL = re.compile(r'<Errors\b|ExecutionStatus\s*=\s*"1"')


def _is_4xx(value: object) -> bool:
    try:
        return 400 <= int(value) < 500  # type: ignore[call-overload]
    except (TypeError, ValueError):
        return False


def _refused_by_anaf(exc: AnafUploadError) -> bool:
    """ANAF a raspuns explicit ca NU a primit factura.

    Refuz = eroare in corp (JSON `eroare`/`Errors` sau XML-ul de mai sus) ori HTTP 4xx
    (statusul cererii sau campul `status` din corpul JSON al gateway-ului).
    Un 2xx neparsabil sau fara index_incarcare nu e refuz: factura poate fi inregistrata.
    """
    raw = exc.raw
    if not isinstance(raw, dict):
        return False
    if "eroare" in raw or "Errors" in raw:
        return True
    if _is_4xx(raw.get("http_status")) or _is_4xx(raw.get("status")):
        return True
    return bool(_XML_REFUSAL.search(str(raw.get("body") or "")))


async def _mark_not_sent(db: AsyncSession, rec: EFacturaRecord, message: str) -> None:
    """Esec inainte ca ceva sa ajunga la ANAF: 'error' fara index (sters la punerea
    in coada / la preluare), deci bonul redevine editabil si retrimiterea e sigura."""
    rec.status = "error"
    rec.anaf_stare = None
    rec.anaf_error_message = message[:2000]
    rec.anaf_raw_response = None  # eroare locala — fara raspuns ANAF
    rec.last_attempt_at = datetime.now(timezone.utc)
    await db.commit()


async def _mark_unknown(
    db: AsyncSession, rec: EFacturaRecord, detail: str, raw: object = None
) -> None:
    rec.status = "error"
    rec.anaf_stare = STARE_UNKNOWN
    rec.anaf_error_message = f"{MSG_UNKNOWN} Detaliu: {detail}"[:2000]
    rec.anaf_raw_response = _serialize_raw(raw)
    rec.last_attempt_at = datetime.now(timezone.utc)
    await db.commit()


async def prepare_and_upload(
    db: AsyncSession,
    receipt: Receipt,
    *,
    archive_xml: bool = True,
) -> EFacturaRecord:
    """Genereaza XML, valideaza, urca la ANAF si actualizeaza EFacturaRecord.

    Preia mai intai factura (UPDATE conditionat): doar din 'pending_upload' in coada
    sau din 'draft'. Daca alt apelant a preluat-o deja, ridica `UploadNotClaimed`
    fara sa trimita nimic. Dupa preluare functia NU lasa record-ul in
    'pending_upload': se termina in 'in_prelucrare' (cu index) sau in 'error' — fie
    sigur netrimis, fie cu rezultat necunoscut (`UploadOutcomeUnknown`).
    """
    company, problem = await resolve_supplier(db, receipt)
    if company is None or problem:
        message = problem or "Nu am gasit compania emitenta a facturii."
        # Record-ul din coada nu are cum sa plece: il scoatem ca sa se deblocheze UI-ul.
        await db.execute(
            update(EFacturaRecord)
            .where(
                EFacturaRecord.receipt_id == receipt.id,
                EFacturaRecord.direction == "sent",
                EFacturaRecord.status == "pending_upload",
                or_(
                    EFacturaRecord.anaf_stare.is_(None),
                    EFacturaRecord.anaf_stare != STARE_UPLOADING,
                ),
            )
            .values(
                status="error",
                anaf_stare=None,
                anaf_error_message=message,
                last_attempt_at=datetime.now(timezone.utc),
                **_SUPERSEDED,
            )
            .execution_options(synchronize_session=False)
        )
        await db.commit()
        raise AnafConfigError(message)

    rec = await get_or_create_record(db, receipt, company)
    await db.flush()

    # Draft-ul si coada nu au index; il stergem si aici ca orice stare de dupa
    # preluare sa fie sigur „fara index" (vezi `_SUPERSEDED`).
    claimed = await db.execute(
        update(EFacturaRecord)
        .where(
            EFacturaRecord.id == rec.id,
            or_(
                EFacturaRecord.status == "draft",
                and_(
                    EFacturaRecord.status == "pending_upload",
                    EFacturaRecord.anaf_stare == STARE_QUEUED,
                ),
            ),
        )
        .values(
            status="pending_upload",
            anaf_stare=STARE_UPLOADING,
            anaf_error_message=None,
            last_attempt_at=datetime.now(timezone.utc),
            **_SUPERSEDED,
        )
        .execution_options(synchronize_session=False)
    )
    got_claim = claimed.rowcount == 1
    await db.commit()
    await db.refresh(rec)
    if not got_claim:
        raise UploadNotClaimed(
            f"Factura receipt_id={receipt.id} nu e in coada de trimitere "
            f"(status: {rec.status}, stare: {rec.anaf_stare}); nu am trimis nimic."
        )

    # --- Pregatire: pana la POST nimic nu ajunge la ANAF, deci orice esec e sigur. ---
    try:
        settings = await _get_settings(db, company.id)
        # Si job-ul de auto-upload ajunge aici, fara verificarile din router: clientul
        # altui cont e tratat ca lipsa, deci validarea pica si nu pleaca nimic la ANAF.
        payload = build_invoice_payload(
            receipt, company, own_client(receipt), payment_terms_days=settings.payment_terms_days
        )
        xml = build_xml(payload)

        if settings.validate_schematron:
            issues = validate_schematron(xml)
            if issues:
                raise AnafValidationError(issues)
    except AnafValidationError as exc:
        await _mark_not_sent(db, rec, "Validare esuata: " + "; ".join(exc.issues))
        raise
    except AnafConfigError as exc:
        await _mark_not_sent(db, rec, str(exc))
        raise
    except Exception as exc:  # noqa: BLE001
        await _mark_not_sent(db, rec, f"Eroare la generarea XML: {exc}")
        raise

    rec.invoice_type = payload.invoice_type_code
    if archive_xml:
        rec.xml_s3_key = await _archive_xml_to_s3(receipt.account_id, payload.invoice_number, xml)
    else:
        rec.xml_content = xml
    await db.commit()

    try:
        access_token = await oauth_service.get_valid_access_token(db, company.id)
    except Exception as exc:  # noqa: BLE001
        # Token lipsa/expirat sau refresh esuat: POST-ul nu s-a facut.
        message = (
            str(exc) if isinstance(exc, EFacturaError)
            else f"Nu am putut obtine tokenul ANAF: {exc}"
        )
        await _mark_not_sent(db, rec, message)
        raise

    # Record-ul urmeaza firma cu care pleaca efectiv XML-ul: statusul se interogheaza
    # apoi cu tokenul si CUI-ul din record.
    rec.company_id = company.id
    rec.cui = str(company.cui)
    rec.upload_attempts = (rec.upload_attempts or 0) + 1
    rec.last_attempt_at = datetime.now(timezone.utc)
    await db.commit()

    # --- Upload ---
    client = AnafEFacturaClient(access_token, str(company.cui), use_test=settings.use_test_env)
    try:
        result = await client.upload_invoice(xml, standard="UBL", extern=receipt.is_extern)
    except AnafUploadError as exc:
        if not _refused_by_anaf(exc):
            # 2xx fara index / corp neparsabil: ANAF poate sa fi inregistrat factura.
            await _mark_unknown(db, rec, str(exc), getattr(exc, "raw", None))
            log.warning("ANAF upload cu rezultat necunoscut receipt_id=%s: %s", receipt.id, exc)
            raise UploadOutcomeUnknown(str(exc)) from exc
        # Contract status:
        #   - "rejected" = ANAF a procesat asincron si a respins (rec.index_incarcare != None,
        #     download_id setat, /stareMesaj a returnat "nok"). Set in `poll_status`.
        #   - "error"    = upload-ul nu a ajuns sa primeasca index_incarcare. Bonul redevine
        #     editabil pentru ca nimic nu ramane in flux ANAF; cron-ul
        #     `job_download_responses` nu picks-up error.
        # Aici suntem in al doilea caz: ANAF a refuzat explicit incarcarea.
        rec.status = "error"
        rec.anaf_stare = "nok"
        rec.anaf_error_message = str(exc)[:2000]
        rec.anaf_raw_response = _serialize_raw(getattr(exc, "raw", None))
        await db.commit()
        log.warning("ANAF upload rejected for receipt_id=%s: %s", receipt.id, exc)
        raise
    except AnafRateLimited as exc:
        await _mark_not_sent(
            db, rec,
            "ANAF a refuzat temporar cererea (limita de cereri). Nimic nu a fost "
            "transmis — reincearca peste cateva minute.",
        )
        log.warning("ANAF rate limit la upload receipt_id=%s: %s", receipt.id, exc)
        raise
    except (httpx.ConnectError, httpx.ConnectTimeout) as exc:
        # Conexiunea nu s-a stabilit: corpul cererii nu a plecat.
        message = (
            f"Nu m-am putut conecta la ANAF ({type(exc).__name__}). Nimic nu a fost "
            "transmis — reincearca."
        )
        await _mark_not_sent(db, rec, message)
        log.warning("ANAF indisponibil la upload receipt_id=%s: %r", receipt.id, exc)
        raise EFacturaError(message) from exc
    except Exception as exc:  # noqa: BLE001
        # Timeout la raspuns, conexiune rupta, HTTP 5xx: cererea a plecat si nu stim
        # daca ANAF a inregistrat-o. O retrimitere automata ar putea dubla factura.
        detail = f"{type(exc).__name__}: {exc}"
        await _mark_unknown(db, rec, detail)
        log.warning("ANAF upload cu rezultat necunoscut receipt_id=%s: %s", receipt.id, detail)
        raise UploadOutcomeUnknown(detail) from exc

    index = int(result.get("index_incarcare") or 0) or None
    if index is None:
        # Plasa de siguranta: nu marcam NICIODATA 'in_prelucrare' fara index_incarcare.
        # (upload_invoice ridica deja AnafUploadError in acest caz; pastram verificarea aici
        # pentru robustete — un 'in_prelucrare' fara index ar fi nepollabil si captiv.)
        await _mark_unknown(
            db, rec, "ANAF nu a returnat index_incarcare (raspuns neasteptat).", result
        )
        log.warning("ANAF upload fara index pentru receipt_id=%s; rezultat necunoscut.", receipt.id)
        raise AnafUploadError(
            "ANAF nu a returnat index_incarcare",
            raw=result if isinstance(result, dict) else None,
        )

    # Logat INAINTE de commit: daca scrierea pica, indexul ramane macar in log.
    log.info("ANAF a primit receipt_id=%s index_incarcare=%s", receipt.id, index)
    rec.anaf_raw_response = _serialize_raw(result)
    rec.index_incarcare = index
    rec.data_creare_anaf = str(result.get("data_creare") or "")[:20]
    rec.status = "in_prelucrare"
    rec.anaf_stare = "in prelucrare"
    rec.anaf_error_message = None
    rec.next_retry_at = datetime.now(timezone.utc) + timedelta(minutes=15)
    await db.commit()
    await db.refresh(rec)

    log.info(
        "ANAF upload OK receipt_id=%s index_incarcare=%s test=%s",
        receipt.id, rec.index_incarcare, settings.use_test_env,
    )
    return rec


async def mark_pending_upload(db: AsyncSession, receipt: Receipt) -> EFacturaRecord:
    """Creeaza/actualizeaza EFacturaRecord cu status='pending_upload' fara a face upload.

    Folosit ca sa marcam imediat bonul ca "in coada" cand userul apasa Trimite in SPV;
    upload-ul efectiv se face apoi asincron prin `upload_to_anaf_async`.

    Tranzitia e un UPDATE conditionat: reuseste doar din starile din `_resendable()`.
    Altfel ridica `EFacturaStateError` — o factura acceptata, in prelucrare sau deja
    in coada nu poate fi repusa in coada (ar pleca a doua oara la ANAF).
    """
    company, problem = await resolve_supplier(db, receipt)
    if company is None:
        raise AnafConfigError("Nu am gasit compania emitenta a facturii.")
    if problem:
        raise AnafConfigError(problem)
    rec = await get_or_create_record(db, receipt, company)
    await db.flush()
    old_index = rec.index_incarcare
    queued = await db.execute(
        update(EFacturaRecord)
        .where(EFacturaRecord.id == rec.id, _resendable())
        .values(
            status="pending_upload",
            anaf_stare=STARE_QUEUED,
            anaf_error_message=None,
            last_attempt_at=datetime.now(timezone.utc),
            **_SUPERSEDED,
        )
        .execution_options(synchronize_session=False)
    )
    was_queued = queued.rowcount == 1
    await db.commit()
    await db.refresh(rec)
    if not was_queued:
        raise EFacturaStateError(
            f"Factura este deja in flux ANAF (status: {rec.status}) si nu poate fi retrimisa."
        )
    if old_index is not None:
        # Indexul sters din record ramane macar in log.
        log.info(
            "Retrimitere receipt_id=%s: inlocuieste incarcarea index_incarcare=%s",
            receipt.id, old_index,
        )
    return rec


async def expire_stuck_uploads(
    db: AsyncSession, *, company_id: int | None = None, record_id: int | None = None
) -> int:
    """Scoate din 'pending_upload' facturile abandonate de peste CLAIM_TIMEOUT.

    Fara asta, un proces repornit in timpul trimiterii lasa bonul blocat pe
    „Se trimite..." fara nicio cale de iesire din UI. Nu retrimite nimic: muta
    record-ul in 'error', de unde operatorul decide.
      - in coada si nepreluat -> sigur netrimis (MSG_NOT_STARTED)
      - preluat si abandonat, sau ramas de la versiunea veche (fara sub-stare)
        -> rezultat necunoscut (MSG_UNKNOWN)
    """
    now = datetime.now(timezone.utc)
    scope = [
        EFacturaRecord.status == "pending_upload",
        EFacturaRecord.direction == "sent",
        or_(
            EFacturaRecord.last_attempt_at.is_(None),
            EFacturaRecord.last_attempt_at < now - CLAIM_TIMEOUT,
        ),
    ]
    if company_id is not None:
        scope.append(EFacturaRecord.company_id == company_id)
    if record_id is not None:
        scope.append(EFacturaRecord.id == record_id)

    not_started = (
        await db.execute(
            update(EFacturaRecord)
            .where(*scope, EFacturaRecord.anaf_stare == STARE_QUEUED)
            .values(status="error", anaf_stare=None, anaf_error_message=MSG_NOT_STARTED)
            .execution_options(synchronize_session=False)
        )
    ).rowcount or 0
    unknown = (
        await db.execute(
            update(EFacturaRecord)
            .where(*scope)
            .values(status="error", anaf_stare=STARE_UNKNOWN, anaf_error_message=MSG_UNKNOWN)
            .execution_options(synchronize_session=False)
        )
    ).rowcount or 0
    if not_started or unknown:
        await db.commit()
        log.warning(
            "expire_stuck_uploads: %d netrimise, %d cu rezultat necunoscut",
            not_started, unknown,
        )
    return not_started + unknown


async def upload_to_anaf_async(receipt_id: int, account_id: int) -> None:
    """Background task: deschide propria sesiune si efectueaza upload-ul.

    Nu raise — orice exceptie e logata, iar starea record-ului ramane reflectata in DB.
    Notifica broadcasterul la final ca SSE sa actualizeze UI-ul.
    """
    from app.database import AsyncSessionLocal
    from app.broadcaster import broadcaster

    async with AsyncSessionLocal() as db:
        try:
            receipt = (await db.execute(
                select(Receipt).where(
                    Receipt.id == receipt_id,
                    Receipt.account_id == account_id,
                )
            )).scalar_one_or_none()
            if receipt is None:
                log.warning("upload_to_anaf_async: receipt %s not found", receipt_id)
                return
            try:
                await prepare_and_upload(db, receipt)
            except EFacturaError as exc:
                log.info(
                    "upload_to_anaf_async: receipt=%s terminat cu eroare (%s)",
                    receipt_id, exc,
                )
            except Exception as exc:  # noqa: BLE001
                log.exception(
                    "upload_to_anaf_async: receipt=%s exceptie neasteptata: %s",
                    receipt_id, exc,
                )
        finally:
            try:
                broadcaster.notify(account_id)
            except Exception as exc:  # noqa: BLE001
                log.warning("broadcaster.notify failed: %s", exc)


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
