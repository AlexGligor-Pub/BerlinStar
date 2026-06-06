"""
Asistent AI (AdminV2) — proxy autentificat catre agent-bridge de pe host.

Backend-ul NU ruleaza Claude. Doar:
  - valideaza super-admin (cont "admin"),
  - paseaza prompt-ul catre bridge (header X-Bridge-Secret),
  - re-emite stream-ul SSE al bridge-ului catre browser.

Auth:
  - POST-urile cer Authorization: Bearer <admin>  (Depends(_require_super_admin)).
  - GET /events nu poate trimite Authorization (EventSource), deci foloseste un
    token scurt cu scope="assistant" trecut prin query (pattern ca la Rapoarte),
    re-verificat ca apartine contului admin.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone

import httpx
import jwt
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import (
    ALGORITHM,
    ASSISTANT_BRIDGE_SECRET,
    ASSISTANT_BRIDGE_URL,
    ASSISTANT_ENABLED,
    SECRET_KEY,
)
from app.database import get_db
from app.models.account import Account
from app.rate_limit import limiter
from app.routers.admin import _require_super_admin

log = logging.getLogger("berlinstar")
router = APIRouter()

ASSISTANT_TOKEN_TTL_SECONDS = 30 * 60  # token de stream scurt (30 min)


class StartBody(BaseModel):
    prompt: str


class TurnBody(BaseModel):
    prompt: str


def _ensure_enabled() -> None:
    if not ASSISTANT_ENABLED:
        raise HTTPException(404, "Asistent AI dezactivat.")
    if not ASSISTANT_BRIDGE_SECRET:
        raise HTTPException(503, "Asistent AI neconfigurat (ASSISTANT_BRIDGE_SECRET lipseste).")


def _bridge_headers() -> dict[str, str]:
    return {"X-Bridge-Secret": ASSISTANT_BRIDGE_SECRET or ""}


def _mint_stream_token(account_id: int) -> str:
    payload = {
        "sub": str(account_id),
        "scope": "assistant",
        "exp": datetime.now(timezone.utc) + timedelta(seconds=ASSISTANT_TOKEN_TTL_SECONDS),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


async def _require_assistant_admin_from_query(
    token: str = Query(...),
    db: AsyncSession = Depends(get_db),
) -> Account:
    """Valideaza token-ul de stream (scope=assistant) si ca e contul admin."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expirat.")
    except jwt.PyJWTError:
        raise HTTPException(401, "Token invalid.")
    if payload.get("scope") != "assistant":
        raise HTTPException(401, "Token fara acces la Asistent.")
    try:
        account_id = int(payload.get("sub"))
    except (TypeError, ValueError):
        raise HTTPException(401, "Token invalid.")
    account = (await db.execute(
        select(Account).where(
            Account.id == account_id,
            Account.is_deleted == False,  # noqa: E712
            Account.username == "admin",
        )
    )).scalar_one_or_none()
    if account is None:
        raise HTTPException(403, "Acces interzis.")
    return account


@router.post("/chats")
@limiter.limit("20/minute")
async def start_chat(
    request: Request,
    body: StartBody,
    admin: Account = Depends(_require_super_admin),
):
    _ensure_enabled()
    log.warning("AsistentAI: admin id=%s start chat: %r", admin.id, body.prompt[:200])
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.post(
                f"{ASSISTANT_BRIDGE_URL}/agent/chats",
                json={"prompt": body.prompt},
                headers=_bridge_headers(),
            )
            r.raise_for_status()
            chat_id = r.json()["chat_id"]
    except httpx.HTTPError as exc:
        log.error("AsistentAI: bridge indisponibil: %s", exc)
        raise HTTPException(502, "Asistentul (bridge) nu raspunde.")
    return {"chat_id": chat_id, "stream_token": _mint_stream_token(admin.id)}


@router.post("/chats/{chat_id}/turns")
@limiter.limit("40/minute")
async def add_turn(
    request: Request,
    chat_id: str,
    body: TurnBody,
    admin: Account = Depends(_require_super_admin),
):
    _ensure_enabled()
    log.warning("AsistentAI: admin id=%s turn chat=%s: %r", admin.id, chat_id, body.prompt[:200])
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.post(
                f"{ASSISTANT_BRIDGE_URL}/agent/chats/{chat_id}/turns",
                json={"prompt": body.prompt},
                headers=_bridge_headers(),
            )
            r.raise_for_status()
    except httpx.HTTPError as exc:
        log.error("AsistentAI: bridge indisponibil: %s", exc)
        raise HTTPException(502, "Asistentul (bridge) nu raspunde.")
    return {"stream_token": _mint_stream_token(admin.id)}


@router.get("/chats/{chat_id}/events")
async def chat_events(
    chat_id: str,
    request: Request,
    _admin: Account = Depends(_require_assistant_admin_from_query),
):
    _ensure_enabled()
    bridge_url = f"{ASSISTANT_BRIDGE_URL}/agent/chats/{chat_id}/events"

    async def stream():
        # Timeout None pe read — stream-ul agentic poate dura minute.
        timeout = httpx.Timeout(None, connect=5.0)
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                async with client.stream("GET", bridge_url, headers=_bridge_headers()) as resp:
                    if resp.status_code != 200:
                        yield f"data: {json.dumps({'type': 'error', 'message': f'bridge {resp.status_code}'})}\n\n"
                        return
                    # Passthrough raw — pastreaza exact framing-ul SSE al bridge-ului.
                    async for chunk in resp.aiter_raw():
                        if await request.is_disconnected():
                            break
                        yield chunk
        except Exception as exc:  # noqa: BLE001
            log.error("AsistentAI: eroare stream: %s", exc)
            yield f"data: {json.dumps({'type': 'error', 'message': str(exc)})}\n\n"

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
