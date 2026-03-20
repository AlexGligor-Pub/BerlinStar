from __future__ import annotations
import asyncio
from collections import defaultdict


class Broadcaster:
    def __init__(self) -> None:
        self._listeners: dict[int, list[asyncio.Queue[str]]] = defaultdict(list)

    def subscribe(self, account_id: int) -> asyncio.Queue[str]:
        q: asyncio.Queue[str] = asyncio.Queue()
        self._listeners[account_id].append(q)
        return q

    def unsubscribe(self, account_id: int, q: asyncio.Queue[str]) -> None:
        listeners = self._listeners.get(account_id, [])
        if q in listeners:
            listeners.remove(q)

    async def notify(self, account_id: int) -> None:
        for q in list(self._listeners.get(account_id, [])):
            await q.put("receipts_changed")


broadcaster = Broadcaster()
