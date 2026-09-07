"""Autentificare intre servicii: secret comun + contul pus de monolit in header."""
from __future__ import annotations

import hmac

from fastapi import Header, HTTPException

from app.config import SHARED_SECRET


async def require_service_token(x_service_token: str = Header(default="")) -> None:
    """Doar monolitul cunoaste secretul; orice altceva primeste 401."""
    if not hmac.compare_digest(x_service_token or "", SHARED_SECRET):
        raise HTTPException(401, "Token de serviciu invalid.")


async def require_account(
    x_service_token: str = Header(default=""),
    x_account_id: str = Header(default=""),
) -> int:
    """Contul vine exclusiv din `X-Account-Id`; nu se accepta din body sau path."""
    await require_service_token(x_service_token)
    try:
        account_id = int(x_account_id)
    except (TypeError, ValueError):
        raise HTTPException(400, "Header-ul X-Account-Id lipseste sau nu este numeric.")
    if account_id <= 0:
        raise HTTPException(400, "Header-ul X-Account-Id lipseste sau nu este numeric.")
    return account_id
