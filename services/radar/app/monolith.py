"""Clientul HTTP catre monolit: context de business si chei AI. Cheile nu se logheaza."""
from __future__ import annotations

import logging
import time
from dataclasses import dataclass

import httpx

from app.config import AI_CONFIG_TTL, MONOLITH_TIMEOUT, MONOLITH_URL, SHARED_SECRET
from app.radar.types import DEFAULT_MODEL, DEFAULT_PRICE_IN_USD_MTOK, DEFAULT_PRICE_OUT_USD_MTOK

log = logging.getLogger("radar.monolith")

UNAVAILABLE_MESSAGE = (
    "Datele contului nu pot fi citite momentan (aplicația principală nu răspunde). "
    "Încearcă din nou în câteva minute."
)


class MonolithUnavailable(RuntimeError):
    """Monolitul nu a raspuns; mesajul e afisabil utilizatorului (romana)."""


@dataclass
class AISettings:
    api_key: str | None
    places_key: str | None
    model: str
    price_in: float
    price_out: float

    @property
    def configured(self) -> bool:
        return bool(self.api_key)

    @property
    def places_configured(self) -> bool:
        return bool(self.places_key)


_client: httpx.AsyncClient | None = None
_ai_cache: tuple[float, AISettings] | None = None


def client() -> httpx.AsyncClient:
    global _client
    if _client is None:
        _client = httpx.AsyncClient(
            base_url=MONOLITH_URL,
            timeout=MONOLITH_TIMEOUT,
            headers={"X-Service-Token": SHARED_SECRET},
        )
    return _client


async def close() -> None:
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None


async def _get(path: str, params: dict | None = None) -> dict:
    try:
        response = await client().get(path, params=params)
        response.raise_for_status()
        return response.json()
    except httpx.HTTPStatusError as exc:
        log.warning("Monolit %s -> HTTP %s", path, exc.response.status_code)
        raise MonolithUnavailable(UNAVAILABLE_MESSAGE) from exc
    except (httpx.HTTPError, ValueError) as exc:
        log.warning("Monolit %s indisponibil: %s", path, exc.__class__.__name__)
        raise MonolithUnavailable(UNAVAILABLE_MESSAGE) from exc


async def business_context(account_id: int) -> dict:
    """`{account_name, companies:[...], items:[...]}` — contextul de business al contului."""
    data = await _get("/api/internal/business-context", {"account_id": account_id})
    return {
        "account_name": str(data.get("account_name") or f"Cont {account_id}"),
        "companies": list(data.get("companies") or []),
        "items": list(data.get("items") or []),
    }


async def ai_config(force: bool = False) -> AISettings:
    """Cheile si tarifele AI din AdminV2, cache 60 s in memoria procesului."""
    global _ai_cache
    now = time.monotonic()
    if not force and _ai_cache is not None and now - _ai_cache[0] < AI_CONFIG_TTL:
        return _ai_cache[1]
    data = await _get("/api/internal/ai-config")
    settings = AISettings(
        api_key=(data.get("api_key") or None),
        places_key=(data.get("places_key") or None),
        model=(data.get("model") or DEFAULT_MODEL),
        price_in=float(data.get("price_in") or DEFAULT_PRICE_IN_USD_MTOK),
        price_out=float(data.get("price_out") or DEFAULT_PRICE_OUT_USD_MTOK),
    )
    _ai_cache = (now, settings)
    return settings


def reset_ai_cache() -> None:
    global _ai_cache
    _ai_cache = None
