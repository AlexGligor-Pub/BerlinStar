"""ANAF OAuth 2.0 Authorization Code Grant + auto-refresh.

Flow:
1. build_authorize_url(company_id) -> redirect user-ul la ANAF SPV; user-ul autentifica
   cu certificatul digital de pe USB (CertSign/DigiSign/TransSped/AlfaSign).
2. handle_callback(code, state) -> server-to-server schimb cu /token, salveaza
   access+refresh tokens criptati cu Fernet (vezi crypto.py).
3. get_valid_access_token(company_id) -> wrapper folosit de toate apelurile catre
   ANAF API. Refresh automat daca expira in <5 min.

NOTA: tokenii ANAF expira complet la 90 zile (refresh_token inclus). Cand expira,
e nevoie de reconectare cu USB (job-ul efactura_token_expiry_alert trimite reminder
la 14 zile inainte).
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
from app.efactura.models import AnafSettings, AnafToken
from app.models.company import Company

log = logging.getLogger("berlinstar.efactura.oauth")

_STATE_EXP_MINUTES = 10
_TOKEN_LIFETIME_DAYS = 90  # ANAF default, conform documentatiei
_REFRESH_THRESHOLD_SECONDS = 5 * 60  # refresh daca expira in <5 min


# ---------- State JWT (CSRF protection) ----------

def _encode_state(company_id: int) -> str:
    payload = {
        "cid": int(company_id),
        "nonce": secrets.token_urlsafe(16),
        "exp": datetime.now(timezone.utc) + timedelta(minutes=_STATE_EXP_MINUTES),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def _decode_state(state: str) -> int:
    try:
        payload = jwt.decode(state, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError as exc:
        raise AnafAuthError("State OAuth expirat — reia procesul de conectare.") from exc
    except jwt.PyJWTError as exc:
        raise AnafAuthError(f"State OAuth invalid: {exc}") from exc
    cid = payload.get("cid")
    if not isinstance(cid, int) or cid <= 0:
        raise AnafAuthError("State OAuth invalid (cid).")
    return cid


# ---------- DB helpers ----------

async def _get_settings(db: AsyncSession, company_id: int) -> AnafSettings:
    row = (
        await db.execute(select(AnafSettings).where(AnafSettings.company_id == company_id))
    ).scalar_one_or_none()
    if row is None:
        raise AnafConfigError(
            f"Nu exista setari ANAF pentru company_id={company_id}. Configureaza-le mai intai."
        )
    return row


async def _get_company(db: AsyncSession, company_id: int) -> Company:
    row = (
        await db.execute(select(Company).where(Company.id == company_id))
    ).scalar_one_or_none()
    if row is None:
        raise AnafConfigError(f"Compania {company_id} nu exista.")
    return row


async def _get_redirect_uri(db: AsyncSession, settings: AnafSettings) -> str:
    cfg = await runtime_config.load(db)
    return (settings.redirect_uri or cfg.default_redirect_uri).strip()


# ---------- Public API ----------

async def build_authorize_url(db: AsyncSession, company_id: int) -> str:
    """Genereaza URL-ul de redirect catre ANAF SPV pentru login cu USB."""
    if not fernet_configured():
        raise AnafConfigError("Cheia Fernet nu este configurata. AdminV2 -> eFactura -> Configurare globala.")

    settings = await _get_settings(db, company_id)
    if not settings.client_id or not settings.client_secret_enc:
        raise AnafConfigError(
            "client_id si client_secret trebuie configurate inainte de Connect."
        )

    cfg = await runtime_config.load(db)
    state = _encode_state(company_id)
    redirect_uri = await _get_redirect_uri(db, settings)

    params = {
        "response_type": "code",
        "client_id": settings.client_id,
        "redirect_uri": redirect_uri,
        "state": state,
        # ANAF nu cere scope explicit pentru e-Factura
        "token_content_type": "jwt",
    }
    return f"{cfg.anaf_auth_url}?{urlencode(params)}"


async def handle_callback(db: AsyncSession, code: str, state: str) -> AnafToken:
    """Schimba authorization code cu access+refresh tokens si le salveaza criptat."""
    company_id = _decode_state(state)
    settings = await _get_settings(db, company_id)
    company = await _get_company(db, company_id)

    if not settings.client_id or not settings.client_secret_enc:
        raise AnafConfigError("Setari ANAF incomplete (client_id/secret).")

    client_secret = decrypt(settings.client_secret_enc)
    redirect_uri = await _get_redirect_uri(db, settings)
    cfg = await runtime_config.load(db)

    async with httpx.AsyncClient(timeout=30.0) as http:
        resp = await http.post(
            cfg.anaf_token_url,
            data={
                "grant_type": "authorization_code",
                "code": code,
                "client_id": settings.client_id,
                "client_secret": client_secret,
                "redirect_uri": redirect_uri,
                "token_content_type": "jwt",
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
    if resp.status_code != 200:
        log.error("ANAF token exchange failed: status=%s body=%s", resp.status_code, resp.text[:500])
        raise AnafAuthError(f"ANAF a respins schimbul de cod (HTTP {resp.status_code}).")

    body = resp.json()
    access_token = body.get("access_token")
    refresh_token = body.get("refresh_token")
    expires_in = int(body.get("expires_in") or 0)
    scope = body.get("scope")
    token_type = body.get("token_type") or "Bearer"

    if not access_token or not refresh_token:
        raise AnafAuthError("Raspunsul ANAF nu contine access_token / refresh_token.")

    # Daca ANAF nu returneaza expires_in, folosim 90 zile conform documentatiei
    if expires_in <= 0:
        expires_at = datetime.now(timezone.utc) + timedelta(days=_TOKEN_LIFETIME_DAYS)
    else:
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)

    existing = (
        await db.execute(select(AnafToken).where(AnafToken.company_id == company_id))
    ).scalar_one_or_none()

    if existing is None:
        existing = AnafToken(
            company_id=company_id,
            cui=str(company.cui),
            access_token_enc=encrypt(access_token),
            refresh_token_enc=encrypt(refresh_token),
            expires_at=expires_at,
            token_type=token_type,
            scope=scope,
        )
        db.add(existing)
    else:
        existing.cui = str(company.cui)
        existing.access_token_enc = encrypt(access_token)
        existing.refresh_token_enc = encrypt(refresh_token)
        existing.expires_at = expires_at
        existing.token_type = token_type
        existing.scope = scope
        existing.updated_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(existing)
    log.info("ANAF token saved for company_id=%s expires_at=%s", company_id, expires_at.isoformat())
    return existing


async def _refresh_token(db: AsyncSession, token: AnafToken) -> AnafToken:
    """Cere un nou access_token folosind refresh_token-ul existent."""
    settings = await _get_settings(db, token.company_id)
    if not settings.client_id or not settings.client_secret_enc:
        raise AnafConfigError("Setari ANAF incomplete pentru refresh.")

    client_secret = decrypt(settings.client_secret_enc)
    refresh_token = decrypt(token.refresh_token_enc)
    cfg = await runtime_config.load(db)

    async with httpx.AsyncClient(timeout=30.0) as http:
        resp = await http.post(
            cfg.anaf_token_url,
            data={
                "grant_type": "refresh_token",
                "refresh_token": refresh_token,
                "client_id": settings.client_id,
                "client_secret": client_secret,
                "token_content_type": "jwt",
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
    if resp.status_code == 400 or resp.status_code == 401:
        log.warning(
            "Refresh ANAF refuzat (status=%s) pentru company_id=%s — necesita reconnect cu USB",
            resp.status_code, token.company_id,
        )
        raise AnafTokenExpired(
            "Refresh token expirat sau invalid. Reconectare cu USB necesara."
        )
    if resp.status_code != 200:
        log.error("ANAF refresh failed: status=%s body=%s", resp.status_code, resp.text[:500])
        raise AnafAuthError(f"ANAF a respins refresh-ul (HTTP {resp.status_code}).")

    body = resp.json()
    new_access = body.get("access_token")
    new_refresh = body.get("refresh_token") or refresh_token  # uneori ANAF nu rotește refresh
    expires_in = int(body.get("expires_in") or 0)
    if not new_access:
        raise AnafAuthError("Raspunsul refresh nu contine access_token.")

    token.access_token_enc = encrypt(new_access)
    token.refresh_token_enc = encrypt(new_refresh)
    if expires_in > 0:
        token.expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
    else:
        token.expires_at = datetime.now(timezone.utc) + timedelta(days=_TOKEN_LIFETIME_DAYS)
    token.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(token)
    log.info("ANAF token refreshed for company_id=%s expires_at=%s", token.company_id, token.expires_at.isoformat())
    return token


async def get_valid_access_token(db: AsyncSession, company_id: int) -> str:
    """Returneaza access_token valid, refreshuind tacit daca e necesar."""
    token = (
        await db.execute(select(AnafToken).where(AnafToken.company_id == company_id))
    ).scalar_one_or_none()
    if token is None:
        raise AnafTokenMissing(f"Nu exista token ANAF pentru company_id={company_id}.")

    expires_at = token.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    seconds_left = (expires_at - datetime.now(timezone.utc)).total_seconds()
    if seconds_left < _REFRESH_THRESHOLD_SECONDS:
        token = await _refresh_token(db, token)

    return decrypt(token.access_token_enc)


async def revoke(db: AsyncSession, company_id: int) -> bool:
    """Sterge tokenul ANAF al companiei (ANAF nu are endpoint /revoke)."""
    token = (
        await db.execute(select(AnafToken).where(AnafToken.company_id == company_id))
    ).scalar_one_or_none()
    if token is None:
        return False
    await db.delete(token)
    await db.commit()
    log.info("ANAF token deleted for company_id=%s", company_id)
    return True


def days_until_expiry(token: AnafToken) -> int:
    expires_at = token.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    return (expires_at - datetime.now(timezone.utc)).days
