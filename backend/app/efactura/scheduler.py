"""APScheduler jobs pentru eFactura.

Job-uri:
- efactura_upload_pending  (la 5 min)  -> upload facturi cu status=pending_upload
- efactura_poll_status     (la 10 min) -> verifica /stareMesaj pentru in_prelucrare
- efactura_download_responses (la 30 min) -> descarca ZIP-urile pentru accepted
- efactura_deadline_alert  (zilnic 08:00) -> trimite email pentru facturi cu deadline iminent
- efactura_token_expiry_alert (zilnic 09:00) -> alerteaza la tokens cu <14 zile
- efactura_sync_received   (la 60 min) -> sincronizeaza /listaMesajeFactura?filtru=P

Toggle global prin env: EFACTURA_SCHEDULER_ENABLED=1
"""
from __future__ import annotations

import contextvars
import logging
import traceback
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy import delete, select

from app.broadcaster import broadcaster
from app.database import AsyncSessionLocal
from app.efactura import runtime_config
from app.efactura import service as efactura_service
from app.efactura.exceptions import (
    AnafAuthError,
    AnafConfigError,
    AnafTokenExpired,
    AnafTokenMissing,
    EFacturaError,
)
from app.efactura.models import (
    AnafSettings,
    AnafToken,
    EFacturaRecord,
    ScheduledJobOverride,
    TaskRun,
)
from app.models.receipt import Receipt

log = logging.getLogger("berlinstar.efactura.scheduler")

_BUCHAREST_TZ = "Europe/Bucharest"
_scheduler: AsyncIOScheduler | None = None

# Context-local pentru a propaga `triggered_by` si counters de la job catre wrapper.
_current_run: contextvars.ContextVar["_RunContext | None"] = contextvars.ContextVar(
    "_current_run", default=None
)


@dataclass
class _RunContext:
    triggered_by: str = "schedule"
    items_processed: int = 0
    items_failed: int = 0


def _ctx() -> _RunContext | None:
    """Returneaza contextul rularii curente (daca jobul este invocat printr-un wrapper)."""
    return _current_run.get()


def report_items(processed: int = 0, failed: int = 0) -> None:
    """API public pentru job-uri: raporteaza counters in contextul rularii curente."""
    ctx = _ctx()
    if ctx is None:
        return
    ctx.items_processed += processed
    ctx.items_failed += failed


async def _send_alert_email(db, subject: str, body_html: str, to_address: str) -> None:
    """Trimite un email transactional (fara EmailTemplate) folosind SMTP din global_settings.

    Daca SMTP nu e configurat sau e dezactivat, doar logam (nu raise).
    """
    if not to_address:
        return
    try:
        from email.mime.multipart import MIMEMultipart
        from email.mime.text import MIMEText
        from sqlalchemy import select as _select

        from app.models.global_settings import GlobalSettings
        from app.utils.email_service import _dispatch

        gs = (await db.execute(_select(GlobalSettings).limit(1))).scalar_one_or_none()
        if gs is None or not gs.smtp_enabled or not gs.smtp_host:
            log.info("SMTP nu este activat — alerta eFactura logata: %s -> %s", subject, to_address)
            return

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{gs.smtp_from_name or 'BerlinStar'} <{gs.smtp_from_address}>"
        msg["To"] = to_address
        msg.attach(MIMEText(body_html, "html"))
        await _dispatch(gs, msg)
        log.info("Alerta eFactura trimisa: %s -> %s", subject, to_address)
    except Exception as exc:  # noqa: BLE001
        log.warning("Trimiterea alertei eFactura a esuat (%s): %s", to_address, exc)


def get_scheduler() -> AsyncIOScheduler | None:
    return _scheduler


# ---------- Job: upload pending ----------

