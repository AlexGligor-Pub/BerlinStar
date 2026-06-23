"""User-facing endpoints for eFactura ANAF integration.

Mount: /api/efactura/*
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Request

from app.broadcaster import broadcaster
from fastapi.responses import RedirectResponse
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_account_id
from app.efactura import oauth_service, runtime_config, service as efactura_service
from app.efactura.anaf_client import AnafEFacturaClient
from app.efactura.exceptions import (
    AnafAuthError,
    AnafConfigError,
    AnafTokenExpired,
    AnafTokenMissing,
    AnafUploadError,
    AnafValidationError,
    EFacturaError,
)
from app.efactura.mapping import build_invoice_payload
from app.efactura.models import AnafSettings, AnafToken, EFacturaRecord, EFacturaReceivedIndex
from app.efactura.schemas import (
    AnafSettingsOut,
    AnafSettingsUpdate,
    AnafTokenStatus,
    CompanyEFacturaSummary,
    EFacturaRecordOut,
    InvoiceDetailsOutSchema,
    MappingAuditEntry,
    MarkPaidIn,
    MarkPaidOut,
    MarkReadOut,
    PaginatedReceivedOut,
    PaginatedRecordsOut,
    ValidationIssue,
    ValidationResult,
)
from app.efactura.xml_builder import build_xml, pretty_print
from app.models.client import Client
from app.models.company import Company
from app.models.receipt import Receipt
from fastapi.responses import PlainTextResponse, StreamingResponse

log = logging.getLogger("berlinstar.efactura")

router = APIRouter()

# Strong refs pentru background tasks: fara asta, GC poate elimina task-ul
# in mijlocul rularii (vezi docs asyncio.create_task). Discard on done.
_BG_TASKS: set[asyncio.Task] = set()


def _spawn_bg(coro) -> asyncio.Task:
    task = asyncio.create_task(coro)
    _BG_TASKS.add(task)
    task.add_done_callback(_BG_TASKS.discard)
    return task


def _append_query(base: str, extra: str) -> str:
    """Append `extra` (key=val&key=val) to `base`, picking the right separator."""
    sep = "&" if "?" in base else "?"
    return f"{base}{sep}{extra}"


async def _require_company_access(
    db: AsyncSession, company_id: int, account_id: int
) -> Company:
    """Ensure caller's account owns the given company (or admin)."""
    company = (
        await db.execute(select(Company).where(Company.id == company_id))
    ).scalar_one_or_none()
    if company is None:
        raise HTTPException(404, "Compania nu exista.")
    # Super-admin always has access; otherwise must match account_id
    if company.account_id != account_id:
        # check admin flag via account username (simple gate matching admin.py)
        from app.models.account import Account
        acc = (await db.execute(select(Account).where(Account.id == account_id))).scalar_one_or_none()
        if acc is None or acc.username != "admin":
            raise HTTPException(403, "Acces interzis la aceasta companie.")
    return company


# ---------- Self-service endpoints (per-account) ----------

def _settings_to_out(row: AnafSettings) -> AnafSettingsOut:
    return AnafSettingsOut(
        id=row.id,
        company_id=row.company_id,
        use_test_env=row.use_test_env,
        payment_terms_days=row.payment_terms_days,
        default_invoice_type=row.default_invoice_type,
        auto_upload=row.auto_upload,
        auto_upload_delay_minutes=row.auto_upload_delay_minutes,
        deadline_alert_email=row.deadline_alert_email,
        validate_schematron=row.validate_schematron,
        last_sync_at=row.last_sync_at,
    )


def _token_status_for(token: AnafToken | None, company_id: int) -> AnafTokenStatus:
    if token is None:
        return AnafTokenStatus(company_id=company_id, connected=False, state="disconnected")
    expires_at = token.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    delta = (expires_at - datetime.now(timezone.utc)).days
    if delta < 0:
        state = "expired"
    elif delta <= 14:
        state = "expiring_soon"
    else:
        state = "connected"
    return AnafTokenStatus(
        company_id=company_id,
        connected=delta >= 0,
        expires_at=expires_at,
        days_until_expiry=delta,
        state=state,  # type: ignore[arg-type]
    )


@router.get("/my-companies", response_model=list[CompanyEFacturaSummary])
async def list_my_companies(
    account_id: int = Depends(get_account_id),
    db: AsyncSession = Depends(get_db),
):
    """Listeaza companiile contului curent cu setarile ANAF si statusul OAuth (USB)."""
    companies = (
        await db.execute(
            select(Company)
            .where(Company.account_id == account_id, Company.is_deleted == False)
            .order_by(Company.name)
        )
    ).scalars().all()
    if not companies:
        return []
    ids = [c.id for c in companies]
    settings_map = {
        s.company_id: s
        for s in (
            await db.execute(select(AnafSettings).where(AnafSettings.company_id.in_(ids)))
        ).scalars().all()
    }
    tokens_map = {
        t.company_id: t
        for t in (
            await db.execute(select(AnafToken).where(AnafToken.company_id.in_(ids)))
        ).scalars().all()
    }
    return [
        CompanyEFacturaSummary(
            company_id=c.id,
            account_id=c.account_id,
            name=c.name,
            cui=c.cui,
            is_vat_payer=c.is_vat_payer,
            settings=_settings_to_out(settings_map[c.id]) if c.id in settings_map else None,
            token_status=_token_status_for(tokens_map.get(c.id), c.id),
        )
        for c in companies
    ]


