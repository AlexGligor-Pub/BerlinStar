"""Helper-e pentru afisarea statusului abonamentului in navbar."""
from __future__ import annotations

from datetime import date
from typing import Literal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.subscription import AccountSubscription


BannerKind = Literal["ok", "warn", "danger", "expired"]


async def get_status(db: AsyncSession, account_id: int) -> dict:
    sub = (
        await db.execute(
            select(AccountSubscription).where(AccountSubscription.account_id == account_id)
        )
    ).scalar_one_or_none()
    if sub is None:
        return {
            "configured": False,
            "next_payment_date": None,
            "last_payment_date": None,
            "days_left": None,
            "banner_kind": "danger",
            "show_banner": True,
            "message": "Abonament neconfigurat. Te rugam contacteaza adminul BerlinStar.",
        }

    today = date.today()
    days_left = (sub.next_payment_date - today).days
    if days_left < 0:
        kind: BannerKind = "expired"
        show = True
        msg = "Abonamentul a expirat. Reinnoieste-l pentru a relua accesul."
    elif days_left <= 3:
        kind = "danger"
        show = True
        msg = (
            f"Abonamentul expira in {days_left} zile."
            if days_left > 0
            else "Abonamentul expira astazi."
        )
    elif days_left <= 7:
        kind = "warn"
        show = True
        msg = f"Abonamentul expira in {days_left} zile."
    else:
        kind = "ok"
        show = False
        msg = ""

    return {
        "configured": True,
        "next_payment_date": sub.next_payment_date.isoformat(),
        "last_payment_date": sub.last_payment_date.isoformat() if sub.last_payment_date else None,
        "days_left": days_left,
        "banner_kind": kind,
        "show_banner": show,
        "message": msg,
    }
