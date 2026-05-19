"""OAuth ANAF la nivel de platforma (BerlinStar SRL).

Adapteaza patternul din app.efactura.oauth_service pentru singleton-ul
`platform_anaf_token` (1 rand, NU per-company). Reutilizeaza:
- aceleasi URL-uri OAuth si client_id/client_secret globale (din
  efactura_global_settings.oauth_client_id/oauth_client_secret_enc)
- aceeasi cheie Fernet pentru criptare access/refresh tokens
- aceeasi durata token (90 zile)
"""
from __future__ import annotations

import logging
import secrets
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

import httpx
import jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import ALGORITHM, SECRET_KEY
from app.efactura import runtime_config
from app.efactura.crypto import decrypt, encrypt, is_configured as fernet_configured
from app.efactura.exceptions import (
    AnafAuthError,
    AnafConfigError,
    AnafTokenExpired,
    AnafTokenMissing,
)
from app.models.global_settings import GlobalSettings
from app.models.subscription import PlatformAnafToken
from app.subscriptions.settings import get_or_create_global_settings

log = logging.getLogger("berlinstar.subscriptions.platform_oauth")

_STATE_EXP_MINUTES = 10
_TOKEN_LIFETIME_DAYS = 90
_REFRESH_THRESHOLD_SECONDS = 5 * 60
# Marker JWT — diferit de cel per-company ca sa nu poata fi confundat / reused
_STATE_KIND = "platform-subscription"


