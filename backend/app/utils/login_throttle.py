"""Protectie la brute-force pe login, numarata pe CREDENTIAL, nu pe IP.

De ce nu e de ajuns limita pe IP din `app/rate_limit.py`: intr-un service auto
toata echipa e in spatele aceluiasi NAT. Cu 5 incercari/minut pe IP, la schimbul
de tura oamenii se blocheaza reciproc desi fiecare tasteaza corect. Invers, un
atacator care incearca parole pe un singur cont are la dispozitie o limita
generoasa daca vine de pe IP-uri diferite.

Asa ca separam rolurile:
  - limita pe IP rămâne, dar larga — opreste doar flood-ul brut;
  - aici numaram esecurile pe (cont, utilizator) si blocam scurt combinatia
    respectiva. Un coleg care greseste parola nu ii afecteaza pe ceilalti.

Stocare in memoria procesului, ca si `rate_limit.py`. La mai multi workeri
numaratoarea devine per-worker (limita efectiva se inmulteste cu numarul lor);
daca ajungem acolo, mutam si asta pe Redis, odata cu limiter-ul.
"""
from __future__ import annotations
import threading
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException

# Cate esecuri consecutive tolerăm inainte de blocare temporara.
MAX_FAILURES = 8
# Fereastra in care se numara esecurile (mai vechi de atat se uita).
WINDOW = timedelta(minutes=15)
# Cat tine blocarea dupa ce s-a atins pragul.
LOCKOUT = timedelta(minutes=5)
# Plafon de intrari retinute, ca un atac distribuit sa nu umple memoria.
MAX_TRACKED = 10_000


@dataclass
class _Entry:
    failures: list[datetime] = field(default_factory=list)
    locked_until: datetime | None = None


_entries: dict[tuple[str, str], _Entry] = {}
_lock = threading.Lock()


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _key(code: str | None, username: str) -> tuple[str, str]:
    return ((code or "").strip().lower(), (username or "").strip().lower())


def _prune(now: datetime) -> None:
    """Sterge intrarile fara esecuri recente. Apelat sub lock."""
    dead = [
        k for k, e in _entries.items()
        if not e.failures and (e.locked_until is None or e.locked_until <= now)
    ]
    for k in dead:
        del _entries[k]
    if len(_entries) > MAX_TRACKED:
        # Fallback dur: pastram cele mai recent atinse. Se intampla doar sub
        # atac distribuit, unde precizia conteaza mai putin decat memoria.
        newest = sorted(
            _entries.items(),
            key=lambda kv: max(kv[1].failures, default=kv[1].locked_until or now),
            reverse=True,
        )[:MAX_TRACKED]
        _entries.clear()
        _entries.update(newest)


def assert_not_locked(code: str | None, username: str) -> None:
    """Refuza incercarea daca aceasta combinatie e in cooldown."""
    now = _now()
    with _lock:
        entry = _entries.get(_key(code, username))
        if entry is None or entry.locked_until is None:
            return
        if entry.locked_until <= now:
            entry.locked_until = None
            entry.failures.clear()
            return
        remaining = int((entry.locked_until - now).total_seconds()) + 1
    raise HTTPException(
        429,
        f"Prea multe incercari esuate pentru acest utilizator. "
        f"Reincearca in {remaining} secunde.",
    )


def record_failure(code: str | None, username: str) -> None:
    now = _now()
    with _lock:
        entry = _entries.setdefault(_key(code, username), _Entry())
        entry.failures = [t for t in entry.failures if now - t < WINDOW]
        entry.failures.append(now)
        if len(entry.failures) >= MAX_FAILURES:
            entry.locked_until = now + LOCKOUT
            entry.failures.clear()
        _prune(now)


def record_success(code: str | None, username: str) -> None:
    with _lock:
        _entries.pop(_key(code, username), None)


def reset_all() -> None:
    """Doar pentru teste."""
    with _lock:
        _entries.clear()