async def job_upload_pending() -> None:
    async with AsyncSessionLocal() as db:
        rows = (
            await db.execute(
                select(EFacturaRecord).where(
                    EFacturaRecord.status == "pending_upload",
                    EFacturaRecord.upload_attempts < 3,
                )
            )
        ).scalars().all()
        log.info("efactura_upload_pending: %d facturi de procesat", len(rows))
        accounts_to_notify: set[int] = set()
        for rec in rows:
            try:
                receipt = (
                    await db.execute(select(Receipt).where(Receipt.id == rec.receipt_id))
                ).scalar_one_or_none()
                if receipt is None:
                    rec.status = "error"
                    rec.anaf_error_message = "Receipt-ul aferent a fost sters."
                    await db.commit()
                    continue
                accounts_to_notify.add(receipt.account_id)
                await efactura_service.prepare_and_upload(db, receipt)
            except (AnafTokenMissing, AnafTokenExpired, AnafConfigError) as exc:
                log.warning("Upload blocat pentru rec=%s: %s", rec.id, exc)
            except EFacturaError as exc:
                log.warning("Upload esuat pentru rec=%s: %s", rec.id, exc)
        for aid in accounts_to_notify:
            try:
                broadcaster.notify(aid)
            except Exception as exc:  # noqa: BLE001
                log.warning("broadcaster.notify(%s) failed: %s", aid, exc)


# ---------- Job: poll status ----------

async def job_poll_status() -> None:
    async with AsyncSessionLocal() as db:
        now = datetime.now(timezone.utc)
        rows = (
            await db.execute(
                select(EFacturaRecord).where(
                    EFacturaRecord.status == "in_prelucrare",
                    EFacturaRecord.index_incarcare.isnot(None),
                )
            )
        ).scalars().all()
        log.info("efactura_poll_status: %d facturi de verificat", len(rows))
        accounts_to_notify: set[int] = set()
        for rec in rows:
            if rec.next_retry_at and rec.next_retry_at.replace(tzinfo=timezone.utc) > now:
                continue
            try:
                prev_status = rec.status
                await efactura_service.poll_status(db, rec)
                if rec.status != prev_status and rec.receipt_id is not None:
                    receipt = (
                        await db.execute(select(Receipt).where(Receipt.id == rec.receipt_id))
                    ).scalar_one_or_none()
                    if receipt is not None:
                        accounts_to_notify.add(receipt.account_id)
            except (AnafAuthError, EFacturaError) as exc:
                log.warning("poll_status esuat pentru rec=%s: %s", rec.id, exc)
        for aid in accounts_to_notify:
            try:
                broadcaster.notify(aid)
            except Exception as exc:  # noqa: BLE001
                log.warning("broadcaster.notify(%s) failed: %s", aid, exc)


# ---------- Job: download responses ----------

async def job_download_responses() -> None:
    async with AsyncSessionLocal() as db:
        rows = (
            await db.execute(
                select(EFacturaRecord).where(
                    EFacturaRecord.status.in_(("accepted", "rejected")),
                    EFacturaRecord.download_id.isnot(None),
                    EFacturaRecord.response_zip_s3_key.is_(None),
                )
            )
        ).scalars().all()
        log.info("efactura_download_responses: %d zip-uri de descarcat", len(rows))
        accounts_to_notify: set[int] = set()
        for rec in rows:
            try:
                await efactura_service.download_and_archive(db, rec)
                if rec.receipt_id is not None:
                    receipt = (
                        await db.execute(select(Receipt).where(Receipt.id == rec.receipt_id))
                    ).scalar_one_or_none()
                    if receipt is not None:
                        accounts_to_notify.add(receipt.account_id)
            except EFacturaError as exc:
                log.warning("Download esuat pentru rec=%s: %s", rec.id, exc)
        for aid in accounts_to_notify:
            try:
                broadcaster.notify(aid)
            except Exception as exc:  # noqa: BLE001
                log.warning("broadcaster.notify(%s) failed: %s", aid, exc)


# ---------- Job: deadline alert ----------

