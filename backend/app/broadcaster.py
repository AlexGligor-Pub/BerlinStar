from __future__ import annotations
import asyncio
import logging
from collections import defaultdict

log = logging.getLogger("berlinstar.broadcaster")

# Bound per-listener queue. La saturare, evenimentul cel mai vechi este aruncat
# (back-pressure) pentru a evita cresterea nemarginita a RAM si pentru a nu
# bloca writerii pe consumatori lenti.
_QUEUE_MAX = 100


class Broadcaster:
    def __init__(self) -> None:
        self._listeners: dict[int, list[asyncio.Queue[dict]]] = defaultdict(list)
        self._pos_count: dict[int, int] = defaultdict(int)

    def subscribe(self, account_id: int) -> asyncio.Queue[dict]:
        q: asyncio.Queue[dict] = asyncio.Queue(maxsize=_QUEUE_MAX)
        self._listeners[account_id].append(q)
        return q

    def unsubscribe(self, account_id: int, q: asyncio.Queue[dict]) -> None:
        listeners = self._listeners.get(account_id, [])
        if q in listeners:
            listeners.remove(q)
        if not listeners:
            self._listeners.pop(account_id, None)

    def pos_connect(self, account_id: int) -> None:
        self._pos_count[account_id] += 1

    def pos_disconnect(self, account_id: int) -> None:
        if self._pos_count[account_id] > 0:
            self._pos_count[account_id] -= 1
        if self._pos_count[account_id] == 0:
            self._pos_count.pop(account_id, None)

    def get_pos_count(self, account_id: int) -> int:
        return self._pos_count.get(account_id, 0)

    def _push(self, q: asyncio.Queue[dict], event: dict) -> None:
        if q.full():
            try:
                q.get_nowait()
            except asyncio.QueueEmpty:
                pass
        try:
            q.put_nowait(event)
        except asyncio.QueueFull:
            log.warning("Broadcaster queue still full after drop-oldest; skipping event")

    def notify(self, account_id: int) -> None:
        event = {"type": "receipts_changed"}
        for q in list(self._listeners.get(account_id, [])):
            self._push(q, event)

    def notify_pos_count(self, account_id: int) -> None:
        event = {"type": "pos_count", "count": self.get_pos_count(account_id)}
        for q in list(self._listeners.get(account_id, [])):
            self._push(q, event)


broadcaster = Broadcaster()
