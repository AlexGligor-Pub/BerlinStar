"""EUR -> RON conversion via BNR daily XML feed.

Sursa oficiala: https://www.bnr.ro/nbrfxrates.xml (cursurile zilei).
Cache in-memory pe data + valoare. Daca BNR e indisponibil, ridica
exception (caller-ul decide cum reactioneaza — de obicei, refuza checkout-ul
ca sa nu emita factura cu curs aproximat).
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import date, datetime, timezone
from decimal import Decimal
from xml.etree import ElementTree as ET

import httpx

log = logging.getLogger("berlinstar.subscriptions.fx")

_BNR_URL = "https://www.bnr.ro/nbrfxrates.xml"
_NS = "{http://www.bnr.ro/xsd}"


class FxError(RuntimeError):
    pass


@dataclass(frozen=True)
class FxRate:
    base: str
    target: str
    rate: Decimal
    date: date


_cache: FxRate | None = None


async def get_eur_to_ron() -> FxRate:
    """Returneaza cursul EUR->RON pentru azi.

    Cache pe (UTC date) — daca cursul cache-uit e din ziua curenta, e returnat
    direct. Daca nu, sau cache-ul e gol, fetch din BNR.
    """
    global _cache
    today = datetime.now(timezone.utc).date()
    if _cache is not None and _cache.date == today and _cache.target == "RON" and _cache.base == "EUR":
        return _cache

    try:
        async with httpx.AsyncClient(timeout=15.0) as http:
            resp = await http.get(_BNR_URL)
    except httpx.HTTPError as exc:
        raise FxError(f"Nu am putut contacta BNR: {exc}") from exc

    if resp.status_code != 200:
        raise FxError(f"BNR HTTP {resp.status_code}")

    try:
        root = ET.fromstring(resp.content)
    except ET.ParseError as exc:
        raise FxError(f"BNR XML invalid: {exc}") from exc

    rates_node = root.find(f".//{_NS}Cube")
    if rates_node is None:
        raise FxError("BNR XML: nu am gasit nodul <Cube>.")

    bnr_date_str = rates_node.get("date") or today.isoformat()
    try:
        bnr_date = date.fromisoformat(bnr_date_str)
    except ValueError:
        bnr_date = today

    eur_value: Decimal | None = None
    for r in rates_node.findall(f"{_NS}Rate"):
        if r.get("currency") == "EUR":
            multiplier = Decimal(r.get("multiplier") or "1")
            try:
                eur_value = Decimal(r.text or "0") / multiplier
            except Exception:  # noqa: BLE001
                eur_value = None
            break

    if eur_value is None or eur_value <= 0:
        raise FxError("BNR XML: rata EUR lipseste sau invalida.")

    rate = FxRate(base="EUR", target="RON", rate=eur_value, date=bnr_date)
    _cache = rate
    log.info("BNR fx EUR->RON %s (data %s)", eur_value, bnr_date.isoformat())
    return rate


def get_cached() -> FxRate | None:
    return _cache


def invalidate_cache() -> None:
    global _cache
    _cache = None
