"""Fernet-based symmetric encryption for ANAF OAuth tokens and client secret.

Cheia se stocheaza in DB (efactura_global_settings.fernet_key) si se cache-uieste
module-level. La pornirea aplicatiei, lifespan-ul cheama set_fernet_key() ca sa
pre-incarce cache-ul. Cand admin-ul salveaza din UI, router_admin cheama tot
set_fernet_key() pentru a refolosi cache-ul cu noua valoare.

Backward compatibility: daca cache-ul e gol DAR exista ANAF_FERNET_KEY in env,
folosim env (pentru deployment-uri existente fara migrare ef09).
"""
from __future__ import annotations

import logging
import os

from cryptography.fernet import Fernet, InvalidToken

log = logging.getLogger("berlinstar.efactura.crypto")


class AnafCryptoError(RuntimeError):
    pass


_key_cache: str | None = None


def set_fernet_key(key: str | None) -> None:
    """Set the in-memory cache (called from lifespan startup + PATCH /global)."""
    global _key_cache
    _key_cache = key.strip() if key else None


def get_fernet_key() -> str | None:
    """Current key from cache, fallback to env."""
    if _key_cache:
        return _key_cache
    env_key = (os.getenv("ANAF_FERNET_KEY") or "").strip()
    return env_key or None


def is_configured() -> bool:
    return bool(get_fernet_key())


def _get_fernet() -> Fernet:
    key = get_fernet_key()
    if not key:
        raise AnafCryptoError(
            "Cheia Fernet nu este configurata. Mergi in AdminV2 -> eFactura -> "
            "Configurare globala si apasa 'Genereaza cheie noua'."
        )
    try:
        return Fernet(key.encode("utf-8"))
    except Exception as exc:  # noqa: BLE001
        raise AnafCryptoError(f"Cheia Fernet este invalida: {exc}") from exc


def encrypt(plain: str) -> str:
    if plain is None:
        raise ValueError("Cannot encrypt None")
    return _get_fernet().encrypt(plain.encode("utf-8")).decode("utf-8")


def decrypt(ciphertext: str) -> str:
    if not ciphertext:
        raise ValueError("Empty ciphertext")
    try:
        return _get_fernet().decrypt(ciphertext.encode("utf-8")).decode("utf-8")
    except InvalidToken as exc:
        raise AnafCryptoError(
            "Token criptat invalid sau cheia Fernet s-a schimbat. "
            "Daca ai regenerat cheia, deconecteaza si reconecteaza compania la ANAF cu USB."
        ) from exc


def self_test() -> bool:
    """Verifica daca cheia curenta poate cripta + decripta un sample."""
    try:
        sample = "test-12345-€"
        return decrypt(encrypt(sample)) == sample
    except Exception:  # noqa: BLE001
        return False
