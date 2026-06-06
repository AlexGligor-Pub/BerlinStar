"""
BerlinStar agent-bridge — rulează Claude Code agentic PE HOST și îl expune
printr-un mic API HTTP/SSE pe care backend-ul (din container) îl proxează.

De ce există: backend-ul FastAPI rulează în Docker și NU are CLI-ul `claude`,
codul sursă, acces la docker sau cheia API. Toate astea sunt pe host (user
berlinqa, ~/berlinstar). Bridge-ul rulează aici, în afara Docker, și chiar
execută agentul în directorul proiectului.

Securitate: orice request trebuie să aibă header-ul X-Bridge-Secret egal cu
BRIDGE_SHARED_SECRET (comparat constant-time). Se leagă implicit pe toate
interfețele ca să fie reachable din container, dar portul NU e expus în afara
LAN-ului (nu e port-forwarded) și secretul îl protejează. Vezi README pentru
hardening cu firewall.

Rulează ca serviciu systemd --user. Vezi ops/agent-bridge/README.md.
"""
from __future__ import annotations

import asyncio
import hmac
import json
import logging
import os
import uuid
from typing import Any

from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO, format="%(asctime)s [bridge] %(levelname)s %(message)s")
log = logging.getLogger("agent-bridge")

# --- Config din env (setat de systemd EnvironmentFile) ---
BRIDGE_SECRET = os.getenv("BRIDGE_SHARED_SECRET", "")
BERLINSTAR_DIR = os.getenv("BERLINSTAR_DIR", os.path.expanduser("~/berlinstar"))
PERMISSION_MODE = os.getenv("AGENT_PERMISSION_MODE", "bypassPermissions")
AGENT_MODEL = os.getenv("AGENT_MODEL") or None  # None => default-ul CLI-ului
MAX_TURNS = int(os.getenv("AGENT_MAX_TURNS", "80"))

if not BRIDGE_SECRET:
    raise RuntimeError("BRIDGE_SHARED_SECRET lipsește — refuz să pornesc fără secret.")

# claude-agent-sdk e instalat în venv-ul bridge-ului.
from claude_agent_sdk import (  # noqa: E402
    ClaudeAgentOptions,
    query,
)

app = FastAPI(title="BerlinStar agent-bridge", version="1.0.0")


# chat_id -> {"session_id": str|None, "pending": str|None, "running": bool}
_CHATS: dict[str, dict[str, Any]] = {}


class StartBody(BaseModel):
    prompt: str
    permission_mode: str | None = None


class TurnBody(BaseModel):
    prompt: str


def _check_secret(secret: str | None) -> None:
    if not secret or not hmac.compare_digest(secret.encode(), BRIDGE_SECRET.encode()):
        raise HTTPException(status_code=401, detail="bridge: secret invalid")


def _sse(obj: dict) -> str:
    return f"data: {json.dumps(obj, ensure_ascii=False)}\n\n"


def _block_to_event(block: Any) -> dict | None:
    """Mapează un content-block SDK într-un eveniment SSE. Defensiv față de
    versiunea SDK — folosește type(name) + getattr."""
    name = type(block).__name__
    if name == "TextBlock":
        return {"type": "assistant_text", "text": getattr(block, "text", "")}
    if name == "ThinkingBlock":
        return {"type": "thinking", "text": getattr(block, "thinking", "") or getattr(block, "text", "")}
    if name == "ToolUseBlock":
        return {
            "type": "tool_use",
            "name": getattr(block, "name", "?"),
            "input": getattr(block, "input", {}),
        }
    if name == "ToolResultBlock":
        content = getattr(block, "content", None)
        # content poate fi listă de blocuri / str — îl reducem la text scurt
        text = content if isinstance(content, str) else json.dumps(content, ensure_ascii=False, default=str)
        return {
            "type": "tool_result",
            "is_error": bool(getattr(block, "is_error", False)),
            "text": (text or "")[:4000],
        }
    return None


async def _run_agent(chat_id: str, prompt: str, resume: str | None):
    """Async generator care rulează query() și produce evenimente SSE (str)."""
    options = ClaudeAgentOptions(
        cwd=BERLINSTAR_DIR,
        permission_mode=_CHATS[chat_id].get("permission_mode") or PERMISSION_MODE,
        max_turns=MAX_TURNS,
    )
    if AGENT_MODEL:
        options.model = AGENT_MODEL
    if resume:
        options.resume = resume

    yield _sse({"type": "start", "chat_id": chat_id})
    try:
        async for message in query(prompt=prompt, options=options):
            mname = type(message).__name__
            if mname == "SystemMessage":
                data = getattr(message, "data", {}) or {}
                sid = data.get("session_id") if isinstance(data, dict) else None
                if sid:
                    _CHATS[chat_id]["session_id"] = sid
                continue
            if mname in ("AssistantMessage", "UserMessage"):
                for block in getattr(message, "content", []) or []:
                    ev = _block_to_event(block)
                    if ev:
                        yield _sse(ev)
                continue
            if mname == "ResultMessage":
                sid = getattr(message, "session_id", None)
                if sid:
                    _CHATS[chat_id]["session_id"] = sid
                yield _sse({
                    "type": "result",
                    "session_id": _CHATS[chat_id].get("session_id"),
                    "is_error": bool(getattr(message, "is_error", False)),
                    "cost_usd": getattr(message, "total_cost_usd", None),
                    "result": getattr(message, "result", None),
                })
                continue
    except Exception as exc:  # noqa: BLE001
        log.exception("agent run a eșuat (chat=%s)", chat_id)
        yield _sse({"type": "error", "message": str(exc)})
    finally:
        _CHATS[chat_id]["running"] = False
        yield _sse({"type": "done"})


@app.get("/healthz")
async def healthz(x_bridge_secret: str | None = Header(default=None)):
    _check_secret(x_bridge_secret)
    return {"ok": True, "cwd": BERLINSTAR_DIR, "permission_mode": PERMISSION_MODE, "chats": len(_CHATS)}


@app.post("/agent/chats")
async def start_chat(body: StartBody, x_bridge_secret: str | None = Header(default=None)):
    _check_secret(x_bridge_secret)
    chat_id = uuid.uuid4().hex
    _CHATS[chat_id] = {
        "session_id": None,
        "pending": body.prompt,
        "running": False,
        "permission_mode": body.permission_mode,
    }
    log.info("chat nou %s: %r", chat_id, body.prompt[:120])
    return {"chat_id": chat_id}


@app.post("/agent/chats/{chat_id}/turns")
async def add_turn(chat_id: str, body: TurnBody, x_bridge_secret: str | None = Header(default=None)):
    _check_secret(x_bridge_secret)
    chat = _CHATS.get(chat_id)
    if chat is None:
        raise HTTPException(404, "chat inexistent")
    chat["pending"] = body.prompt
    log.info("tură nouă chat %s: %r", chat_id, body.prompt[:120])
    return {"ok": True}


@app.get("/agent/chats/{chat_id}/events")
async def chat_events(chat_id: str, request: Request, x_bridge_secret: str | None = Header(default=None)):
    _check_secret(x_bridge_secret)
    chat = _CHATS.get(chat_id)
    if chat is None:
        raise HTTPException(404, "chat inexistent")

    prompt = chat.get("pending")
    chat["pending"] = None

    async def stream():
        if not prompt:
            # Nicio tură în așteptare (ex. reconectare EventSource după result).
            yield _sse({"type": "idle"})
            return
        chat["running"] = True
        resume = chat.get("session_id")
        async for chunk in _run_agent(chat_id, prompt, resume):
            if await request.is_disconnected():
                break
            yield chunk

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