async def job_deadline_alert() -> None:
    async with AsyncSessionLocal() as db:
        today = datetime.now(timezone.utc).date()
        soon = today + timedelta(days=2)
        rows = (
            await db.execute(
                select(EFacturaRecord).where(
                    EFacturaRecord.deadline_transmit <= soon,
                    EFacturaRecord.status != "accepted",
                )
            )
        ).scalars().all()
        if not rows:
            return
        log.warning("efactura_deadline_alert: %d facturi cu deadline iminent", len(rows))

        by_company: dict[int, list[EFacturaRecord]] = {}
        for r in rows:
            by_company.setdefault(r.company_id, []).append(r)

        for company_id, recs in by_company.items():
            settings = (
                await db.execute(
                    select(AnafSettings).where(AnafSettings.company_id == company_id)
                )
            ).scalar_one_or_none()
            if settings is None or not settings.deadline_alert_email:
                continue

            lines_html = "\n".join(
                f"<li>Receipt #{r.receipt_id} — emisă {r.invoice_issue_date} — "
                f"deadline <strong>{r.deadline_transmit}</strong> — status {r.status}</li>"
                for r in recs
            )
            subject = f"[BerlinStar eFactura] {len(recs)} facturi cu deadline iminent"
            body = (
                f"<p>Bună,</p>"
                f"<p>{len(recs)} facturi trebuie transmise la ANAF e-Factura în maxim 2 zile lucrătoare:</p>"
                f"<ul>{lines_html}</ul>"
                f"<p>Verifică-le în AdminV2 → eFactura → Status transmiteri.</p>"
                f"<p>— BerlinStar (alertă automată)</p>"
            )
            await _send_alert_email(db, subject, body, settings.deadline_alert_email)


# ---------- Job: token expiry alert ----------

async def job_token_expiry_alert() -> None:
    async with AsyncSessionLocal() as db:
        now = datetime.now(timezone.utc)
        threshold = now + timedelta(days=14)
        tokens = (
            await db.execute(
                select(AnafToken).where(AnafToken.expires_at <= threshold)
            )
        ).scalars().all()
        if not tokens:
            return
        log.warning(
            "efactura_token_expiry_alert: %d tokeni expira in <14 zile sau au expirat", len(tokens),
        )
        for token in tokens:
            settings = (
                await db.execute(
                    select(AnafSettings).where(AnafSettings.company_id == token.company_id)
                )
            ).scalar_one_or_none()
            if settings is None or not settings.deadline_alert_email:
                continue

            expires_at = token.expires_at
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            days_left = (expires_at - now).days
            already_expired = days_left < 0

            subject = (
                "[BerlinStar eFactura] Token ANAF expirat — reconnect cu USB"
                if already_expired
                else f"[BerlinStar eFactura] Token ANAF expiră în {days_left} zile"
            )
            body = (
                f"<p>Bună,</p>"
                f"<p>Token-ul OAuth pentru CUI <strong>{token.cui}</strong> "
                f"{'a expirat' if already_expired else f'expiră în <strong>{days_left} zile</strong>'} "
                f"({expires_at.date().isoformat()}).</p>"
                f"<p>Pentru a relua transmiterile către e-Factura ANAF:</p>"
                f"<ol>"
                f"<li>Asigură-te că <strong>USB-ul cu certificatul digital</strong> este plugat în calculator.</li>"
                f"<li>Mergi în AdminV2 → eFactura → Companii → apasă butonul <strong>Reconnect</strong>.</li>"
                f"<li>Autentifică-te în SPV cu PIN-ul USB-ului.</li>"
                f"</ol>"
                f"<p>După reconnect, refresh-ul automat în background va funcționa din nou pentru 90 zile.</p>"
                f"<p>— BerlinStar (alertă automată)</p>"
            )
            await _send_alert_email(db, subject, body, settings.deadline_alert_email)


# ---------- Job: sync received ----------

# ---------- Job: subscription lock expired ----------