@router.get("/companies/{company_id}/settings", response_model=AnafSettingsOut)
async def get_my_company_settings(
    company_id: int = Path(..., gt=0),
    account_id: int = Depends(get_account_id),
    db: AsyncSession = Depends(get_db),
):
    """Returneaza setarile ANAF ale unei companii detinute de cont (auto-creeaza daca lipsesc)."""
    await _require_company_access(db, company_id, account_id)
    row = (
        await db.execute(select(AnafSettings).where(AnafSettings.company_id == company_id))
    ).scalar_one_or_none()
    if row is None:
        row = AnafSettings(company_id=company_id)
        db.add(row)
        await db.commit()
        await db.refresh(row)
    return _settings_to_out(row)


@router.patch("/companies/{company_id}/settings", response_model=AnafSettingsOut)
async def update_my_company_settings(
    body: AnafSettingsUpdate,
    company_id: int = Path(..., gt=0),
    account_id: int = Depends(get_account_id),
    db: AsyncSession = Depends(get_db),
):
    """User-level update pentru AnafSettings. Acces doar pentru proprietarul contului."""
    await _require_company_access(db, company_id, account_id)
    row = (
        await db.execute(select(AnafSettings).where(AnafSettings.company_id == company_id))
    ).scalar_one_or_none()
    if row is None:
        row = AnafSettings(company_id=company_id)
        db.add(row)
        await db.flush()

    data = body.model_dump(exclude_unset=True)
    for k, v in data.items():
        if hasattr(row, k):
            setattr(row, k, v)

    row.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(row)
    return _settings_to_out(row)


@router.post("/companies/{company_id}/test-connection")
async def test_my_company_connection(
    company_id: int = Path(..., gt=0),
    account_id: int = Depends(get_account_id),
    db: AsyncSession = Depends(get_db),
):
    """Smoke-test al conexiunii ANAF pentru o companie a contului (refresh-uieste tokenul daca expira curand)."""
    await _require_company_access(db, company_id, account_id)
    try:
        await oauth_service.get_valid_access_token(db, company_id)
    except AnafTokenMissing:
        return {"ok": False, "detail": "Compania nu este conectata la ANAF. Apasa Connect cu USB-ul plugat."}
    except AnafTokenExpired:
        return {"ok": False, "detail": "Token-ul ANAF a expirat. Reconnect cu USB necesar."}
    except AnafConfigError as exc:
        return {"ok": False, "detail": f"Configurare incompleta: {exc}"}
    except AnafAuthError as exc:
        return {"ok": False, "detail": f"Eroare ANAF: {exc}"}
    return {"ok": True, "detail": "Token ANAF valid (refresh-ul automat functioneaza)."}


# ---------- Connect / Disconnect ----------

@router.post("/companies/{company_id}/connect")
async def connect_company(
    company_id: int = Path(..., gt=0),
    account_id: int = Depends(get_account_id),
    db: AsyncSession = Depends(get_db),
):
    """Genereaza URL-ul de redirect catre ANAF pentru autentificare cu USB."""
    await _require_company_access(db, company_id, account_id)
    try:
        url = await oauth_service.build_authorize_url(db, company_id)
    except AnafConfigError as exc:
        raise HTTPException(400, str(exc))
    return {"authorize_url": url}


