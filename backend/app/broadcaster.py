from __future__ import annotations
import asyncio
from collections import defaultdict


class Broadcaster:
    def __init__(self) -> None:
        self._listeners: dict[int, list[asyncio.Queue[dict]]] = defaultdict(list)
        self._pos_count: dict[int, int] = defaultdict(int)

    def subscribe(self, account_id: int) -> asyncio.Queue[dict]:
        q: asyncio.Queue[dict] = asyncio.Queue()
        self._listeners[account_id].append(q)
        return q

    def unsubscribe(self, account_id: int, q: asyncio.Queue[dict]) -> None:
        listeners = self._listeners.get(account_id, [])
        if q in listeners:
            listeners.remove(q)

    def pos_connect(self, account_id: int) -> None:
        self._pos_count[account_id] += 1

    def pos_disconnect(self, account_id: int) -> None:
        if self._pos_count[account_id] > 0:
            self._pos_count[account_id] -= 1

    def get_pos_count(self, account_id: int) -> int:
        return self._pos_count.get(account_id, 0)

    async def notify(self, account_id: int) -> None:
        for q in list(self._listeners.get(account_id, [])):
            await q.put({"type": "receipts_changed"})

    async def notify_pos_count(self, account_id: int) -> None:
        count = self.get_pos_count(account_id)
        for q in list(self._listeners.get(account_id, [])):
            await q.put({"type": "pos_count", "count": count})


broadcaster = Broadcaster()