async def job_subscription_lock_expired() -> None:
    """Blocheaza conturile cu abonament expirat (next_payment_date < azi)."""
    from datetime import date as _date

    from sqlalchemy import update
    from app.models.account import Account
    from app.models.subscription import AccountSubscription

    async with AsyncSessionLocal() as db:
        today = _date.today()
        sub_rows = (
            await db.execute(
                select(AccountSubscription.account_id).where(
                    AccountSubscription.next_payment_date < today
                )
            )
        ).scalars().all()
        if not sub_rows:
            return
        result = await db.execute(
            update(Account)
            .where(
                Account.id.in_(sub_rows),
                Account.is_locked == False,  # noqa: E712
                Account.is_deleted == False,  # noqa: E712
                Account.username != "admin",
            )
            .values(is_locked=True, locked_at=datetime.now(timezone.utc))
        )
        await db.commit()
        if result.rowcount:
            log.info("subscription_lock_expired: %d conturi blocate", result.rowcount)


# ---------- Job: subscription renewal email (7 days) ----------

async def job_subscription_renewal_email() -> None:
    """Trimite un email cu 7 zile inainte de scadenta (o singura data per perioada)."""
    from datetime import date as _date

    from app.models.account import Account
    from app.models.subscription import AccountSubscription

    async with AsyncSessionLocal() as db:
        today = _date.today()
        target = today + timedelta(days=7)
        rows = (
            await db.execute(
                select(AccountSubscription, Account)
                .join(Account, Account.id == AccountSubscription.account_id)
                .where(
                    AccountSubscription.next_payment_date == target,
                    Account.is_deleted == False,  # noqa: E712
                )
            )
        ).all()
        for sub, acc in rows:
            if sub.renewal_email_sent_for == sub.next_payment_date:
                continue
            if not acc.email:
                continue
            subject = "[BerlinStar] Abonamentul tau expira saptamana viitoare"
            body = (
                f"<p>Buna, {acc.name},</p>"
                f"<p>Abonamentul tau BerlinStar expira pe "
                f"<strong>{sub.next_payment_date.isoformat()}</strong> (peste 7 zile).</p>"
                f"<p>Reinnoieste-l din Configurari -> Abonament inainte de scadenta "
                f"pentru a evita blocarea contului.</p>"
                f"<p>— BerlinStar</p>"
            )
            await _send_alert_email(db, subject, body, acc.email)
            sub.renewal_email_sent_for = sub.next_payment_date
        await db.commit()


# ---------- Job: subscription SPV poll ----------

async def job_subscription_anaf_poll() -> None:
    """Polling status SPV pentru facturile de abonament aflate in_prelucrare."""
    from app.models.subscription import SubscriptionPayment
    from app.subscriptions import invoice_service

    async with AsyncSessionLocal() as db:
        rows = (
            await db.execute(
                select(SubscriptionPayment).where(
                    SubscriptionPayment.anaf_status == "in_prelucrare",
                    SubscriptionPayment.anaf_index_incarcare.isnot(None),
                )
            )
        ).scalars().all()
        for payment in rows:
            try:
                await invoice_service.poll_anaf_status(db, payment)
                if payment.anaf_status in ("accepted", "rejected") and payment.anaf_download_id:
                    await invoice_service.download_anaf_zip(db, payment)
            except Exception as exc:  # noqa: BLE001
                log.warning("subscription_anaf_poll esuat pentru payment=%s: %s", payment.id, exc)


