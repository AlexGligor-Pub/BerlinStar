from __future__ import annotations
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.email_log import EmailLog
from app.models.email_template import EmailTemplate
from app.models.global_settings import GlobalSettings
from app.schemas.email_settings import (
    EmailLogRead,
    EmailTemplateRead,
    EmailTemplatePatch,
    VALID_SCENARIOS,
)
from app.schemas.global_settings import SmtpSettingsRead, SmtpSettingsPatch
from app.utils.email_service import send_test_email

router = APIRouter()


async def _get_or_create_global(db: AsyncSession) -> GlobalSettings:
    result = await db.execute(select(GlobalSettings).limit(1))
    s = result.scalar_one_or_none()
    if s is None:
        s = GlobalSettings()
        db.add(s)
        await db.commit()
        await db.refresh(s)
    return s


# ── SMTP settings ──────────────────────────────────────────────────────────────

@router.get("/smtp", response_model=SmtpSettingsRead)
async def get_smtp(db: AsyncSession = Depends(get_db)):
    s = await _get_or_create_global(db)
    data = SmtpSettingsRead.model_validate(s)
    data.smtp_password = ""
    return data


@router.patch("/smtp", response_model=SmtpSettingsRead)
async def patch_smtp(body: SmtpSettingsPatch, db: AsyncSession = Depends(get_db)):
    s = await _get_or_create_global(db)
    patch_data = body.model_dump(exclude_unset=True)
    if patch_data.get("smtp_password") == "" or patch_data.get("smtp_password") is None:
        patch_data.pop("smtp_password", None)
    for k, v in patch_data.items():
        setattr(s, k, v)
    await db.commit()
    await db.refresh(s)
    data = SmtpSettingsRead.model_validate(s)
    data.smtp_password = ""
    return data


# ── Test email ─────────────────────────────────────────────────────────────────

class TestEmailRequest(BaseModel):
    to_address: str
    subject: str | None = None
    body_html: str | None = None


@router.post("/test")
async def test_email(body: TestEmailRequest, db: AsyncSession = Depends(get_db)):
    try:
        await send_test_email(db, body.to_address, subject=body.subject, body_html=body.body_html)
        return {"ok": True, "message": "Email trimis cu succes."}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Eroare SMTP: {e}")


# ── Email templates ────────────────────────────────────────────────────────────

@router.get("/templates", response_model=list[EmailTemplateRead])
async def get_templates(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(EmailTemplate))
    return result.scalars().all()


@router.patch("/templates/{scenario}", response_model=EmailTemplateRead)
async def patch_template(
    scenario: str,
    body: EmailTemplatePatch,
    db: AsyncSession = Depends(get_db),
):
    if scenario not in VALID_SCENARIOS:
        raise HTTPException(status_code=404, detail="Scenariu invalid.")
    result = await db.execute(select(EmailTemplate).where(EmailTemplate.scenario == scenario))
    tmpl = result.scalar_one_or_none()
    if tmpl is None:
        raise HTTPException(status_code=404, detail="Template negăsit.")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(tmpl, k, v)
    await db.commit()
    await db.refresh(tmpl)
    return tmpl


# ── Email logs ─────────────────────────────────────────────────────────────────

@router.get("/logs", response_model=list[EmailLogRead])
async def get_logs(
    account_id: int | None = None,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
):
    q = select(EmailLog).order_by(desc(EmailLog.sent_at)).limit(limit)
    if account_id is not None:
        q = q.where(EmailLog.account_id == account_id)
    result = await db.execute(q)
    return result.scalars().all()


@router.post("/logs/{log_id}/resend")
async def resend_log(log_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(EmailLog).where(EmailLog.id == log_id))
    log = result.scalar_one_or_none()
    if log is None:
        raise HTTPException(status_code=404, detail="Log negăsit.")
    try:
        await send_test_email(
            db,
            to_address=log.to_address,
            account_id=log.account_id,
            subject=log.subject,
            body_html=log.body_html,
        )
        return {"ok": True, "message": "Email retrims cu succes."}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Eroare SMTP: {e}")
