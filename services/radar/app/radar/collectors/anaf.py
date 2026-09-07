"""Collector ANAF: date generale firma (v9 TVA) si bilant anual."""
from __future__ import annotations

from datetime import date

import httpx

from app.radar.types import BilantInfo, CollectorError, CompanyInfo

ANAF_TVA_URL = "https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva"
ANAF_BILANT_URL = "https://webservicesp.anaf.ro/bilant"
_TIMEOUT = 20.0


async def fetch_company(cui: int, client: httpx.AsyncClient | None = None) -> CompanyInfo:
    """Date generale ANAF pentru un CUI; ridica CollectorError daca CUI-ul nu exista."""
    today = date.today().strftime("%Y-%m-%d")
    payload = [{"cui": cui, "data": today}]
    own_client = client is None
    client = client or httpx.AsyncClient(timeout=_TIMEOUT, follow_redirects=True)
    try:
        try:
            resp = await client.post(ANAF_TVA_URL, json=payload)
        except httpx.HTTPError as exc:
            raise CollectorError("Nu am putut contacta ANAF pentru datele firmei.") from exc
        if resp.status_code >= 400:
            raise CollectorError("ANAF a raspuns cu eroare la interogarea firmei.")
        try:
            data = resp.json()
        except ValueError as exc:
            raise CollectorError("Raspunsul ANAF este invalid.") from exc
    finally:
        if own_client:
            await client.aclose()

    found = data.get("found") or []
    if not found:
        raise CollectorError(f"CUI {cui} nu a fost gasit la ANAF.")

    entry = found[0]
    dg = entry.get("date_generale") or {}
    tva = entry.get("inregistrare_scop_Tva") or {}
    return CompanyInfo(
        cui=dg.get("cui", cui),
        name=dg.get("denumire", "") or "",
        address=dg.get("adresa", "") or "",
        vat_payer=tva.get("scpTVA"),
        status=dg.get("stare_inregistrare", "") or "",
        registration_date=dg.get("data_inregistrare", "") or "",
        caen=str(dg.get("cod_CAEN", "") or ""),
        raw=entry,
    )


_TURNOVER_KEYS = ("cifra de afaceri",)
_PROFIT_KEYS = ("profit net",)
_LOSS_KEYS = ("pierdere neta",)
_EMPLOYEES_KEYS = ("numar mediu de salariati",)
_ASSETS_KEYS = ("active imobilizate", "active circulante")
_DEBTS_KEYS = ("datorii",)


def _matches(label: str, keys: tuple[str, ...]) -> bool:
    label = label.lower()
    return any(k in label for k in keys)


async def fetch_bilant(
    cui: int, year: int, client: httpx.AsyncClient | None = None
) -> BilantInfo | None:
    """Indicatorii de bilant ANAF pentru un an; None daca nu exista date (404/lista goala)."""
    own_client = client is None
    client = client or httpx.AsyncClient(timeout=_TIMEOUT, follow_redirects=True)
    try:
        try:
            resp = await client.get(ANAF_BILANT_URL, params={"an": year, "cui": cui})
        except httpx.HTTPError as exc:
            raise CollectorError("Nu am putut contacta ANAF pentru bilant.") from exc
        if resp.status_code == 404:
            return None
        if resp.status_code >= 400:
            raise CollectorError("ANAF a raspuns cu eroare la interogarea bilantului.")
        try:
            data = resp.json()
        except ValueError:
            return None
    finally:
        if own_client:
            await client.aclose()

    indicators = data.get("i") or []
    if not indicators:
        return None

    turnover = profit = total_assets_1 = total_assets_2 = total_debts = None
    employees = None
    for ind in indicators:
        label = str(ind.get("val_den_indicator", "") or "")
        val = ind.get("val_indicator")
        if _matches(label, _TURNOVER_KEYS):
            turnover = val
        elif _matches(label, _PROFIT_KEYS):
            profit = val
        elif _matches(label, _LOSS_KEYS):
            if val:
                profit = -val
        elif _matches(label, _EMPLOYEES_KEYS):
            employees = int(val) if val is not None else None
        elif "active imobilizate" in label.lower():
            total_assets_1 = val
        elif "active circulante" in label.lower():
            total_assets_2 = val
        elif _matches(label, _DEBTS_KEYS):
            total_debts = val

    total_assets = None
    if total_assets_1 is not None or total_assets_2 is not None:
        total_assets = (total_assets_1 or 0) + (total_assets_2 or 0)

    return BilantInfo(
        year=year,
        turnover=turnover,
        profit=profit,
        employees=employees,
        total_assets=total_assets,
        total_debts=total_debts,
        caen=str(data.get("caen", "") or ""),
        raw=indicators,
    )