async def job_sync_received() -> None:
    """Sincronizeaza /listaMesajeFactura?filtru=P pentru toate companiile conectate."""
    from app.efactura import oauth_service
    from app.efactura.anaf_client import AnafEFacturaClient
    from app.efactura.models import EFacturaReceivedIndex
    from sqlalchemy.dialects.postgresql import insert as pg_insert

    async with AsyncSessionLocal() as db:
        tokens = (await db.execute(select(AnafToken))).scalars().all()
        if not tokens:
            return
        log.info("efactura_sync_received: %d companii de sincronizat", len(tokens))

        for token in tokens:
            try:
                settings = (
                    await db.execute(
                        select(AnafSettings).where(AnafSettings.company_id == token.company_id)
                    )
                ).scalar_one_or_none()
                if settings is None:
                    continue
                access_token = await oauth_service.get_valid_access_token(db, token.company_id)
                client = AnafEFacturaClient(access_token, token.cui, use_test=settings.use_test_env)
                resp = await client.list_messages(days=2, filtru="P")
            except (AnafAuthError, EFacturaError) as exc:
                log.warning(
                    "sync_received esuat pentru company_id=%s: %s", token.company_id, exc,
                )
                continue

            messages = resp.get("mesaje") or resp.get("mesajeFactura") or []
            for m in messages:
                # /descarcare foloseste `id` din mesaj (download id), nu `id_solicitare`.
                id_sol = m.get("id") or m.get("id_solicitare")
                if not id_sol:
                    continue
                stmt = pg_insert(EFacturaReceivedIndex).values(
                    company_id=token.company_id,
                    cui=token.cui,
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
                await db.execute(stmt)
            settings.last_sync_at = datetime.now(timezone.utc)
            await db.commit()


# ---------- Job: refresh proactiv tokeni (toate companiile) ----------

async def job_token_refresh_all() -> None:
    """Reimprospateaza explicit tokenul tuturor companiilor conectate.

    Rulam asta lunar (ziua 1, 02:00) pentru ca o companie care nu emite facturi
    o luna intreaga sa nu ramana fara token activ — refresh-ul on-demand din
    oauth_service.get_valid_access_token() acopera doar fluxurile active.
    """
    from app.efactura import oauth_service

    async with AsyncSessionLocal() as db:
        tokens = (await db.execute(select(AnafToken))).scalars().all()
        log.info("efactura_token_refresh_all: %d companii de procesat", len(tokens))
        for token in tokens:
            try:
                await oauth_service._refresh_token(db, token)  # noqa: SLF001
                report_items(processed=1)
            except AnafTokenExpired as exc:
                log.warning(
                    "token_refresh_all: refresh expirat pentru company_id=%s (%s)",
                    token.company_id, exc,
                )
                report_items(failed=1)
            except (AnafAuthError, EFacturaError) as exc:
                log.warning(
                    "token_refresh_all: refresh esuat pentru company_id=%s: %s",
                    token.company_id, exc,
                )
                report_items(failed=1)


# ---------- Job: task_runs cleanup (retention 90 zile) ----------

_TASK_RUN_RETENTION_DAYS = 90


async def job_task_runs_cleanup() -> None:
    """Sterge log-urile de rulare mai vechi de 90 zile."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=_TASK_RUN_RETENTION_DAYS)
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            delete(TaskRun).where(TaskRun.finished_at.isnot(None), TaskRun.finished_at < cutoff)
        )
        await db.commit()
        log.info("task_runs_cleanup: %d randuri sterse (cutoff=%s)", result.rowcount or 0, cutoff.isoformat())
        report_items(processed=result.rowcount or 0)


# ---------- Helper: wrapper care logheaza in DB fiecare rulare ----------

def _with_task_log(job_id: str, fn):
    """Returneaza o functie async care insereaza un TaskRun la inceput,
    apeleaza job-ul si update-eaza row-ul la final (success/error)."""

    async def wrapper():
        ctx = _RunContext(triggered_by="schedule")
        token = _current_run.set(ctx)
        run_id: int | None = None
        started = datetime.now(timezone.utc)
        try:
            async with AsyncSessionLocal() as db:
                run = TaskRun(
                    job_id=job_id, started_at=started, status="running",
                    triggered_by=ctx.triggered_by,
                )
                db.add(run)
                await db.commit()
                run_id = run.id
        except Exception as exc:  # noqa: BLE001
            log.warning("Nu am putut crea TaskRun pentru %s: %s", job_id, exc)

        try:
            await fn()
            status = "success"
            error_msg = None
        except Exception as exc:  # noqa: BLE001
            status = "error"
            error_msg = f"{type(exc).__name__}: {exc}\n\n{traceback.format_exc()[-2000:]}"
            log.exception("Job %s a esuat", job_id)
        finally:
            _current_run.reset(token)

        finished = datetime.now(timezone.utc)
        duration_ms = int((finished - started).total_seconds() * 1000)
        if run_id is not None:
            try:
                async with AsyncSessionLocal() as db:
                    row = (
                        await db.execute(select(TaskRun).where(TaskRun.id == run_id))
                    ).scalar_one_or_none()
                    if row is not None:
                        row.finished_at = finished
                        row.duration_ms = duration_ms
                        row.status = status
                        row.error_message = error_msg
                        row.items_processed = ctx.items_processed or None
                        row.items_failed = ctx.items_failed or None
                        await db.commit()
            except Exception as exc:  # noqa: BLE001
                log.warning("Nu am putut update-a TaskRun %s: %s", run_id, exc)

    wrapper.__name__ = f"_logged_{job_id}"
    return wrapper


# ---------- Helper: trigger logged (din UI) ----------

async def _run_job_logged(job_id: str, fn, triggered_by: str = "manual") -> None:
    """Apeleaza un job direct, dar persistand intrarea in task_runs cu triggered_by dat."""
    ctx = _RunContext(triggered_by=triggered_by)
    token = _current_run.set(ctx)
    run_id: int | None = None
    started = datetime.now(timezone.utc)
    try:
        async with AsyncSessionLocal() as db:
            run = TaskRun(
                job_id=job_id, started_at=started, status="running", triggered_by=triggered_by,
            )
            db.add(run)
            await db.commit()
            run_id = run.id
    except Exception as exc:  # noqa: BLE001
        log.warning("Nu am putut crea TaskRun pentru %s (manual): %s", job_id, exc)

    error_msg: str | None = None
    try:
        await fn()
        status = "success"
    except Exception as exc:  # noqa: BLE001
        status = "error"
        error_msg = f"{type(exc).__name__}: {exc}\n\n{traceback.format_exc()[-2000:]}"
        log.exception("Manual trigger %s a esuat", job_id)
    finally:
        _current_run.reset(token)

    finished = datetime.now(timezone.utc)
    duration_ms = int((finished - started).total_seconds() * 1000)
    if run_id is not None:
        try:
            async with AsyncSessionLocal() as db:
                row = (
                    await db.execute(select(TaskRun).where(TaskRun.id == run_id))
                ).scalar_one_or_none()
                if row is not None:
                    row.finished_at = finished
                    row.duration_ms = duration_ms
                    row.status = status
                    row.error_message = error_msg
                    row.items_processed = ctx.items_processed or None
                    row.items_failed = ctx.items_failed or None
                    await db.commit()
        except Exception as exc:  # noqa: BLE001
            log.warning("Nu am putut update-a TaskRun %s (manual): %s", run_id, exc)

    if error_msg:
        raise RuntimeError(error_msg)


# ---------- Helper: build trigger from override ----------

def _build_trigger(default_trigger, override: ScheduledJobOverride | None):
    """Daca avem un override valid in DB, parseaza-l si returneaza-l;
    altfel returneaza trigger-ul default."""
    if override is None or not override.cron_expression:
        return default_trigger
    expr = override.cron_expression.strip()
    try:
        if override.trigger_type == "interval":
            # Acceptam doar numar de minute pentru interval, ca sa fie usor din UI.
            minutes = int(expr)
            return IntervalTrigger(minutes=minutes, timezone=_BUCHAREST_TZ)
        # cron standard cu 5 campuri: minute hour day month day_of_week
        parts = expr.split()
        if len(parts) != 5:
            raise ValueError(f"Cron expression invalid (asteptat 5 campuri): {expr!r}")
        minute, hour, day, month, dow = parts
        return CronTrigger(
            minute=minute, hour=hour, day=day, month=month, day_of_week=dow,
            timezone=_BUCHAREST_TZ,
        )
    except Exception as exc:  # noqa: BLE001
        log.warning(
            "Override invalid pentru job (%s): %s. Folosim default.",
            override.cron_expression, exc,
        )
        return default_trigger


async def _load_overrides() -> dict[str, ScheduledJobOverride]:
    async with AsyncSessionLocal() as db:
        rows = (await db.execute(select(ScheduledJobOverride))).scalars().all()
    return {r.job_id: r for r in rows}


# ---------- Bootstrap ----------

async def start_scheduler() -> None:
    """Porneste scheduler-ul eFactura daca scheduler_enabled=true in efactura_global_settings."""
    global _scheduler
    if _scheduler is not None:
        log.warning("Scheduler-ul eFactura este deja pornit.")
        return

    # Citim setarea curenta din DB
    async with AsyncSessionLocal() as db:
        cfg = await runtime_config.load(db, force=True)
    if not cfg.scheduler_enabled:
        log.info("scheduler_enabled=false in efactura_global_settings — scheduler-ul NU porneste.")
        return

    _scheduler = AsyncIOScheduler(timezone=_BUCHAREST_TZ)

    overrides = await _load_overrides()

    job_specs: list[tuple[str, object, object]] = [
        ("efactura_upload_pending", IntervalTrigger(minutes=5, timezone=_BUCHAREST_TZ), job_upload_pending),
        ("efactura_poll_status", IntervalTrigger(minutes=10, timezone=_BUCHAREST_TZ), job_poll_status),
        ("efactura_download_responses", IntervalTrigger(minutes=30, timezone=_BUCHAREST_TZ), job_download_responses),
        ("efactura_deadline_alert", CronTrigger(hour=8, minute=0, timezone=_BUCHAREST_TZ), job_deadline_alert),
        ("efactura_token_expiry_alert", CronTrigger(hour=9, minute=0, timezone=_BUCHAREST_TZ), job_token_expiry_alert),
        ("efactura_token_refresh_all", CronTrigger(day=1, hour=2, minute=0, timezone=_BUCHAREST_TZ), job_token_refresh_all),
        ("efactura_sync_received", IntervalTrigger(minutes=60, timezone=_BUCHAREST_TZ), job_sync_received),
        ("task_runs_cleanup", CronTrigger(hour=4, minute=0, timezone=_BUCHAREST_TZ), job_task_runs_cleanup),
        ("subscription_lock_expired", CronTrigger(hour=0, minute=5, timezone=_BUCHAREST_TZ), job_subscription_lock_expired),
        ("subscription_renewal_email", CronTrigger(hour=8, minute=15, timezone=_BUCHAREST_TZ), job_subscription_renewal_email),
        ("subscription_anaf_poll", IntervalTrigger(minutes=15, timezone=_BUCHAREST_TZ), job_subscription_anaf_poll),
    ]

    for job_id, default_trigger, fn in job_specs:
        override = overrides.get(job_id)
        if override is not None and not override.enabled:
            log.info("Job %s este dezactivat din DB override.", job_id)
            continue
        trigger = _build_trigger(default_trigger, override)
        _scheduler.add_job(
            _with_task_log(job_id, fn),
            trigger,
            id=job_id,
            replace_existing=True,
            coalesce=True,
            max_instances=1,
        )

    _scheduler.start()
    log.info("Scheduler eFactura pornit (timezone=%s).", _BUCHAREST_TZ)


async def stop_scheduler() -> None:
    global _scheduler
    if _scheduler is None:
        return
    _scheduler.shutdown(wait=False)
    _scheduler = None
    log.info("Scheduler eFactura oprit.")


# ---------- Manual trigger (admin) ----------

_JOB_FN_MAP = {
    "efactura_upload_pending": job_upload_pending,
    "efactura_poll_status": job_poll_status,
    "efactura_download_responses": job_download_responses,
    "efactura_deadline_alert": job_deadline_alert,
    "efactura_token_expiry_alert": job_token_expiry_alert,
    "efactura_token_refresh_all": job_token_refresh_all,
    "efactura_sync_received": job_sync_received,
    "task_runs_cleanup": job_task_runs_cleanup,
    "subscription_lock_expired": job_subscription_lock_expired,
    "subscription_renewal_email": job_subscription_renewal_email,
    "subscription_anaf_poll": job_subscription_anaf_poll,
}


# Labels umane pentru UI Tasks.
JOB_LABELS: dict[str, str] = {
    "efactura_upload_pending": "Upload facturi pending la ANAF",
    "efactura_poll_status": "Verifica status facturi in_prelucrare",
    "efactura_download_responses": "Descarca raspunsuri ZIP de la ANAF",
    "efactura_deadline_alert": "Alerta email deadline iminent",
    "efactura_token_expiry_alert": "Alerta email tokeni care expira in <14 zile",
    "efactura_token_refresh_all": "Refresh proactiv tokeni ANAF (toate firmele)",
    "efactura_sync_received": "Sincronizeaza facturi primite (P)",
    "task_runs_cleanup": "Curatare loguri task_runs (>90 zile)",
    "subscription_lock_expired": "Blocheaza conturi cu abonament expirat",
    "subscription_renewal_email": "Email reminder abonament expira in 7 zile",
    "subscription_anaf_poll": "Polling status SPV facturi abonament",
}


def list_known_jobs() -> list[str]:
    return list(_JOB_FN_MAP.keys())


async def trigger_job(job_name: str, *, triggered_by: str = "manual") -> None:
    """Apeleaza job-ul direct (din admin UI), persistand intrarea in task_runs."""
    fn = _JOB_FN_MAP.get(job_name)
    if fn is None:
        raise ValueError(f"Job necunoscut: {job_name}")
    await _run_job_logged(job_name, fn, triggered_by=triggered_by)


async def reschedule_job(job_name: str) -> None:
    """Reaplica trigger-ul curent (din override DB sau default) pentru un job
    care e deja inregistrat in scheduler."""
    sched = get_scheduler()
    if sched is None:
        return
    if job_name not in _JOB_FN_MAP:
        raise ValueError(f"Job necunoscut: {job_name}")

    # Cautam default-ul din job_specs (recompunem aici, ca sa nu duplicam).
    default_triggers = {
        "efactura_upload_pending": IntervalTrigger(minutes=5, timezone=_BUCHAREST_TZ),
        "efactura_poll_status": IntervalTrigger(minutes=10, timezone=_BUCHAREST_TZ),
        "efactura_download_responses": IntervalTrigger(minutes=30, timezone=_BUCHAREST_TZ),
        "efactura_deadline_alert": CronTrigger(hour=8, minute=0, timezone=_BUCHAREST_TZ),
        "efactura_token_expiry_alert": CronTrigger(hour=9, minute=0, timezone=_BUCHAREST_TZ),
        "efactura_token_refresh_all": CronTrigger(day=1, hour=2, minute=0, timezone=_BUCHAREST_TZ),
        "efactura_sync_received": IntervalTrigger(minutes=60, timezone=_BUCHAREST_TZ),
        "task_runs_cleanup": CronTrigger(hour=4, minute=0, timezone=_BUCHAREST_TZ),
        "subscription_lock_expired": CronTrigger(hour=0, minute=5, timezone=_BUCHAREST_TZ),
        "subscription_renewal_email": CronTrigger(hour=8, minute=15, timezone=_BUCHAREST_TZ),
        "subscription_anaf_poll": IntervalTrigger(minutes=15, timezone=_BUCHAREST_TZ),
    }
    default = default_triggers.get(job_name)
    if default is None:
        raise ValueError(f"Default trigger lipsa pentru {job_name}")

    overrides = await _load_overrides()
    override = overrides.get(job_name)
    fn = _JOB_FN_MAP[job_name]

    # Daca jobul e dezactivat din DB, scoate-l.
    existing = sched.get_job(job_name)
    if override is not None and not override.enabled:
        if existing is not None:
            sched.remove_job(job_name)
        return

    trigger = _build_trigger(default, override)
    if existing is None:
        sched.add_job(
            _with_task_log(job_name, fn), trigger,
            id=job_name, replace_existing=True, coalesce=True, max_instances=1,
        )
    else:
        sched.reschedule_job(job_name, trigger=trigger)