@router.get("/callback")
async def oauth_callback(
    request: Request,
    code: str = Query(...),
    state: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """Endpoint callback ANAF — primeste authorization code si finalizeaza fluxul OAuth.

    Acest endpoint NU este protejat cu JWT — securitatea vine prin state JWT semnat
    pe care l-am generat la /connect.
    """
    cfg = await runtime_config.load(db)
    frontend_cb = cfg.frontend_callback_redirect
    try:
        token = await oauth_service.handle_callback(db, code=code, state=state)
    except AnafAuthError as exc:
        log.warning("OAuth callback failed: %s", exc)
        return RedirectResponse(
            _append_query(frontend_cb, f"anaf_status=error&anaf_msg={str(exc)[:200]}"),
            status_code=302,
        )
    except AnafConfigError as exc:
        log.warning("OAuth callback config error: %s", exc)
        return RedirectResponse(
            _append_query(frontend_cb, f"anaf_status=config_error&anaf_msg={str(exc)[:200]}"),
            status_code=302,
        )
    return RedirectResponse(
        _append_query(frontend_cb, f"anaf_status=ok&anaf_company_id={token.company_id}"),
        status_code=302,
    )


@router.post("/companies/{company_id}/disconnect")
async def disconnect_company(
    company_id: int = Path(..., gt=0),
    account_id: int = Depends(get_account_id),
    db: AsyncSession = Depends(get_db),
):
    await _require_company_access(db, company_id, account_id)
    removed = await oauth_service.revoke(db, company_id)
    return {"ok": True, "removed": removed}


# ---------- Status ----------

@router.get("/companies/{company_id}/status", response_model=AnafTokenStatus)
async def get_company_status(
    company_id: int = Path(..., gt=0),
    account_id: int = Depends(get_account_id),
    db: AsyncSession = Depends(get_db),
):
    await _require_company_access(db, company_id, account_id)
    token = (
        await db.execute(select(AnafToken).where(AnafToken.company_id == company_id))
    ).scalar_one_or_none()
    if token is None:
        return AnafTokenStatus(company_id=company_id, connected=False, state="disconnected")
    expires_at = token.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    delta = (expires_at - datetime.now(timezone.utc)).days
    if delta < 0:
        state = "expired"
    elif delta <= 14:
        state = "expiring_soon"
    else:
        state = "connected"
    return AnafTokenStatus(
        company_id=company_id,
        connected=delta >= 0,
        expires_at=expires_at,
        days_until_expiry=delta,
        state=state,  # type: ignore[arg-type]
    )


@router.post("/receipts/{receipt_id}/validate", response_model=ValidationResult)
async def validate_receipt(
    receipt_id: int = Path(..., gt=0),
    account_id: int = Depends(get_account_id),
    db: AsyncSession = Depends(get_db),
):
    """Ruleaza validarile pre-upload fara a transmite la ANAF.

    Returneaza lista de erori (blocheaza upload) + warnings (sa fie corectate, dar nu blocheaza).
    """
    receipt = (
        await db.execute(
            select(Receipt).where(Receipt.id == receipt_id, Receipt.account_id == account_id)
        )
    ).scalar_one_or_none()
    if receipt is None:
        raise HTTPException(404, "Receipt-ul nu exista.")

    company = await _resolve_supplier_company(db, account_id, receipt)
    if company is None:
        raise HTTPException(400, "Nu am gasit compania emitenta pentru aceasta factura.")

    client = receipt.client

    errors: list[ValidationIssue] = []
    warnings: list[ValidationIssue] = []
    try:
        payload = build_invoice_payload(receipt, company, client, raise_on_error=False)
        for issue in payload.issues:
            warnings.append(ValidationIssue(field="—", message=issue, severity="warning"))
    except AnafValidationError as exc:
        for msg in exc.issues:
            errors.append(ValidationIssue(field="—", message=msg, severity="error"))

    return ValidationResult(
        receipt_id=receipt_id,
        is_valid=len(errors) == 0,
        errors=errors,
        warnings=warnings,
    )


@router.get("/receipts/{receipt_id}/xml", response_class=PlainTextResponse)
async def preview_receipt_xml(
    receipt_id: int = Path(..., gt=0),
    account_id: int = Depends(get_account_id),
    db: AsyncSession = Depends(get_db),
):
    """Genereaza XML UBL 2.1 pentru receipt (preview / debugging) fara a transmite."""
    receipt = (
        await db.execute(
            select(Receipt).where(Receipt.id == receipt_id, Receipt.account_id == account_id)
        )
    ).scalar_one_or_none()
    if receipt is None:
        raise HTTPException(404, "Receipt-ul nu exista.")

    company = await _resolve_supplier_company(db, account_id, receipt)
    if company is None:
        raise HTTPException(400, "Nu am gasit compania emitenta.")

    try:
        payload = build_invoice_payload(receipt, company, receipt.client, raise_on_error=True)
    except AnafValidationError as exc:
        raise HTTPException(422, "Validare esuata: " + "; ".join(exc.issues))

    try:
        xml = build_xml(payload)
    except EFacturaError as exc:
        raise HTTPException(500, str(exc))

    return PlainTextResponse(pretty_print(xml), media_type="application/xml")


@router.get("/companies/{company_id}/audit", response_model=list[MappingAuditEntry])
async def audit_mapping(
    company_id: int = Path(..., gt=0),
    account_id: int = Depends(get_account_id),
    limit: int = Query(default=50, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
):
    """Listeaza receipts cu campuri incomplete pentru eFactura (TVA, adresa, etc.)."""
    company = await _require_company_access(db, company_id, account_id)

    receipts = (
        await db.execute(
            select(Receipt)
            .where(
                Receipt.account_id == company.account_id,
                Receipt.is_deleted == False,
                Receipt.factura_nr > 0,
            )
            .order_by(Receipt.id.desc())
            .limit(limit)
        )
    ).scalars().all()

    out: list[MappingAuditEntry] = []
    for r in receipts:
        try:
            payload = build_invoice_payload(r, company, r.client, raise_on_error=False)
            issues = list(payload.issues)
        except AnafValidationError as exc:
            issues = list(exc.issues)

        # Verificari sumare pentru audit
        if r.client is None:
            issues.append("Client lipseste pe factura.")
        if not r.receipt_items:
            issues.append("Factura nu are linii.")
        for item in r.receipt_items:
            if item.vat_percent is None and not company.tva_percentage:
                issues.append(f"Linia '{item.name}' nu are vat_percent setat.")

        if issues:
            out.append(
                MappingAuditEntry(
                    receipt_id=r.id,
                    factura_serie=r.factura_serie,
                    factura_nr=r.factura_nr,
                    titlu=r.titlu,
                    issues=issues,
                )
            )
    return out


async def _resolve_supplier_company(
    db: AsyncSession, account_id: int, receipt: Receipt
) -> Company | None:
    """Gaseste Company pentru receipt.

    Logica:
    - Daca receipt.location_id e setat -> Location.company_id
    - Altfel prima companie a account-ului
    """
    if receipt.location_id:
        from app.models.location import Location

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
            .where(Company.account_id == account_id, Company.is_deleted == False)
            .order_by(Company.id)
            .limit(1)
        )
    ).scalar_one_or_none()


