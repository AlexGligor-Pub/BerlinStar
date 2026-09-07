"""Client Anthropic pentru Radar AI: apel, parsare JSON tolerant, contorizare tokeni."""
from __future__ import annotations

import json
import logging
from decimal import Decimal
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from .types import (
    DEFAULT_MODEL,
    DEFAULT_PRICE_IN_USD_MTOK,
    DEFAULT_PRICE_OUT_USD_MTOK,
    AIResult,
)

log = logging.getLogger("berlinstar.radar.ai")



class AIError(RuntimeError):
    """Apelul catre modelul Claude a esuat; mesajul e afisabil utilizatorului (romana)."""


class AIClient:
    """Wrapper peste `anthropic.AsyncAnthropic` cu cache pe system prompt si calcul de cost."""

    def __init__(
        self,
        api_key: str,
        model: str | None = None,
        price_in: float | None = None,
        price_out: float | None = None,
    ):
        if not api_key:
            raise AIError("Cheia Anthropic nu este configurată (AdminV2).")
        self.api_key = api_key
        self.model = model or DEFAULT_MODEL
        self.price_in = float(price_in if price_in is not None else DEFAULT_PRICE_IN_USD_MTOK)
        self.price_out = float(price_out if price_out is not None else DEFAULT_PRICE_OUT_USD_MTOK)
        self._client: Any = None

    def _get_client(self) -> Any:
        if self._client is None:
            import anthropic

            self._client = anthropic.AsyncAnthropic(api_key=self.api_key, timeout=180.0, max_retries=2)
        return self._client

    def cost(self, tokens_in: int, tokens_out: int) -> float:
        return tokens_in * self.price_in / 1e6 + tokens_out * self.price_out / 1e6

    async def complete(self, system: str, user: str, max_tokens: int = 4096) -> AIResult:
        """Un apel non-stream; system-ul e trimis ca bloc cacheabil (ephemeral)."""
        payload: dict[str, Any] = {
            "model": self.model,
            "max_tokens": max_tokens,
            "system": [
                {"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}
            ],
            "messages": [{"role": "user", "content": user}],
        }
        client = self._get_client()
        try:
            msg = await client.messages.create(**payload)
        except Exception as exc:  # noqa: BLE001
            raise AIError(f"Apelul către Claude a eșuat: {exc}") from exc

        return AIResult(
            text=_message_text(msg),
            tokens_in=_tokens_in(msg),
            tokens_out=int(getattr(msg.usage, "output_tokens", 0) or 0),
            cost_usd=self.cost(_tokens_in(msg), int(getattr(msg.usage, "output_tokens", 0) or 0)),
            model=getattr(msg, "model", None) or self.model,
            stop_reason=str(getattr(msg, "stop_reason", "") or ""),
        )

    async def record_usage(
        self,
        db: AsyncSession,
        account_id: int,
        feature: str,
        result: AIResult,
        run_id: int | None = None,
        meta: dict | None = None,
    ):
        """Adauga o linie in `ai_usage` (flush, fara commit — decide apelantul)."""
        from app.models.radar import AiUsage

        row = AiUsage(
            account_id=account_id,
            feature=feature,
            model=result.model or self.model,
            tokens_in=result.tokens_in,
            tokens_out=result.tokens_out,
            cost_usd=Decimal(str(round(result.cost_usd, 6))),
            run_id=run_id,
            meta=meta,
        )
        db.add(row)
        await db.flush()
        return row


def _message_text(msg: Any) -> str:
    parts = []
    for block in getattr(msg, "content", None) or []:
        text = getattr(block, "text", None)
        if text is None and isinstance(block, dict):
            text = block.get("text")
        if text:
            parts.append(text)
    return "\n".join(parts).strip()


def _tokens_in(msg: Any) -> int:
    usage = getattr(msg, "usage", None)
    if usage is None:
        return 0
    total = 0
    for field in ("input_tokens", "cache_read_input_tokens", "cache_creation_input_tokens"):
        total += int(getattr(usage, field, 0) or 0)
    return total


def parse_json(text: str) -> dict:
    """Extrage primul obiect JSON dintr-un raspuns (fences ```json, proza inainte/dupa)."""
    if not text or not text.strip():
        raise ValueError("Răspuns gol de la AI.")
    raw = text.strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1] if "\n" in raw else ""
        if raw.rstrip().endswith("```"):
            raw = raw.rstrip()[:-3]
        raw = raw.strip()
    try:
        data = json.loads(raw)
    except (ValueError, TypeError):
        data = _json_from_braces(raw)
    if not isinstance(data, dict):
        raise ValueError("Răspunsul AI nu este un obiect JSON.")
    return data


def _json_from_braces(raw: str) -> Any:
    start = raw.find("{")
    end = raw.rfind("}")
    if start == -1 or end <= start:
        raise ValueError("Răspunsul AI nu conține JSON valid.")
    candidate = raw[start : end + 1]
    try:
        return json.loads(candidate)
    except ValueError:
        pass
    for close in range(end, start, -1):
        if raw[close] != "}":
            continue
        try:
            return json.loads(raw[start : close + 1])
        except ValueError:
            continue
    raise ValueError("Răspunsul AI nu conține JSON valid.")
