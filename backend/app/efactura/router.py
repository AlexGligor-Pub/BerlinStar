"""User-facing endpoints for eFactura ANAF integration.

Mount: /api/efactura/*
"""
from __future__ import annotations

import logging
import os
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Request
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_account_id
from app.efactura import oauth_service, service as efactura_service
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
    AnafTokenStatus,
    EFacturaRecordOut,
    MappingAuditEntry,
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


# Front-end redirect after callback — set in env, fallback to localhost dev
_FRONTEND_CALLBACK_REDIRECT = os.getenv(
    "ANAF_FRONTEND_CALLBACK_REDIRECT", "http://localhost:2000/adminv2?section=efactura"
)


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
    try:
        token = await oauth_service.handle_callback(db, code=code, state=state)
    except AnafAuthError as exc:
        log.warning("OAuth callback failed: %s", exc)
        return RedirectResponse(
            f"{_FRONTEND_CALLBACK_REDIRECT}&anaf_status=error&anaf_msg={str(exc)[:200]}",
            status_code=302,
        )
    except AnafConfigError as exc:
        log.warning("OAuth callback config error: %s", exc)
        return RedirectResponse(
            f"{_FRONTEND_CALLBACK_REDIRECT}&anaf_status=config_error&anaf_msg={str(exc)[:200]}",
            status_code=302,
        )
    return RedirectResponse(
        f"{_FRONTEND_CALLBACK_REDIRECT}&anaf_status=ok&anaf_company_id={token.company_id}",
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
    """Genereaza XML pentru receipt si il transmite la ANAF.

    Returneaza EFacturaRecord cu index_incarcare daca uploadul reuseste.
    """
    receipt = (
        await db.execute(
            select(Receipt).where(Receipt.id == receipt_id, Receipt.account_id == account_id)
        )
    ).scalar_one_or_none()
    if receipt is None:
        raise HTTPException(404, "Receipt-ul nu exista.")

    try:
        rec = await efactura_service.prepare_and_upload(db, receipt)
    except AnafValidationError as exc:
        raise HTTPException(422, "Validare esuata: " + "; ".join(exc.issues))
    except AnafUploadError as exc:
        raise HTTPException(400, f"ANAF a respins factura: {exc}")
    except AnafTokenMissing as exc:
        raise HTTPException(401, str(exc))
    except AnafTokenExpired as exc:
        raise HTTPException(401, f"Token expirat: {exc}. Reconnect cu USB necesar.")
    except AnafConfigError as exc:
        raise HTTPException(400, str(exc))
    except EFacturaError as exc:
        raise HTTPException(500, str(exc))

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
    """Reincearca uploadul unei facturi respinse/erronate."""
    receipt = (
        await db.execute(
            select(Receipt).where(Receipt.id == receipt_id, Receipt.account_id == account_id)
        )
    ).scalar_one_or_none()
    if receipt is None:
        raise HTTPException(404, "Receipt-ul nu exista.")

    try:
        rec = await efactura_service.prepare_and_upload(db, receipt)
    except AnafValidationError as exc:
        raise HTTPException(422, "Validare esuata: " + "; ".join(exc.issues))
    except AnafUploadError as exc:
        raise HTTPException(400, f"ANAF a respins factura: {exc}")
    except (AnafConfigError, AnafTokenMissing) as exc:
        raise HTTPException(400, str(exc))
    except EFacturaError as exc:
        raise HTTPException(500, str(exc))
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


@router.get("/companies/{company_id}/records", response_model=list[EFacturaRecordOut])
async def list_company_records(
    company_id: int = Path(..., gt=0),
    account_id: int = Depends(get_account_id),
    limit: int = Query(default=100, ge=1, le=500),
    status_filter: str | None = Query(default=None, alias="status"),
    db: AsyncSession = Depends(get_db),
):
    """Listeaza transmiterile companiei (sortat descrescator dupa data)."""
    await _require_company_access(db, company_id, account_id)
    q = select(EFacturaRecord).where(EFacturaRecord.company_id == company_id)
    if status_filter:
        q = q.where(EFacturaRecord.status == status_filter)
    q = q.order_by(EFacturaRecord.id.desc()).limit(limit)
    return (await db.execute(q)).scalars().all()


@router.get("/companies/{company_id}/received")
async def list_received_invoices(
    company_id: int = Path(..., gt=0),
    account_id: int = Depends(get_account_id),
    limit: int = Query(default=100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
):
    """Listeaza facturile primite din SPV (cache din efactura_received_index)."""
    await _require_company_access(db, company_id, account_id)
    rows = (
        await db.execute(
            select(EFacturaReceivedIndex)
            .where(EFacturaReceivedIndex.company_id == company_id)
            .order_by(EFacturaReceivedIndex.id.desc())
            .limit(limit)
        )
    ).scalars().all()
    return [
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
            "response_zip_s3_key": r.response_zip_s3_key,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]


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