@router.post("/receipts/{receipt_id}/upload", response_model=EFacturaRecordOut)
async def upload_receipt(
    receipt_id: int = Path(..., gt=0),
    account_id: int = Depends(get_account_id),
    db: AsyncSession = Depends(get_db),
):
    """Marcheaza bonul ca pending_upload si lanseaza upload-ul asincron in background.

    Endpoint-ul returneaza in <200ms cu status='pending_upload'. Upload-ul efectiv catre
    ANAF se face printr-un background task (`asyncio.create_task`) care:
      - construieste XML, valideaza, obtine OAuth token, face POST la ANAF
      - actualizeaza EFacturaRecord (status=in_prelucrare / rejected / error)
      - notifica frontend-ul via SSE (broadcaster.notify)

    Daca factura a fost trimisa deja (status NOT in {error fara index}), endpoint-ul
    refuza retrimiterea pentru a evita dubluri (foloseste /retry pentru reincercari).
    """
    receipt = (
        await db.execute(
            select(Receipt).where(Receipt.id == receipt_id, Receipt.account_id == account_id)
        )
    ).scalar_one_or_none()
    if receipt is None:
        raise HTTPException(404, "Receipt-ul nu exista.")
    if receipt.factura_nr == 0:
        raise HTTPException(400, "Bonul nu are numar de factura alocat. Apasa 'Factureaza' mai intai.")
    if receipt.client_id is None:
        raise HTTPException(400, "Bonul nu are client asociat. Aloca un client inainte de trimitere.")

    existing = (
        await db.execute(
            select(EFacturaRecord).where(
                EFacturaRecord.receipt_id == receipt_id,
                EFacturaRecord.direction == "sent",
            )
        )
    ).scalar_one_or_none()
    # Blocam retrimiterea doar daca factura e efectiv in flux ANAF. Un 'in_prelucrare'
    # FARA index_incarcare e un record blocat (upload-ul nu a primit niciodata index de la
    # ANAF) — il lasam retrimisibil ca sa nu ramana captiv (vezi fix-ul 200-fara-index).
    # Nota: in timpul unui upload sanatos record-ul e 'pending_upload' (blocat aici), iar
    # 'in_prelucrare' se scrie odata cu index_incarcare — deci fereastra de retrimitere
    # accidentala a unui upload in curs e neglijabila. Pentru reincercare folositi /retry.
    in_flux = existing is not None and (
        existing.status in ("pending_upload", "accepted", "rejected")
        or (existing.status == "in_prelucrare" and existing.index_incarcare is not None)
    )
    if in_flux:
        raise HTTPException(
            409,
            f"Factura este deja in flux ANAF (status: {existing.status}). Foloseste /retry pentru reincercare.",
        )

    try:
        rec = await efactura_service.mark_pending_upload(db, receipt)
    except AnafConfigError as exc:
        raise HTTPException(400, str(exc))
    except EFacturaError as exc:
        raise HTTPException(500, str(exc))

    _spawn_bg(efactura_service.upload_to_anaf_async(receipt_id, account_id))
    broadcaster.notify(account_id)
    return rec


@router.get("/receipts/{receipt_id}/status", response_model=EFacturaRecordOut)
async def get_receipt_status(
    receipt_id: int = Path(..., gt=0),
    account_id: int = Depends(get_account_id),
    db: AsyncSession = Depends(get_db),
):
    """Returneaza statusul curent + ANAF check fresh daca e in prelucrare."""
    receipt = (
        await db.execute(
            select(Receipt).where(Receipt.id == receipt_id, Receipt.account_id == account_id)
        )
    ).scalar_one_or_none()
    if receipt is None:
        raise HTTPException(404, "Receipt-ul nu exista.")

    rec = (
        await db.execute(
            select(EFacturaRecord).where(
                EFacturaRecord.receipt_id == receipt_id,
                EFacturaRecord.direction == "sent",
            )
        )
    ).scalar_one_or_none()
    if rec is None:
        raise HTTPException(404, "Aceasta factura nu a fost transmisa la ANAF.")

    if rec.status == "in_prelucrare" and rec.index_incarcare:
        try:
            rec = await efactura_service.poll_status(db, rec)
        except (AnafAuthError, EFacturaError) as exc:
            log.warning("poll_status failed for rec=%s: %s", rec.id, exc)
    return rec


