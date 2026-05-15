from __future__ import annotations
import logging
from datetime import date
from typing import TypedDict

import httpx

log = logging.getLogger("berlinstar")

ANAF_URL = "https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva"
ANAF_DEFAULT_TIMEOUT = 15.0


class AnafCompanyData(TypedDict, total=False):
    cui: int | None
    name: str
    address: str | None
    nr_reg_com: str | None
    phone: str | None
    postal_code: str | None
    is_vat_payer: bool | None
    registration_status: str | None


async def fetch_anaf_raw(cui: int, timeout: float = ANAF_DEFAULT_TIMEOUT) -> list[dict]:
    """Apel direct catre ANAF. Ridica httpx exceptions; pentru fallback silentios foloseste lookup_anaf."""
    today = date.today().strftime("%Y-%m-%d")
    payload = [{"cui": cui, "data": today}]
    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.post(ANAF_URL, json=payload)
        resp.raise_for_status()
        data = resp.json()
    return data.get("found", []) or []


def parse_anaf_entry(entry: dict) -> AnafCompanyData:
    dg = entry.get("date_generale", {}) or {}
    tva = entry.get("inregistrare_scop_Tva", {}) or {}
    return {
        "cui": dg.get("cui"),
        "name": dg.get("denumire", "") or "",
        "address": dg.get("adresa"),
        "nr_reg_com": dg.get("nrRegCom"),
        "phone": dg.get("telefon") or None,
        "postal_code": dg.get("codPostal") or None,
        "is_vat_payer": tva.get("scpTVA"),
        "registration_status": dg.get("stare_inregistrare"),
    }


async def lookup_anaf(cui: int, timeout: float = 8.0) -> AnafCompanyData | None:
    """Lookup ANAF cu fallback silentios.

    Returneaza datele companiei sau None daca CUI inexistent / timeout /
    eroare retea. Nu ridica exceptii — destinat folosirii in background
    tasks unde nu vrem sa stricam restul flow-ului daca ANAF e indisponibil.
    """
    try:
        found = await fetch_anaf_raw(cui, timeout=timeout)
    except httpx.TimeoutException:
        log.warning("ANAF lookup timeout for cui=%s", cui)
        return None
    except Exception:
        log.exception("ANAF lookup failed for cui=%s", cui)
        return None
    if not found:
        log.info("ANAF: CUI %s not found", cui)
        return None
    return parse_anaf_entry(found[0])
