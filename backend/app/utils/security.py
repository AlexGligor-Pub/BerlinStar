from __future__ import annotations
import asyncio
import base64
import bcrypt


BCRYPT_ROUNDS = 12

# bcrypt foloseste doar primii 72 de octeti ai parolei.
BCRYPT_MAX_BYTES = 72


def _bcrypt_bytes(plain: str) -> bytes:
    """Parola ca octeti, taiata la limita bcrypt.

    bcrypt < 5 taia in tacere la 72 de octeti; bcrypt 5 arunca ValueError. Taiem
    noi, la fel ca versiunile vechi (pe octeti, nu pe caractere): hash-urile
    facute atunci din parole mai lungi se verifica in continuare, iar o parola
    lunga noua nu mai produce 500. Consecinta, aceeasi ca inainte: tot ce trece
    de octetul 72 nu conteaza la verificare.
    """
    return plain.encode("utf-8")[:BCRYPT_MAX_BYTES]


def hash_password_sync(plain: str) -> str:
    """Return a bcrypt hash (utf-8 string) for the given plaintext password."""
    return bcrypt.hashpw(_bcrypt_bytes(plain), bcrypt.gensalt(rounds=BCRYPT_ROUNDS)).decode("utf-8")


async def hash_password(plain: str) -> str:
    """bcrypt costa ~250ms CPU; rulat in thread ca sa nu blocheze event loop-ul."""
    return await asyncio.to_thread(hash_password_sync, plain)


def _looks_like_bcrypt(stored: str) -> bool:
    return stored.startswith(("$2a$", "$2b$", "$2y$"))


def verify_password_sync(plain: str, stored: str) -> bool:
    """Verifica o parola plaintext fata de hash-ul stocat.

    Suporta tranzitia de la base64 (legacy) la bcrypt: daca `stored` arata ca
    bcrypt, foloseste bcrypt; altfel face fallback la comparatia base64 vechi.
    Apelantul ar trebui sa re-hash-uiasca dupa un login legacy reusit.
    """
    if not stored:
        return False
    if _looks_like_bcrypt(stored):
        try:
            return bcrypt.checkpw(_bcrypt_bytes(plain), stored.encode("utf-8"))
        except ValueError:
            return False
    expected = base64.b64encode(plain.encode("utf-8")).decode("utf-8")
    return stored == expected


async def verify_password(plain: str, stored: str) -> bool:
    return await asyncio.to_thread(verify_password_sync, plain, stored)


def is_legacy_hash(stored: str) -> bool:
    """True daca parola este in formatul vechi (base64) si trebuie re-hash-uita."""
    return bool(stored) and not _looks_like_bcrypt(stored)
