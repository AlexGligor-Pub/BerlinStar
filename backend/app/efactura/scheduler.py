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

import logging
from datetime import datetime, timedelta, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy import select

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
from app.efactura.models import AnafSettings, AnafToken, EFacturaRecord
from app.models.receipt import Receipt

log = logging.getLogger("berlinstar.efactura.scheduler")

_BUCHAREST_TZ = "Europe/Bucharest"
_scheduler: AsyncIOScheduler | None = None


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
                await efactura_service.prepare_and_upload(db, receipt)
            except (AnafTokenMissing, AnafTokenExpired, AnafConfigError) as exc:
                log.warning("Upload blocat pentru rec=%s: %s", rec.id, exc)
            except EFacturaError as exc:
                log.warning("Upload esuat pentru rec=%s: %s", rec.id, exc)


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
        for rec in rows:
            if rec.next_retry_at and rec.next_retry_at.replace(tzinfo=timezone.utc) > now:
                continue
            try:
                await efactura_service.poll_status(db, rec)
            except (AnafAuthError, EFacturaError) as exc:
                log.warning("poll_status esuat pentru rec=%s: %s", rec.id, exc)


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
        for rec in rows:
            try:
                await efactura_service.download_and_archive(db, rec)
            except EFacturaError as exc:
                log.warning("Download esuat pentru rec=%s: %s", rec.id, exc)


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

    _scheduler.add_job(
        job_upload_pending,
        IntervalTrigger(minutes=5, timezone=_BUCHAREST_TZ),
        id="efactura_upload_pending",
        replace_existing=True,
        coalesce=True,
        max_instances=1,
    )
    _scheduler.add_job(
        job_poll_status,
        IntervalTrigger(minutes=10, timezone=_BUCHAREST_TZ),
        id="efactura_poll_status",
        replace_existing=True,
        coalesce=True,
        max_instances=1,
    )
    _scheduler.add_job(
        job_download_responses,
        IntervalTrigger(minutes=30, timezone=_BUCHAREST_TZ),
        id="efactura_download_responses",
        replace_existing=True,
        coalesce=True,
        max_instances=1,
    )
    _scheduler.add_job(
        job_deadline_alert,
        CronTrigger(hour=8, minute=0, timezone=_BUCHAREST_TZ),
        id="efactura_deadline_alert",
        replace_existing=True,
        coalesce=True,
        max_instances=1,
    )
    _scheduler.add_job(
        job_token_expiry_alert,
        CronTrigger(hour=9, minute=0, timezone=_BUCHAREST_TZ),
        id="efactura_token_expiry_alert",
        replace_existing=True,
        coalesce=True,
        max_instances=1,
    )
    _scheduler.add_job(
        job_sync_received,
        IntervalTrigger(minutes=60, timezone=_BUCHAREST_TZ),
        id="efactura_sync_received",
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
    "efactura_sync_received": job_sync_received,
}


async def trigger_job(job_name: str) -> None:
    """Apeleaza job-ul direct (pentru debugging din admin UI)."""
    fn = _JOB_FN_MAP.get(job_name)
    if fn is None:
        raise ValueError(f"Job necunoscut: {job_name}")
    await fn()
