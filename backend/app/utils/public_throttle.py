"""Limite simple pe fereastra glisanta pentru rutele publice (programari online).

Nu folosim slowapi aici: IP-ul relevant nu e cel al conexiunii (site-ul public
e un proxy), ci cel trimis de proxy in `X-Client-IP`, pe care il stim abia dupa
ce am validat cheia API. Cheile de limitare le construieste routerul.

Stocare in memoria procesului, ca `login_throttle.py` — la mai multi workeri
limita devine per-worker.
"""
from __future__ import annotations
import threading
import time
from collections import deque

from fastapi import HTTPException

MAX_TRACKED = 20_000

_hits: dict[str, deque[float]] = {}
_lock = threading.Lock()


def hit(bucket: str, limit: int, window_seconds: int) -> None:
    """Inregistreaza o cerere; 429 daca bucket-ul si-a depasit limita."""
    now = time.monotonic()
    with _lock:
        q = _hits.get(bucket)
        if q is None:
            if len(_hits) >= MAX_TRACKED:
                _hits.clear()
            q = _hits[bucket] = deque()
        while q and q[0] <= now - window_seconds:
            q.popleft()
        if len(q) >= limit:
            raise HTTPException(429, "Prea multe cereri. Încercați din nou mai târziu.")
        q.append(now)


def reset_all() -> None:
    with _lock:
        _hits.clear()
