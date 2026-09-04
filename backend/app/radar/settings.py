"""Citeste cheile si tarifele AI din global_settings (criptate cu Fernet-ul global)."""
from __future__ import annotations

import logging
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.efactura.crypto import decrypt, is_configured as fernet_configured
from app.models.global_settings import GlobalSettings

from .types import DEFAULT_MODEL, DEFAULT_PRICE_IN_USD_MTOK, DEFAULT_PRICE_OUT_USD_MTOK

log = logging.getLogger("berlinstar.radar.settings")


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


def _decrypt_or_none(enc: str | None) -> str | None:
    if not enc or not fernet_configured():
        return None
    try:
        return decrypt(enc)
    except Exception as exc:  # noqa: BLE001
        log.warning("Radar: cheia AI nu a putut fi decriptata: %s", exc)
        return None


async def load_ai_settings(db: AsyncSession) -> AISettings:
    """Setarile AI globale, cu defaults din types.py cand coloanele sunt NULL."""
    gs = (await db.execute(select(GlobalSettings).limit(1))).scalar_one_or_none()
    if gs is None:
        return AISettings(
            api_key=None,
            places_key=None,
            model=DEFAULT_MODEL,
            price_in=DEFAULT_PRICE_IN_USD_MTOK,
            price_out=DEFAULT_PRICE_OUT_USD_MTOK,
        )
    return AISettings(
        api_key=_decrypt_or_none(gs.anthropic_api_key_enc),
        places_key=_decrypt_or_none(gs.google_places_api_key_enc),
        model=gs.ai_model or DEFAULT_MODEL,
        price_in=float(gs.ai_price_in_usd_mtok) if gs.ai_price_in_usd_mtok is not None else DEFAULT_PRICE_IN_USD_MTOK,
        price_out=float(gs.ai_price_out_usd_mtok) if gs.ai_price_out_usd_mtok is not None else DEFAULT_PRICE_OUT_USD_MTOK,
    )