@router.post("/receipts/{receipt_id}/retry", response_model=EFacturaRecordOut)
async def retry_receipt(
    receipt_id: int = Path(..., gt=0),
    account_id: int = Depends(get_account_id),
    db: AsyncSession = Depends(get_db),
):
    """Reincearca uploadul unei facturi respinse/erronate (asincron in background)."""
    receipt = (
        await db.execute(
            select(Receipt).where(Receipt.id == receipt_id, Receipt.account_id == account_id)
        )
    ).scalar_one_or_none()
    if receipt is None:
        raise HTTPException(404, "Receipt-ul nu exista.")

    try:
        rec = await efactura_service.mark_pending_upload(db, receipt)
    except AnafConfigError as exc:
        raise HTTPException(400, str(exc))
    except EFacturaError as exc:
        raise HTTPException(500, str(exc))

    _spawn_bg(efactura_service.upload_to_anaf_async(receipt_id, account_id))
    broadcaster.notify(account_id)
    return rec


@router.get("/receipts/{receipt_id}/download")
async def download_response_zip(
    receipt_id: int = Path(..., gt=0),
    account_id: int = Depends(get_account_id),
    db: AsyncSession = Depends(get_db),
):
    """Descarca ZIP-ul de raspuns ANAF (cu sigiliu electronic)."""
    receipt = (
        await db.execute(
            select(Receipt).where(Receipt.id == receipt_id, Receipt.account_id == account_id)
        )
    ).scalar_one_or_none()
    if receipt is None:
        raise HTTPException(404, "Receipt-ul nu exista.")

    rec = (
        await db.execute(
            select(EFacturaRecord).where(
                EFacturaRecord.receipt_id == receipt_id,
                EFacturaRecord.direction == "sent",
            )
        )
    ).scalar_one_or_none()
    if rec is None or not rec.download_id:
        raise HTTPException(404, "Nu exista raspuns ANAF descarcabil pentru aceasta factura.")

    settings = (
        await db.execute(select(AnafSettings).where(AnafSettings.company_id == rec.company_id))
    ).scalar_one_or_none()
    if settings is None:
        raise HTTPException(400, "Setari ANAF inexistente.")

    access_token = await oauth_service.get_valid_access_token(db, rec.company_id)
    client = AnafEFacturaClient(access_token, rec.cui, use_test=settings.use_test_env)
    try:
        zip_bytes = await client.download_response(rec.download_id)
    except EFacturaError as exc:
        raise HTTPException(502, str(exc))

    from io import BytesIO

    return StreamingResponse(
        BytesIO(zip_bytes),
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="anaf_response_{rec.index_incarcare or rec.id}.zip"'
        },
    )


@router.get("/companies/{company_id}/records", response_model=PaginatedRecordsOut)
async def list_company_records(
    company_id: int = Path(..., gt=0),
    account_id: int = Depends(get_account_id),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=200),
    status_filter: str | None = Query(default=None, alias="status"),
    search: str | None = Query(default=None),
    date_from: str | None = Query(default=None, description="ISO yyyy-mm-dd"),
    date_to: str | None = Query(default=None, description="ISO yyyy-mm-dd"),
    db: AsyncSession = Depends(get_db),
):
    """Listeaza transmiterile companiei (paginat, sortat descrescator dupa id)."""
    from sqlalchemy import func, or_, cast, String

    await _require_company_access(db, company_id, account_id)
    base = select(EFacturaRecord).where(EFacturaRecord.company_id == company_id)

    if status_filter:
        base = base.where(EFacturaRecord.status == status_filter)
    if search:
        like = f"%{search.strip()}%"
        base = base.where(
            or_(
                cast(EFacturaRecord.index_incarcare, String).ilike(like),
                EFacturaRecord.anaf_stare.ilike(like),
                EFacturaRecord.status.ilike(like),
            )
        )
    if date_from:
        try:
            df = datetime.strptime(date_from, "%Y-%m-%d").date()
            base = base.where(EFacturaRecord.invoice_issue_date >= df)
        except ValueError:
            pass
    if date_to:
        try:
            dt = datetime.strptime(date_to, "%Y-%m-%d").date()
            base = base.where(EFacturaRecord.invoice_issue_date <= dt)
        except ValueError:
            pass

    total = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar_one()
    offset = (page - 1) * page_size
    rows = (
        await db.execute(
            base.order_by(EFacturaRecord.id.desc()).offset(offset).limit(page_size)
        )
    ).scalars().all()
    return PaginatedRecordsOut(
        items=[EFacturaRecordOut.model_validate(r) for r in rows],
        total=int(total),
        page=page,
        page_size=page_size,
    )


