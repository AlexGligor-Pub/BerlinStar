"""Runtime config eFactura — citeste valorile din DB (tabel efactura_global_settings).

Cache module-level pentru valori folosite frecvent (Fernet key, URLs ANAF).
Cache-ul se invalideaza la fiecare PATCH /global din router_admin.

Valori implicite (fallback) — daca DB-ul nu are nimic setat:
- Fernet key: auto-generat la primul Save din UI (sau la prima rulare daca env e set)
- URLs ANAF: defaults oficiale (rar se schimba)
- Scheduler enabled: False
- Redirect URI: http://localhost:8000/api/efactura/callback
"""
from __future__ import annotations

import logging
import os
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.efactura.models import EFacturaGlobalSettings

log = logging.getLogger("berlinstar.efactura.runtime_config")


# Defaults oficiale ANAF (conform documentatiei mai 2026)
DEFAULT_ANAF_AUTH_URL = "https://logincert.anaf.ro/anaf-oauth2/v1/authorize"
DEFAULT_ANAF_TOKEN_URL = "https://logincert.anaf.ro/anaf-oauth2/v1/token"
DEFAULT_ANAF_API_BASE_PROD = "https://api.anaf.ro/prod/FCTEL/rest"
DEFAULT_ANAF_API_BASE_TEST = "https://api.anaf.ro/test/FCTEL/rest"
DEFAULT_REDIRECT_URI = "http://localhost:8000/api/efactura/callback"
DEFAULT_FRONTEND_CALLBACK = "http://localhost:2000/adminv2?section=efactura"


@dataclass
class ResolvedConfig:
    fernet_key: str | None
    anaf_auth_url: str
    anaf_token_url: str
    anaf_api_base_prod: str
    anaf_api_base_test: str
    default_redirect_uri: str
    frontend_callback_redirect: str
    scheduler_enabled: bool

    def api_base(self, use_test: bool) -> str:
        return self.anaf_api_base_test if use_test else self.anaf_api_base_prod


# Cache module-level — invalidat de invalidate_cache() la PATCH /global
_cache: ResolvedConfig | None = None


def _resolve(row: EFacturaGlobalSettings | None) -> ResolvedConfig:
    """Compune ResolvedConfig din DB + fallback la env vars + defaults."""
    fernet = (row.fernet_key if row else None) or os.getenv("ANAF_FERNET_KEY") or None
    return ResolvedConfig(
        fernet_key=fernet,
        anaf_auth_url=(row.anaf_auth_url if row else None) or os.getenv("ANAF_AUTH_URL") or DEFAULT_ANAF_AUTH_URL,
        anaf_token_url=(row.anaf_token_url if row else None) or os.getenv("ANAF_TOKEN_URL") or DEFAULT_ANAF_TOKEN_URL,
        anaf_api_base_prod=(row.anaf_api_base_prod if row else None) or os.getenv("ANAF_API_BASE_PROD") or DEFAULT_ANAF_API_BASE_PROD,
        anaf_api_base_test=(row.anaf_api_base_test if row else None) or os.getenv("ANAF_API_BASE_TEST") or DEFAULT_ANAF_API_BASE_TEST,
        default_redirect_uri=(row.default_redirect_uri if row else None) or os.getenv("ANAF_DEFAULT_REDIRECT_URI") or DEFAULT_REDIRECT_URI,
        frontend_callback_redirect=(row.frontend_callback_redirect if row else None) or os.getenv("ANAF_FRONTEND_CALLBACK_REDIRECT") or DEFAULT_FRONTEND_CALLBACK,
        scheduler_enabled=bool(row.scheduler_enabled if row else (os.getenv("EFACTURA_SCHEDULER_ENABLED") == "1")),
    )


async def get_or_create_row(db: AsyncSession) -> EFacturaGlobalSettings:
    row = (await db.execute(select(EFacturaGlobalSettings).limit(1))).scalar_one_or_none()
    if row is None:
        row = EFacturaGlobalSettings()
        db.add(row)
        await db.commit()
        await db.refresh(row)
    return row


async def load(db: AsyncSession, force: bool = False) -> ResolvedConfig:
    """Returneaza config-ul curent (din cache daca exista, sau citeste DB)."""
    global _cache
    if _cache is not None and not force:
        return _cache
    row = await get_or_create_row(db)
    _cache = _resolve(row)
    return _cache


def get_cached() -> ResolvedConfig | None:
    """Returneaza cache-ul, sau None daca n-a fost incarcat inca."""
    return _cache


def set_cached(cfg: ResolvedConfig) -> None:
    """Suprascrie cache-ul (folosit de PATCH /global)."""
    global _cache
    _cache = cfg


def invalidate_cache() -> None:
    """Forteaza re-read din DB la urmatorul apel get/load."""
    global _cache
    _cache = None


def generate_fernet_key() -> str:
    """Genereaza o cheie Fernet noua (urlsafe base64, 32 bytes)."""
    from cryptography.fernet import Fernet
    return Fernet.generate_key().decode("utf-8")


async def ensure_fernet_key(db: AsyncSession) -> str:
    """Garanteaza ca exista o cheie Fernet (auto-genereaza daca lipseste). Returneaza cheia."""
    row = await get_or_create_row(db)
    if row.fernet_key:
        return row.fernet_key
    # auto-generate
    new_key = generate_fernet_key()
    row.fernet_key = new_key
    await db.commit()
    invalidate_cache()
    log.info("Cheie Fernet auto-generata pentru efactura_global_settings.")
    return new_key
