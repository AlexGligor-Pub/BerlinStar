from __future__ import annotations
import asyncio
import smtplib
import ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.email_log import EmailLog
from app.models.email_template import EmailTemplate
from app.models.global_settings import GlobalSettings


class _SafeDict(dict):
    """Returns '{key}' for missing keys so partial substitution never raises."""
    def __missing__(self, key: str) -> str:
        return "{" + key + "}"


def _build_msg(subject: str, from_label: str, to_address: str, body_html: str) -> MIMEMultipart:
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = from_label
    msg["To"] = to_address
    msg.attach(MIMEText(body_html, "html"))
    return msg


def _smtp_send(host: str, port: int, user: str, password: str, use_tls: bool, msg: MIMEMultipart) -> None:
    """Blocking SMTP send — called inside run_in_executor."""
    if use_tls:
        ctx = ssl.create_default_context()
        with smtplib.SMTP(host, port, timeout=15) as server:
            server.starttls(context=ctx)
            server.login(user, password)
            server.send_message(msg)
    else:
        with smtplib.SMTP_SSL(host, port, timeout=15) as server:
            server.login(user, password)
            server.send_message(msg)


async def _dispatch(settings: GlobalSettings, msg: MIMEMultipart) -> None:
    """Run blocking SMTP send in thread pool using the running event loop."""
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(
        None, _smtp_send,
        settings.smtp_host, settings.smtp_port, settings.smtp_user,
        settings.smtp_password, settings.smtp_use_tls, msg,
    )


async def _get_global(db: AsyncSession) -> GlobalSettings | None:
    result = await db.execute(select(GlobalSettings).limit(1))
    return result.scalar_one_or_none()


async def _log(
    db: AsyncSession,
    *,
    account_id: int | None,
    to_address: str,
    scenario: str | None,
    subject: str,
    status: str,
    error_message: str | None = None,
    body_html: str | None = None,
) -> None:
    db.add(EmailLog(
        account_id=account_id,
        to_address=to_address,
        scenario=scenario,
        subject=subject,
        status=status,
        error_message=error_message,
        body_html=body_html,
    ))
    await db.commit()


async def send_test_email(
    db: AsyncSession,
    to_address: str,
    account_id: int | None = None,
    subject: str | None = None,
    body_html: str | None = None,
) -> None:
    """
    Sends a test email (hardcoded content unless subject/body_html are provided).
    Raises ValueError if SMTP is not enabled/configured.
    Raises smtplib.SMTPException on delivery failure.
    """
    settings = await _get_global(db)
    if not settings or not settings.smtp_enabled:
        raise ValueError("Email SMTP nu este activat.")
    if not all([settings.smtp_host, settings.smtp_user, settings.smtp_password]):
        raise ValueError("Configurație SMTP incompletă (host, user, parolă necesare).")

    subject = subject or "Test email — BerlinStar"
    body_html = body_html or (
        "<p>Acesta este un <strong>email de test</strong> trimis din BerlinStar.</p>"
        "<p>Dacă îl primiți, configurația SMTP funcționează corect.</p>"
    )
    from_label = f"{settings.smtp_from_name or 'BerlinStar'} <{settings.smtp_from_address}>"
    msg = _build_msg(subject, from_label, to_address, body_html)

    try:
        await _dispatch(settings, msg)
        await _log(db, account_id=account_id, to_address=to_address,
                   scenario=None, subject=subject, status="ok", body_html=body_html)
    except Exception as exc:
        await _log(db, account_id=account_id, to_address=to_address,
                   scenario=None, subject=subject, status="error", error_message=str(exc), body_html=body_html)
        raise


async def send_email(
    db: AsyncSession,
    scenario: str,
    variables: dict,
    to_address: str,
    account_id: int | None = None,
) -> None:
    """
    Sends a template-based email. Silently does nothing if SMTP is disabled
    or the template is disabled/missing.
    """
    settings = await _get_global(db)
    if not settings or not settings.smtp_enabled:
        return

    result = await db.execute(
        select(EmailTemplate).where(
            EmailTemplate.scenario == scenario,
            EmailTemplate.enabled.is_(True),
        )
    )
    template = result.scalar_one_or_none()
    if template is None:
        return

    safe_vars = _SafeDict(variables)
    subject = template.subject.format_map(safe_vars)
    body_html = template.body.format_map(safe_vars)
    from_label = f"{settings.smtp_from_name or 'BerlinStar'} <{settings.smtp_from_address}>"
    msg = _build_msg(subject, from_label, to_address, body_html)

    try:
        await _dispatch(settings, msg)
        await _log(db, account_id=account_id, to_address=to_address,
                   scenario=scenario, subject=subject, status="ok", body_html=body_html)
    except Exception as exc:
        await _log(db, account_id=account_id, to_address=to_address,
                   scenario=scenario, subject=subject, status="error", error_message=str(exc), body_html=body_html)
        raise
