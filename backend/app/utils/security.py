from __future__ import annotations
import base64
import bcrypt


BCRYPT_ROUNDS = 12


def hash_password(plain: str) -> str:
    """Return a bcrypt hash (utf-8 string) for the given plaintext password."""
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt(rounds=BCRYPT_ROUNDS)).decode("utf-8")


def _looks_like_bcrypt(stored: str) -> bool:
    return stored.startswith(("$2a$", "$2b$", "$2y$"))


def verify_password(plain: str, stored: str) -> bool:
    """Verifica o parola plaintext fata de hash-ul stocat.

    Suporta tranzitia de la base64 (legacy) la bcrypt: daca `stored` arata ca
    bcrypt, foloseste bcrypt; altfel face fallback la comparatia base64 vechi.
    Apelantul ar trebui sa re-hash-uiasca dupa un login legacy reusit.
    """
    if not stored:
        return False
    if _looks_like_bcrypt(stored):
        try:
            return bcrypt.checkpw(plain.encode("utf-8"), stored.encode("utf-8"))
        except ValueError:
            return False
    expected = base64.b64encode(plain.encode("utf-8")).decode("utf-8")
    return stored == expected


def is_legacy_hash(stored: str) -> bool:
    """True daca parola este in formatul vechi (base64) si trebuie re-hash-uita."""
    return bool(stored) and not _looks_like_bcrypt(stored)
