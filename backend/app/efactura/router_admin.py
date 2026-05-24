"""Admin endpoints for the eFactura ANAF module.

Mount: /api/admin/efactura/*
Auth:  super admin (username == "admin") via _require_super_admin from app.routers.admin.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from pydantic import BaseModel, Field
from sqlalchemy import delete as sa_delete, desc, func, select
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
from app.efactura.models import (
    AnafSettings,
    AnafToken,
    EFacturaGlobalSettings,
    EFacturaRecord,
    ScheduledJobOverride,
    TaskRun,
)
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


@router.post("/companies/{company_id}/refresh-token")
async def refresh_company_token(
    company_id: int = Path(..., gt=0),
    admin: Account = Depends(_require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    """Force-refresh manual al token-ului ANAF (ignora pragul de 5 min)."""
    company = (await db.execute(select(Company).where(Company.id == company_id))).scalar_one_or_none()
    if company is None:
        raise HTTPException(404, "Compania nu exista.")
    token = (
        await db.execute(select(AnafToken).where(AnafToken.company_id == company_id))
    ).scalar_one_or_none()
    if token is None:
        raise HTTPException(404, "Nu exista token ANAF pentru aceasta companie.")
    try:
        token = await oauth_service._refresh_token(db, token)
    except AnafTokenExpired as exc:
        raise HTTPException(401, f"Refresh token expirat: {exc}")
    except AnafAuthError as exc:
        raise HTTPException(502, f"Eroare ANAF la refresh: {exc}")
    expires_at = token.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    return {
        "ok": True,
        "expires_at": expires_at.isoformat(),
        "detail": "Token refreshat cu succes.",
    }


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
    """Trigger manual al unui job APScheduler eFactura.

    Persistă un TaskRun cu triggered_by=manual pentru a apare in Logs.
    """
    try:
        await efactura_scheduler.trigger_job(job_name, triggered_by="manual")
    except ValueError as exc:
        raise HTTPException(404, str(exc))
    except Exception as exc:  # noqa: BLE001
        log.exception("Manual trigger failed for %s", job_name)
        raise HTTPException(500, f"Job a esuat: {exc}")
    return {"ok": True, "job": job_name}


# ---------- Tasks: list + edit schedule ----------

class JobInfo(BaseModel):
    job_id: str
    label: str
    enabled: bool
    trigger_type: str  # "cron" | "interval"
    cron_expression: str | None
    cron_expression_default: str
    is_override: bool
    next_run_at: datetime | None
    last_run: dict | None  # {status, finished_at}
    scheduler_running: bool


class JobUpdateBody(BaseModel):
    cron_expression: str | None = Field(
        default=None,
        max_length=128,
        description="Cron 5-camp sau numar minute (interval).",
    )
    trigger_type: Literal["cron", "interval"] | None = None
    enabled: bool | None = None
    reset_to_default: bool = False


@router.get("/jobs", response_model=list[JobInfo])
async def list_jobs(
    admin: Account = Depends(_require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    """Lista tuturor joburilor cunoscute, cu next_run + ultima rulare."""
    sched = efactura_scheduler.get_scheduler()
    running = sched is not None

    overrides = {
        o.job_id: o
        for o in (await db.execute(select(ScheduledJobOverride))).scalars().all()
    }

    result: list[JobInfo] = []
    known = efactura_scheduler.list_known_jobs()

    # Ultima rulare per job — un singur query cu DISTINCT ON in PostgreSQL.
    # In ordinea (job_id, started_at DESC) primul rand per job_id e cel mai recent.
    last_run_rows = (
        await db.execute(
            select(TaskRun)
            .where(TaskRun.job_id.in_(known))
            .distinct(TaskRun.job_id)
            .order_by(TaskRun.job_id, desc(TaskRun.started_at))
        )
    ).scalars().all()
    last_run_map: dict[str, TaskRun] = {r.job_id: r for r in last_run_rows}

    for job_id in known:
        ov = overrides.get(job_id)
        default_type, default_expr = efactura_scheduler.default_trigger_str(job_id)
        if ov is not None and ov.cron_expression:
            trigger_type = ov.trigger_type
            cron_expression = ov.cron_expression
            is_override = True
        else:
            trigger_type = default_type
            cron_expression = default_expr
            is_override = False

        enabled = True if ov is None else ov.enabled

        # Next run din APScheduler runtime
        next_run_at = None
        if running and sched is not None:
            j = sched.get_job(job_id)
            if j is not None and j.next_run_time is not None:
                next_run_at = j.next_run_time

        lr = last_run_map.get(job_id)
        last_run = None
        if lr is not None:
            last_run = {
                "status": lr.status,
                "finished_at": lr.finished_at.isoformat() if lr.finished_at else None,
                "started_at": lr.started_at.isoformat(),
                "duration_ms": lr.duration_ms,
                "triggered_by": lr.triggered_by,
            }

        result.append(JobInfo(
            job_id=job_id,
            label=efactura_scheduler.JOB_LABELS.get(job_id, job_id),
            enabled=enabled,
            trigger_type=trigger_type,
            cron_expression=cron_expression,
            cron_expression_default=default_expr,
            is_override=is_override,
            next_run_at=next_run_at,
            last_run=last_run,
            scheduler_running=running,
        ))

    return result


@router.patch("/jobs/{job_name}")
async def update_job_schedule(
    body: JobUpdateBody,
    job_name: str,
    admin: Account = Depends(_require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    """Editeaza schedule-ul unui job (salveaza override in DB + reschedule live).

    Pentru `trigger_type=cron`, `cron_expression` trebuie sa fie 5-camp clasic (minute hour day month dow).
    Pentru `trigger_type=interval`, `cron_expression` trebuie sa fie un numar (minute).
    `reset_to_default=true` sterge overrideul si revine la defaults.
    """
    if job_name not in efactura_scheduler.list_known_jobs():
        raise HTTPException(404, f"Job necunoscut: {job_name}")

    existing = (
        await db.execute(
            select(ScheduledJobOverride).where(ScheduledJobOverride.job_id == job_name)
        )
    ).scalar_one_or_none()

    # Calculam expresia + trigger_type-ul efectiv DUPA modificarea propusa
    # si pre-validam parsarea inainte de a face commit in DB. In felul asta
    # nu salvam in DB un override care la urmatorul start_scheduler ar esua.
    if not body.reset_to_default:
        effective_type = (
            body.trigger_type
            or (existing.trigger_type if existing else None)
            or "cron"
        )
        effective_expr = (
            body.cron_expression
            if body.cron_expression is not None
            else (existing.cron_expression if existing else None)
        )
        if effective_expr:
            try:
                efactura_scheduler.parse_cron_expression(effective_expr, effective_type)
            except ValueError as exc:
                raise HTTPException(400, f"Schedule invalid: {exc}")

    if body.reset_to_default:
        if existing is not None:
            await db.delete(existing)
            await db.commit()
    else:
        if existing is None:
            existing = ScheduledJobOverride(
                job_id=job_name,
                trigger_type=body.trigger_type or "cron",
                cron_expression=body.cron_expression,
                enabled=True if body.enabled is None else body.enabled,
            )
            db.add(existing)
        else:
            if body.trigger_type is not None:
                existing.trigger_type = body.trigger_type
            if body.cron_expression is not None:
                existing.cron_expression = body.cron_expression
            if body.enabled is not None:
                existing.enabled = body.enabled
            existing.updated_at = datetime.now(timezone.utc)
        await db.commit()

    # Aplica live in scheduler (daca ruleaza)
    try:
        await efactura_scheduler.reschedule_job(job_name)
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    except Exception as exc:  # noqa: BLE001
        log.exception("Reschedule failed pentru %s", job_name)
        raise HTTPException(400, f"Schedule invalid: {exc}")

    log.info("Job %s reschedule de admin_id=%s (reset=%s)", job_name, admin.id, body.reset_to_default)
    return {"ok": True, "job": job_name}


# ---------- Task logs ----------

class TaskLogOut(BaseModel):
    id: int
    job_id: str
    started_at: datetime
    finished_at: datetime | None
    status: str
    duration_ms: int | None
    items_processed: int | None
    items_failed: int | None
    error_message: str | None
    triggered_by: str


class TaskLogListOut(BaseModel):
    items: list[TaskLogOut]
    total: int
    limit: int
    offset: int


@router.get("/task-logs", response_model=TaskLogListOut)
async def list_task_logs(
    job_id: str | None = Query(None),
    status: str | None = Query(None, description="running | success | error"),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    admin: Account = Depends(_require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    """Lista paginata de rulari, filtrabila dupa job/status."""
    stmt = select(TaskRun)
    count_stmt = select(func.count(TaskRun.id))
    if job_id:
        stmt = stmt.where(TaskRun.job_id == job_id)
        count_stmt = count_stmt.where(TaskRun.job_id == job_id)
    if status:
        stmt = stmt.where(TaskRun.status == status)
        count_stmt = count_stmt.where(TaskRun.status == status)
    stmt = stmt.order_by(desc(TaskRun.started_at)).limit(limit).offset(offset)

    rows = (await db.execute(stmt)).scalars().all()
    total = (await db.execute(count_stmt)).scalar_one()

    items = [
        TaskLogOut(
            id=r.id,
            job_id=r.job_id,
            started_at=r.started_at,
            finished_at=r.finished_at,
            status=r.status,
            duration_ms=r.duration_ms,
            items_processed=r.items_processed,
            items_failed=r.items_failed,
            error_message=r.error_message,
            triggered_by=r.triggered_by,
        )
        for r in rows
    ]
    return TaskLogListOut(items=items, total=int(total), limit=limit, offset=offset)


@router.delete("/task-logs")
async def clear_task_logs(
    keep_last_days: int = Query(
        0, ge=0, le=365,
        description=(
            "Daca > 0, sterge doar rulari mai vechi de N zile. "
            "Default 0 = sterge tot (pastrand astfel comportamentul vechi)."
        ),
    ),
    admin: Account = Depends(_require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    """Sterge intrari din task_runs.

    - `keep_last_days=0` (default): sterge tot — accesibil doar super-admin.
      Rulari cu status='running' sunt pastrate (sa nu ramana update-ul lor orfan).
    - `keep_last_days>0`: sterge doar rulari finalizate mai vechi decat cutoff.
    """
    stmt = sa_delete(TaskRun).execution_options(synchronize_session=False)
    if keep_last_days > 0:
        cutoff = datetime.now(timezone.utc) - timedelta(days=keep_last_days)
        stmt = stmt.where(
            TaskRun.finished_at.isnot(None), TaskRun.finished_at < cutoff,
        )
    else:
        # Pastram rulari active — update-ul lor de la sfarsit ar deveni un no-op silent.
        stmt = stmt.where(TaskRun.status != "running")
    result = await db.execute(stmt)
    await db.commit()
    deleted = int(result.rowcount or 0)
    log.warning(
        "task_runs sterse de admin_id=%s (%d randuri, keep_last_days=%s)",
        admin.id, deleted, keep_last_days,
    )
    return {"ok": True, "deleted": deleted, "keep_last_days": keep_last_days}


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