# Sursa unica de adevar pentru ce coloane pot fi sortate pe `received`. FE-ul nu mai
# duplica lista: orice key necunoscut cade silent in fallback la id.desc() in handler.
_RECEIVED_SORT_COLUMNS = {
    "id": EFacturaReceivedIndex.id,
    "nume_emitent": EFacturaReceivedIndex.nume_emitent,
    "cif_emitent": EFacturaReceivedIndex.cif_emitent,
    "data_creare": EFacturaReceivedIndex.data_creare,
    "tip": EFacturaReceivedIndex.tip,
    "detalii": EFacturaReceivedIndex.detalii,
    "downloaded": EFacturaReceivedIndex.downloaded,
    "is_read": EFacturaReceivedIndex.is_read,
    "paid": EFacturaReceivedIndex.paid,
    "paid_at": EFacturaReceivedIndex.paid_at,
    "created_at": EFacturaReceivedIndex.created_at,
}


@router.get("/companies/{company_id}/received", response_model=PaginatedReceivedOut)
async def list_received_invoices(
    company_id: int = Path(..., gt=0),
    account_id: int = Depends(get_account_id),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=200),
    search: str | None = Query(default=None),
    is_read: bool | None = Query(default=None),
    paid: bool | None = Query(default=None),
    date_from: str | None = Query(default=None, description="ISO yyyy-mm-dd"),
    date_to: str | None = Query(default=None, description="ISO yyyy-mm-dd"),
    sort: str | None = Query(
        default=None,
        description="Ordonare: <coloana>:<asc|desc>. Coloane permise: id, nume_emitent, "
        "cif_emitent, data_creare, tip, detalii, downloaded, is_read, paid, paid_at, created_at.",
    ),
    db: AsyncSession = Depends(get_db),
):
    """Listeaza facturile primite din SPV (paginat, cu filtre + sortare)."""
    from sqlalchemy import func, or_

    await _require_company_access(db, company_id, account_id)

    base = select(EFacturaReceivedIndex).where(EFacturaReceivedIndex.company_id == company_id)

    if search:
        like = f"%{search.strip()}%"
        base = base.where(
            or_(
                EFacturaReceivedIndex.nume_emitent.ilike(like),
                EFacturaReceivedIndex.cif_emitent.ilike(like),
                EFacturaReceivedIndex.detalii.ilike(like),
            )
        )
    if is_read is not None:
        base = base.where(EFacturaReceivedIndex.is_read == is_read)
    if paid is not None:
        base = base.where(EFacturaReceivedIndex.paid == paid)
    if date_from:
        df = date_from.replace("-", "")[:8]
        if df:
            base = base.where(func.substr(EFacturaReceivedIndex.data_creare, 1, 8) >= df)
    if date_to:
        dt = date_to.replace("-", "")[:8]
        if dt:
            base = base.where(func.substr(EFacturaReceivedIndex.data_creare, 1, 8) <= dt)

    # Sortare: <col>:<asc|desc>. Fallback la id DESC daca lipseste sau e invalid.
    order_clause = EFacturaReceivedIndex.id.desc()
    if sort:
        col_name, _, direction = sort.partition(":")
        col = _RECEIVED_SORT_COLUMNS.get(col_name.strip())
        if col is not None:
            order_clause = col.asc() if direction.strip().lower() == "asc" else col.desc()
            # tie-breaker stabil pe id pentru pagini consistente
            if col_name.strip() != "id":
                order_clause = (order_clause, EFacturaReceivedIndex.id.desc())

    total = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar_one()
    unread_count = (
        await db.execute(
            select(func.count())
            .select_from(EFacturaReceivedIndex)
            .where(
                EFacturaReceivedIndex.company_id == company_id,
                EFacturaReceivedIndex.is_read == False,  # noqa: E712
            )
        )
    ).scalar_one()
    offset = (page - 1) * page_size
    query = base.offset(offset).limit(page_size)
    if isinstance(order_clause, tuple):
        query = query.order_by(*order_clause)
    else:
        query = query.order_by(order_clause)
    rows = (await db.execute(query)).scalars().all()

    return PaginatedReceivedOut(
        items=[
            {
                "id": r.id,
                "id_solicitare": r.id_solicitare,
                "tip": r.tip,
                "data_creare": r.data_creare,
                "cif_emitent": r.cif_emitent,
                "nume_emitent": r.nume_emitent,
                "cif_beneficiar": r.cif_beneficiar,
                "nume_beneficiar": r.nume_beneficiar,
                "detalii": r.detalii,
                "downloaded": r.downloaded,
                "is_read": r.is_read,
                "read_at": r.read_at,
                "paid": r.paid,
                "paid_at": r.paid_at,
                "response_zip_s3_key": r.response_zip_s3_key,
                "created_at": r.created_at,
            }
            for r in rows
        ],
        total=int(total),
        page=page,
        page_size=page_size,
        unread_count=int(unread_count),
    )


