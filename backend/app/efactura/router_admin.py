"""Admin endpoints for the eFactura ANAF module.

Mount: /api/admin/efactura/*
Auth:  super admin (username == "admin") via _require_super_admin from app.routers.admin.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Path
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.efactura import oauth_service, runtime_config, scheduler as efactura_scheduler
from app.efactura.crypto import encrypt, is_configured as fernet_configured, self_test as fernet_self_test, set_fernet_key
from app.efactura.exceptions import (
    AnafAuthError,
    AnafConfigError,
    AnafTokenExpired,
    AnafTokenMissing,
)
from app.efactura.models import AnafSettings, AnafToken, EFacturaGlobalSettings, EFacturaRecord
from app.efactura.schemas import (
    AnafSettingsOut,
    AnafSettingsUpdate,
    AnafTokenStatus,
    CompanyEFacturaSummary,
    EFacturaGlobalSettingsOut,
    EFacturaGlobalSettingsUpdate,
    GlobalTestResult,
    TestCheck,
)
from app.models.account import Account
from app.models.company import Company
from app.routers.admin import _require_super_admin

log = logging.getLogger("berlinstar.efactura.admin")

router = APIRouter()


# ---------- helpers ----------

async def _get_or_create_settings(db: AsyncSession, company_id: int) -> AnafSettings:
    row = (
        await db.execute(select(AnafSettings).where(AnafSettings.company_id == company_id))
    ).scalar_one_or_none()
    if row is None:
        row = AnafSettings(company_id=company_id)
        db.add(row)
        await db.flush()
        await db.refresh(row)
    return row


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


def _token_status(token: AnafToken | None) -> AnafTokenStatus:
    if token is None:
        return AnafTokenStatus(company_id=0, connected=False, state="disconnected")
    now = datetime.now(timezone.utc)
    expires_at = token.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    delta_days = (expires_at - now).days
    state: str
    if delta_days < 0:
        state = "expired"
    elif delta_days <= 14:
        state = "expiring_soon"
    else:
        state = "connected"
    return AnafTokenStatus(
        company_id=token.company_id,
        connected=delta_days >= 0,
        expires_at=expires_at,
        days_until_expiry=delta_days,
        state=state,  # type: ignore[arg-type]
    )


# ---------- endpoints ----------

@router.get("/companies", response_model=list[CompanyEFacturaSummary])
async def list_companies_efactura(
    admin: Account = Depends(_require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    """List all companies in the system with their ANAF settings + token status."""
    companies = (
        await db.execute(
            select(Company).where(Company.is_deleted == False).order_by(Company.name)
        )
    ).scalars().all()
    settings_map = {
        s.company_id: s
        for s in (await db.execute(select(AnafSettings))).scalars().all()
    }
    tokens_map = {
        t.company_id: t
        for t in (await db.execute(select(AnafToken))).scalars().all()
    }

    result: list[CompanyEFacturaSummary] = []
    for c in companies:
        st = settings_map.get(c.id)
        tk = tokens_map.get(c.id)
        result.append(
            CompanyEFacturaSummary(
                company_id=c.id,
                account_id=c.account_id,
                name=c.name,
                cui=c.cui,
                is_vat_payer=c.is_vat_payer,
                settings=_settings_to_out(st) if st else None,
                token_status=_token_status(tk) if tk else AnafTokenStatus(
                    company_id=c.id, connected=False, state="disconnected"
                ),
            )
        )
    return result


@router.get("/companies/{company_id}/settings", response_model=AnafSettingsOut)
async def get_company_settings(
    company_id: int = Path(..., gt=0),
    admin: Account = Depends(_require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    company = (await db.execute(select(Company).where(Company.id == company_id))).scalar_one_or_none()
    if company is None:
        raise HTTPException(404, "Compania nu exista.")
    row = await _get_or_create_settings(db, company_id)
    await db.commit()
    return _settings_to_out(row)


@router.patch("/companies/{company_id}/settings", response_model=AnafSettingsOut)
async def update_company_settings(
    body: AnafSettingsUpdate,
    company_id: int = Path(..., gt=0),
    admin: Account = Depends(_require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    company = (await db.execute(select(Company).where(Company.id == company_id))).scalar_one_or_none()
    if company is None:
        raise HTTPException(404, "Compania nu exista.")

    row = await _get_or_create_settings(db, company_id)
    data = body.model_dump(exclude_unset=True)

    for k, v in data.items():
        if hasattr(row, k):
            setattr(row, k, v)

    row.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(row)
    log.info("AnafSettings updated for company_id=%s by admin_id=%s", company_id, admin.id)
    return _settings_to_out(row)


@router.post("/companies/{company_id}/test-connection")
async def test_company_connection(
    company_id: int = Path(..., gt=0),
    admin: Account = Depends(_require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    """Smoke-test al conexiunii ANAF: incearca sa obtina un access_token valid (refresh la nevoie).

    Daca tokenul lipseste sau a expirat -> 401 cu mesaj.
    Daca tokenul e valid sau refresh-ul reuseste -> 200 ok.
    """
    company = (await db.execute(select(Company).where(Company.id == company_id))).scalar_one_or_none()
    if company is None:
        raise HTTPException(404, "Compania nu exista.")
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


@router.get("/dashboard")
async def admin_dashboard(
    admin: Account = Depends(_require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    """Counters: in_prelucrare, accepted, rejected, deadline_today, connected_companies."""
    today = datetime.now(timezone.utc).date()

    status_rows = (
        await db.execute(
            select(EFacturaRecord.status, func.count(EFacturaRecord.id))
            .group_by(EFacturaRecord.status)
        )
    ).all()
    by_status = {s: int(c) for s, c in status_rows}

    deadline_today = (
        await db.execute(
            select(func.count(EFacturaRecord.id)).where(
                EFacturaRecord.deadline_transmit <= today,
                EFacturaRecord.status != "accepted",
            )
        )
    ).scalar_one()

    connected_companies = (
        await db.execute(select(func.count(AnafToken.id)))
    ).scalar_one()

    total_companies = (
        await db.execute(select(func.count(Company.id)).where(Company.is_deleted == False))
    ).scalar_one()

    return {
        "by_status": by_status,
        "deadline_overdue_or_today": int(deadline_today),
        "connected_companies": int(connected_companies),
        "total_companies": int(total_companies),
        "fernet_configured": fernet_configured(),
        "scheduler_enabled": __import__("app.config", fromlist=["EFACTURA_SCHEDULER_ENABLED"]).EFACTURA_SCHEDULER_ENABLED,
    }


@router.post("/jobs/{job_name}/trigger")
async def trigger_scheduler_job(
    job_name: str,
    admin: Account = Depends(_require_super_admin),
):
    """Trigger manual al unui job APScheduler eFactura (debug)."""
    try:
        await efactura_scheduler.trigger_job(job_name)
    except ValueError as exc:
        raise HTTPException(404, str(exc))
    except Exception as exc:  # noqa: BLE001
        log.exception("Manual trigger failed for %s", job_name)
        raise HTTPException(500, f"Job a esuat: {exc}")
    return {"ok": True, "job": job_name}


# ---------- Global settings (mutate din .env in UI) ----------

def _global_to_out(row: EFacturaGlobalSettings, *, scheduler_running: bool) -> EFacturaGlobalSettingsOut:
    cfg = runtime_config.get_cached() or runtime_config._resolve(row)  # noqa: SLF001
    preview = None
    if row.fernet_key:
        preview = row.fernet_key[:6] + "…"
    return EFacturaGlobalSettingsOut(
        id=row.id,
        fernet_key_set=bool(row.fernet_key),
        fernet_key_preview=preview,
        anaf_auth_url=cfg.anaf_auth_url,
        anaf_token_url=cfg.anaf_token_url,
        anaf_api_base_prod=cfg.anaf_api_base_prod,
        anaf_api_base_test=cfg.anaf_api_base_test,
        default_redirect_uri=cfg.default_redirect_uri,
        frontend_callback_redirect=cfg.frontend_callback_redirect,
        scheduler_enabled=row.scheduler_enabled,
        scheduler_running=scheduler_running,
        oauth_client_id=row.oauth_client_id,
        has_oauth_client_secret=bool(row.oauth_client_secret_enc),
        updated_at=row.updated_at,
    )


@router.get("/global", response_model=EFacturaGlobalSettingsOut)
async def get_global_settings(
    admin: Account = Depends(_require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    """Returneaza setarile globale eFactura (cheia Fernet doar prin preview)."""
    row = await runtime_config.get_or_create_row(db)
    sched = efactura_scheduler.get_scheduler()
    return _global_to_out(row, scheduler_running=sched is not None)


@router.patch("/global", response_model=EFacturaGlobalSettingsOut)
async def update_global_settings(
    body: EFacturaGlobalSettingsUpdate,
    admin: Account = Depends(_require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    """Actualizeaza setarile globale. Pentru fernet_key:
       - valoarea 'AUTO' -> regenereaza o cheie noua (atentie: tokenii vechi devin inutili).
       - valoare libera  -> seteaza cheia primita (validata ca Fernet valid).
       - omis            -> nu schimba nimic.
    """
    row = await runtime_config.get_or_create_row(db)
    data = body.model_dump(exclude_unset=True)

    if "fernet_key" in data:
        new_key = data.pop("fernet_key")
        if new_key == "AUTO":
            row.fernet_key = runtime_config.generate_fernet_key()
            log.warning("Cheie Fernet regenerata din UI. Token-urile criptate cu cheia veche sunt acum invalide.")
        elif new_key is None or new_key == "":
            pass  # nu schimba nimic
        else:
            # valideaza ca e Fernet valid
            from cryptography.fernet import Fernet
            try:
                Fernet(new_key.encode("utf-8"))
            except Exception as exc:  # noqa: BLE001
                raise HTTPException(400, f"Cheia Fernet introdusa este invalida: {exc}")
            row.fernet_key = new_key

    # OAuth client_secret: cripteaza inainte de stocare (necesita Fernet)
    if "oauth_client_secret" in data:
        secret = data.pop("oauth_client_secret")
        if secret:
            if not fernet_configured() and not row.fernet_key:
                raise HTTPException(
                    400,
                    "Cheia Fernet nu este configurata. Salveaza intai cheia Fernet, apoi client_secret.",
                )
            # Daca tocmai am setat fernet_key in acest request, foloseste-o pentru encrypt
            if row.fernet_key:
                set_fernet_key(row.fernet_key)
            row.oauth_client_secret_enc = encrypt(secret)
        else:
            row.oauth_client_secret_enc = None

    for k, v in data.items():
        if hasattr(row, k):
            setattr(row, k, v)

    row.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(row)

    runtime_config.invalidate_cache()
    cfg = await runtime_config.load(db)
    set_fernet_key(cfg.fernet_key)

    # Daca scheduler_enabled s-a schimbat, porneste/opreste runtime
    sched = efactura_scheduler.get_scheduler()
    if cfg.scheduler_enabled and sched is None:
        await efactura_scheduler.start_scheduler()
    elif not cfg.scheduler_enabled and sched is not None:
        await efactura_scheduler.stop_scheduler()

    sched_after = efactura_scheduler.get_scheduler()
    return _global_to_out(row, scheduler_running=sched_after is not None)


@router.post("/global/test-setup", response_model=GlobalTestResult)
async def test_global_setup(
    admin: Account = Depends(_require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    """Testeaza configurarea globala eFactura:
       1. Cheia Fernet poate cripta+decripta un sample
       2. URL-urile ANAF (auth, token, api_test, api_prod) raspund la HEAD/GET
       3. Setarile per-companie sunt complete (cati clientizi configurati)
    """
    import httpx

    cfg = await runtime_config.load(db, force=True)
    checks: list[TestCheck] = []

    # 1. Fernet self-test
    if not cfg.fernet_key:
        checks.append(TestCheck(
            name="Cheie Fernet",
            ok=False,
            detail="Cheia nu este setata. Apasa 'Genereaza cheie noua' in tabul Configurare globala.",
        ))
    else:
        if fernet_self_test():
            checks.append(TestCheck(name="Cheie Fernet", ok=True, detail="Encrypt/decrypt OK pe sample."))
        else:
            checks.append(TestCheck(
                name="Cheie Fernet", ok=False,
                detail="Cheia este setata dar self-test-ul a esuat. Probabil e malformata.",
            ))

    # 2. URL-uri ANAF — HEAD request rapid (3s timeout)
    async def _ping(label: str, url: str) -> TestCheck:
        try:
            async with httpx.AsyncClient(timeout=5.0, follow_redirects=False) as http:
                resp = await http.get(url)
            ok = resp.status_code < 500
            return TestCheck(
                name=label, ok=ok,
                detail=f"HTTP {resp.status_code} la {url}" + ("" if ok else " — endpoint indisponibil"),
            )
        except httpx.RequestError as exc:
            return TestCheck(name=label, ok=False, detail=f"Eroare retea catre {url}: {exc}")

    checks.append(await _ping("ANAF Auth URL", cfg.anaf_auth_url))
    checks.append(await _ping("ANAF Token URL", cfg.anaf_token_url))
    checks.append(await _ping("ANAF API Test", cfg.anaf_api_base_test))
    checks.append(await _ping("ANAF API Prod", cfg.anaf_api_base_prod))

    # 3. OAuth global ANAF (aplicatie BerlinStar)
    if cfg.oauth_client_id and cfg.oauth_client_secret_enc:
        checks.append(TestCheck(
            name="OAuth ANAF global",
            ok=True,
            detail="client_id + client_secret + redirect_uri setate global.",
        ))
    else:
        missing: list[str] = []
        if not cfg.oauth_client_id:
            missing.append("client_id")
        if not cfg.oauth_client_secret_enc:
            missing.append("client_secret")
        checks.append(TestCheck(
            name="OAuth ANAF global",
            ok=False,
            detail=(
                "Lipseste: " + ", ".join(missing) +
                ". Configureaza in AdminV2 -> eFactura -> Configurare globala."
            ),
        ))

    # 4. Scheduler
    sched = efactura_scheduler.get_scheduler()
    if cfg.scheduler_enabled:
        if sched is not None:
            checks.append(TestCheck(name="Scheduler", ok=True, detail=f"Activat si rulează ({len(sched.get_jobs())} jobs)."))
        else:
            checks.append(TestCheck(name="Scheduler", ok=False, detail="Activat in setari, dar NU ruleaza. Restart la backend?"))
    else:
        checks.append(TestCheck(name="Scheduler", ok=True, detail="Dezactivat (OK pentru dev local)."))

    ok_all = all(c.ok for c in checks)
    return GlobalTestResult(ok=ok_all, checks=checks)