def _encode_state() -> str:
    payload = {
        "kind": _STATE_KIND,
        "nonce": secrets.token_urlsafe(16),
        "exp": datetime.now(timezone.utc) + timedelta(minutes=_STATE_EXP_MINUTES),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def _decode_state(state: str) -> None:
    try:
        payload = jwt.decode(state, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError as exc:
        raise AnafAuthError("State OAuth expirat — reia procesul de conectare.") from exc
    except jwt.PyJWTError as exc:
        raise AnafAuthError(f"State OAuth invalid: {exc}") from exc
    if payload.get("kind") != _STATE_KIND:
        raise AnafAuthError("State OAuth invalid (kind).")


async def _get_oauth_credentials(db: AsyncSession) -> tuple[str, str]:
    cfg = await runtime_config.load(db)
    if not cfg.oauth_client_id or not cfg.oauth_client_secret_enc:
        raise AnafConfigError(
            "OAuth ANAF nu este configurat global. Administratorul BerlinStar trebuie "
            "sa seteze client_id si client_secret in AdminV2 -> eFactura -> Configurare globala."
        )
    return cfg.oauth_client_id, decrypt(cfg.oauth_client_secret_enc)


def _platform_redirect_uri(db_cfg) -> str:
    """Redirect URI distinct pentru fluxul de platforma — sub /api/admin/subscription/anaf/callback.

    BerlinStar trebuie sa inregistreze ACEST URI la ANAF (separat de cel
    per-company, care merge sub /api/efactura/callback).
    """
    base = db_cfg.default_redirect_uri.rsplit("/", 1)[0] if "/" in (db_cfg.default_redirect_uri or "") else ""
    if not base:
        return "http://localhost:8000/api/admin/subscription/anaf/callback"
    return f"{base.replace('/api/efactura', '/api/admin/subscription/anaf')}"  # naive but works for our shape


async def _get_redirect_uri(db: AsyncSession) -> str:
    cfg = await runtime_config.load(db)
    return _platform_redirect_uri(cfg)


async def _get_token_row(db: AsyncSession) -> PlatformAnafToken | None:
    return (
        await db.execute(select(PlatformAnafToken).limit(1))
    ).scalar_one_or_none()


async def build_authorize_url(db: AsyncSession) -> str:
    """URL ANAF SPV pentru login cu USB-ul firmei BerlinStar SRL."""
    if not fernet_configured():
        raise AnafConfigError(
            "Cheia Fernet nu este configurata. AdminV2 -> eFactura -> Configurare globala."
        )
    gs = await get_or_create_global_settings(db)
    if not (gs.issuer_cui or "").strip():
        raise AnafConfigError(
            "CUI-ul firmei BerlinStar nu este configurat. AdminV2 -> Abonament -> Setari."
        )

    client_id, _ = await _get_oauth_credentials(db)
    cfg = await runtime_config.load(db)
    state = _encode_state()
    redirect_uri = await _get_redirect_uri(db)

    params = {
        "response_type": "code",
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "state": state,
        "token_content_type": "jwt",
    }
    return f"{cfg.anaf_auth_url}?{urlencode(params)}"


async def handle_callback(db: AsyncSession, code: str, state: str) -> PlatformAnafToken:
    _decode_state(state)
    gs = await get_or_create_global_settings(db)
    if not (gs.issuer_cui or "").strip():
        raise AnafConfigError("CUI-ul firmei BerlinStar nu este configurat.")

    client_id, client_secret = await _get_oauth_credentials(db)
    redirect_uri = await _get_redirect_uri(db)
    cfg = await runtime_config.load(db)

    async with httpx.AsyncClient(timeout=30.0) as http:
        resp = await http.post(
            cfg.anaf_token_url,
            data={
                "grant_type": "authorization_code",
                "code": code,
                "client_id": client_id,
                "client_secret": client_secret,
                "redirect_uri": redirect_uri,
                "token_content_type": "jwt",
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
    if resp.status_code != 200:
        log.error("Platform ANAF token exchange failed: status=%s", resp.status_code)
        raise AnafAuthError(f"ANAF a respins schimbul de cod (HTTP {resp.status_code}).")

    body = resp.json()
    access_token = body.get("access_token")
    refresh_token = body.get("refresh_token")
    expires_in = int(body.get("expires_in") or 0)
    scope = body.get("scope")
    token_type = body.get("token_type") or "Bearer"

    if not access_token or not refresh_token:
        raise AnafAuthError("Raspunsul ANAF nu contine access_token / refresh_token.")

    expires_at = (
        datetime.now(timezone.utc) + timedelta(seconds=expires_in)
        if expires_in > 0
        else datetime.now(timezone.utc) + timedelta(days=_TOKEN_LIFETIME_DAYS)
    )

    existing = await _get_token_row(db)
    if existing is None:
        existing = PlatformAnafToken(
            cui=str(gs.issuer_cui).strip(),
            access_token_enc=encrypt(access_token),
            refresh_token_enc=encrypt(refresh_token),
            expires_at=expires_at,
            token_type=token_type,
            scope=scope,
        )
        db.add(existing)
    else:
        existing.cui = str(gs.issuer_cui).strip()
        existing.access_token_enc = encrypt(access_token)
        existing.refresh_token_enc = encrypt(refresh_token)
        existing.expires_at = expires_at
        existing.token_type = token_type
        existing.scope = scope
        existing.updated_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(existing)
    log.info("Platform ANAF token saved (CUI=%s, expires_at=%s)", existing.cui, expires_at.isoformat())
    return existing


async def _refresh_token(db: AsyncSession, token: PlatformAnafToken) -> PlatformAnafToken:
    client_id, client_secret = await _get_oauth_credentials(db)
    refresh_token = decrypt(token.refresh_token_enc)
    cfg = await runtime_config.load(db)

    async with httpx.AsyncClient(timeout=30.0) as http:
        resp = await http.post(
            cfg.anaf_token_url,
            data={
                "grant_type": "refresh_token",
                "refresh_token": refresh_token,
                "client_id": client_id,
                "client_secret": client_secret,
                "token_content_type": "jwt",
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
    if resp.status_code in (400, 401):
        raise AnafTokenExpired(
            "Refresh token platforma expirat — reconectare cu USB BerlinStar SRL."
        )
    if resp.status_code != 200:
        raise AnafAuthError(f"ANAF a respins refresh-ul platforma (HTTP {resp.status_code}).")

    body = resp.json()
    new_access = body.get("access_token")
    new_refresh = body.get("refresh_token") or refresh_token
    expires_in = int(body.get("expires_in") or 0)
    if not new_access:
        raise AnafAuthError("Raspunsul refresh platforma nu contine access_token.")

    token.access_token_enc = encrypt(new_access)
    token.refresh_token_enc = encrypt(new_refresh)
    token.expires_at = (
        datetime.now(timezone.utc) + timedelta(seconds=expires_in)
        if expires_in > 0
        else datetime.now(timezone.utc) + timedelta(days=_TOKEN_LIFETIME_DAYS)
    )
    token.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(token)
    log.info("Platform ANAF token refreshed (expires_at=%s)", token.expires_at.isoformat())
    return token


async def get_valid_access_token(db: AsyncSession) -> str:
    token = await _get_token_row(db)
    if token is None:
        raise AnafTokenMissing("Nu exista token ANAF platforma. Conecteaza-te din AdminV2 -> Abonament.")
    expires_at = token.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    seconds_left = (expires_at - datetime.now(timezone.utc)).total_seconds()
    if seconds_left < _REFRESH_THRESHOLD_SECONDS:
        token = await _refresh_token(db, token)
    return decrypt(token.access_token_enc)


async def revoke(db: AsyncSession) -> bool:
    token = await _get_token_row(db)
    if token is None:
        return False
    await db.delete(token)
    await db.commit()
    log.info("Platform ANAF token deleted")
    return True


def days_until_expiry(token: PlatformAnafToken) -> int:
    expires_at = token.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    return (expires_at - datetime.now(timezone.utc)).days