@router.get(
    "/companies/{company_id}/received/{received_id}/details",
    response_model=InvoiceDetailsOutSchema,
)
async def get_received_details(
    company_id: int = Path(..., gt=0),
    received_id: int = Path(..., gt=0),
    account_id: int = Depends(get_account_id),
    db: AsyncSession = Depends(get_db),
):
    """Returneaza detaliile parsate ale unei facturi primite.

    Daca ZIP-ul nu este in S3, il descarca de la ANAF mai intai.
    """
    from app.efactura.received_parser import (
        UBLParseError,
        extract_invoice_xml_from_zip,
        parse_ubl_invoice,
    )

    await _require_company_access(db, company_id, account_id)
    idx = (
        await db.execute(
            select(EFacturaReceivedIndex).where(
                EFacturaReceivedIndex.id == received_id,
                EFacturaReceivedIndex.company_id == company_id,
            )
        )
    ).scalar_one_or_none()
    if idx is None:
        raise HTTPException(404, "Factura primita inexistenta.")

    try:
        zip_bytes = await efactura_service.ensure_received_downloaded(db, idx)
    except AnafTokenMissing:
        raise HTTPException(401, "Token ANAF inexistent.")
    except AnafTokenExpired:
        raise HTTPException(401, "Token expirat. Reconnect cu USB necesar.")
    except AnafConfigError as exc:
        raise HTTPException(400, str(exc))
    except EFacturaError as exc:
        raise HTTPException(502, str(exc))

    try:
        xml_bytes = extract_invoice_xml_from_zip(zip_bytes)
        details = parse_ubl_invoice(xml_bytes)
    except UBLParseError as exc:
        raise HTTPException(422, f"XML factura ilizibil: {exc}")

    return details.to_dict()


@router.post(
    "/companies/{company_id}/received/{received_id}/mark-read",
    response_model=MarkReadOut,
)
async def mark_received_read(
    company_id: int = Path(..., gt=0),
    received_id: int = Path(..., gt=0),
    account_id: int = Depends(get_account_id),
    db: AsyncSession = Depends(get_db),
):
    """Marcheaza factura primita ca citita (idempotent, atomic)."""
    await _require_company_access(db, company_id, account_id)
    now = datetime.now(timezone.utc)
    res = await db.execute(
        update(EFacturaReceivedIndex)
        .where(
            EFacturaReceivedIndex.id == received_id,
            EFacturaReceivedIndex.company_id == company_id,
            EFacturaReceivedIndex.is_read == False,  # noqa: E712
        )
        .values(is_read=True, read_at=now)
        .returning(EFacturaReceivedIndex.id)
    )
    if res.scalar_one_or_none() is not None:
        await db.commit()
        return MarkReadOut(ok=True, is_read=True, read_at=now)

    idx = (
        await db.execute(
            select(EFacturaReceivedIndex).where(
                EFacturaReceivedIndex.id == received_id,
                EFacturaReceivedIndex.company_id == company_id,
            )
        )
    ).scalar_one_or_none()
    if idx is None:
        raise HTTPException(404, "Factura primita inexistenta.")
    return MarkReadOut(ok=True, is_read=idx.is_read, read_at=idx.read_at)


@router.post(
    "/companies/{company_id}/received/{received_id}/mark-paid",
    response_model=MarkPaidOut,
)
async def mark_received_paid(
    company_id: int = Path(..., gt=0),
    received_id: int = Path(..., gt=0),
    body: MarkPaidIn | None = None,
    account_id: int = Depends(get_account_id),
    db: AsyncSession = Depends(get_db),
):
    """Marcheaza/demarcheaza factura primita ca platita.

    Default `paid=true`. Trimite `{"paid": false}` ca sa anulezi marcarea.
    """
    await _require_company_access(db, company_id, account_id)
    target = True if body is None else bool(body.paid)
    now = datetime.now(timezone.utc)
    res = await db.execute(
        update(EFacturaReceivedIndex)
        .where(
            EFacturaReceivedIndex.id == received_id,
            EFacturaReceivedIndex.company_id == company_id,
        )
        .values(paid=target, paid_at=(now if target else None))
        .returning(EFacturaReceivedIndex.id)
    )
    if res.scalar_one_or_none() is None:
        raise HTTPException(404, "Factura primita inexistenta.")
    await db.commit()
    return MarkPaidOut(ok=True, paid=target, paid_at=(now if target else None))


@router.get("/companies/{company_id}/received/{received_id}/xml")
async def download_received_xml(
    company_id: int = Path(..., gt=0),
    received_id: int = Path(..., gt=0),
    account_id: int = Depends(get_account_id),
    db: AsyncSession = Depends(get_db),
):
    """Descarca XML-ul raw al facturii primite (extras din ZIP-ul ANAF)."""
    from app.efactura.received_parser import UBLParseError, extract_invoice_xml_from_zip

    await _require_company_access(db, company_id, account_id)
    idx = (
        await db.execute(
            select(EFacturaReceivedIndex).where(
                EFacturaReceivedIndex.id == received_id,
                EFacturaReceivedIndex.company_id == company_id,
            )
        )
    ).scalar_one_or_none()
    if idx is None:
        raise HTTPException(404, "Factura primita inexistenta.")

    try:
        zip_bytes = await efactura_service.ensure_received_downloaded(db, idx)
        xml_bytes = extract_invoice_xml_from_zip(zip_bytes)
    except (AnafTokenMissing, AnafTokenExpired) as exc:
        raise HTTPException(401, str(exc))
    except UBLParseError as exc:
        raise HTTPException(422, str(exc))
    except EFacturaError as exc:
        raise HTTPException(502, str(exc))

    from io import BytesIO

    return StreamingResponse(
        BytesIO(xml_bytes),
        media_type="application/xml",
        headers={
            "Content-Disposition": f'attachment; filename="factura_{idx.id_solicitare}.xml"'
        },
    )


@router.post("/companies/{company_id}/received/sync")
async def sync_received_for_company(
    company_id: int = Path(..., gt=0),
    account_id: int = Depends(get_account_id),
    db: AsyncSession = Depends(get_db),
):
    """Sincronizeaza facturile primite din SPV ANAF pentru aceasta companie (manual trigger).

    Pentru job-ul automat (la 60 min) vezi efactura/scheduler.job_sync_received.
    """
    await _require_company_access(db, company_id, account_id)
    from sqlalchemy.dialects.postgresql import insert as pg_insert

    token = (
        await db.execute(select(AnafToken).where(AnafToken.company_id == company_id))
    ).scalar_one_or_none()
    if token is None:
        raise HTTPException(400, "Compania nu este conectata la ANAF. Apasa Connect cu USB-ul plugat.")
    settings = (
        await db.execute(select(AnafSettings).where(AnafSettings.company_id == company_id))
    ).scalar_one_or_none()
    if settings is None:
        raise HTTPException(400, "Lipsesc setarile ANAF pentru aceasta companie.")

    try:
        access_token = await oauth_service.get_valid_access_token(db, company_id)
    except AnafTokenMissing:
        raise HTTPException(401, "Token ANAF inexistent.")
    except AnafTokenExpired:
        raise HTTPException(401, "Token expirat. Reconnect cu USB necesar.")
    except AnafConfigError as exc:
        raise HTTPException(400, str(exc))

    client = AnafEFacturaClient(access_token, str(token.cui), use_test=settings.use_test_env)
    try:
        resp = await client.list_messages(days=60, filtru="P")
    except EFacturaError as exc:
        raise HTTPException(502, str(exc))

    messages = resp.get("mesaje") or resp.get("mesajeFactura") or []
    inserted = 0
    for m in messages:
        # ANAF /descarcare?id=... foloseste campul `id` din mesaj (download id),
        # nu `id_solicitare` (care e id-ul incarcarii expeditorului). Fallback doar
        # daca lipseste `id`, pentru compatibilitate cu payload-uri vechi.
        id_sol = m.get("id") or m.get("id_solicitare")
        if not id_sol:
            continue
        stmt = pg_insert(EFacturaReceivedIndex).values(
            company_id=company_id,
            cui=str(token.cui),
            id_solicitare=int(id_sol),
            tip=m.get("tip"),
            data_creare=m.get("data_creare"),
            cif_emitent=m.get("cif_emitent") or m.get("cui"),
            nume_emitent=m.get("nume_emitent"),
            cif_beneficiar=m.get("cif_beneficiar"),
            nume_beneficiar=m.get("nume_beneficiar"),
            detalii=m.get("detalii"),
            raw_payload=m,
        ).on_conflict_do_nothing(index_elements=["company_id", "id_solicitare"])
        result = await db.execute(stmt)
        if result.rowcount:
            inserted += int(result.rowcount)

    settings.last_sync_at = datetime.now(timezone.utc)
    await db.commit()
    return {"ok": True, "messages": len(messages), "inserted": inserted}


@router.get("/companies/{company_id}/pending-deadlines", response_model=list[EFacturaRecordOut])
async def list_pending_deadlines(
    company_id: int = Path(..., gt=0),
    account_id: int = Depends(get_account_id),
    days_ahead: int = Query(default=5, ge=0, le=30),
    db: AsyncSession = Depends(get_db),
):
    """Facturi cu deadline iminent (azi sau in <days_ahead zile) si statusul != accepted."""
    await _require_company_access(db, company_id, account_id)
    from datetime import date as _date, timedelta as _td

    today = _date.today()
    end = today + _td(days=days_ahead)
    rows = (
        await db.execute(
            select(EFacturaRecord)
            .where(
                EFacturaRecord.company_id == company_id,
                EFacturaRecord.deadline_transmit <= end,
                EFacturaRecord.status != "accepted",
            )
            .order_by(EFacturaRecord.deadline_transmit.asc())
        )
    ).scalars().all()
    return rows


@router.post("/companies/{company_id}/refresh")
async def refresh_company_token(
    company_id: int = Path(..., gt=0),
    account_id: int = Depends(get_account_id),
    db: AsyncSession = Depends(get_db),
):
    """Force-refresh token-ul (util pentru debugging / verificare)."""
    await _require_company_access(db, company_id, account_id)
    try:
        await oauth_service.get_valid_access_token(db, company_id)
    except AnafTokenMissing:
        raise HTTPException(404, "Nu exista token pentru aceasta companie.")
    except AnafTokenExpired:
        raise HTTPException(401, "Token expirat. Reconnect cu USB necesar.")
    except AnafAuthError as exc:
        raise HTTPException(502, str(exc))
    return {"ok": True}
