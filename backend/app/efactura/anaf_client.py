"""HTTP client async pentru API-ul RO e-Factura ANAF.

Endpoint-uri implementate:
- POST /upload/CIUS-RO/{CUI}?standard=UBL  -> upload factura
- GET  /stareMesaj/{index_incarcare}        -> verifica stare
- GET  /descarcare/{download_id}             -> descarca ZIP raspuns
- GET  /listaMesajeFactura                   -> lista mesaje SPV
- GET  /listaMesajePaginatieFactura          -> lista cu paginatie

Auth: Bearer token de la oauth_service.get_valid_access_token().
"""
from __future__ import annotations

import logging
from typing import Any

import httpx

from app.efactura.exceptions import AnafRateLimited, AnafUploadError, EFacturaError
from app.efactura.runtime_config import (
    DEFAULT_ANAF_API_BASE_PROD,
    DEFAULT_ANAF_API_BASE_TEST,
    get_cached,
)

log = logging.getLogger("berlinstar.efactura.client")


class AnafEFacturaClient:
    def __init__(
        self,
        access_token: str,
        cui: str,
        use_test: bool = True,
        *,
        base_url: str | None = None,
    ):
        if base_url:
            self.base_url = base_url
        else:
            cfg = get_cached()
            if cfg is not None:
                self.base_url = cfg.api_base(use_test=use_test)
            else:
                self.base_url = DEFAULT_ANAF_API_BASE_TEST if use_test else DEFAULT_ANAF_API_BASE_PROD
        self.cui = str(cui).replace("RO", "").strip()
        self._auth_header = {"Authorization": f"Bearer {access_token}"}

    # ---------- upload ----------

    async def upload_invoice(
        self,
        xml_content: str,
        standard: str = "UBL",
        extern: bool = False,
    ) -> dict[str, Any]:
        """Trimite XML factură la ANAF. Returneaza dict cu index_incarcare sau eroare."""
        url = f"{self.base_url}/upload/{standard}/{self.cui}"
        params: dict[str, str] = {"standard": standard}
        if extern:
            params["extern"] = "DA"

        headers = {**self._auth_header, "Content-Type": "application/xml"}

        async with httpx.AsyncClient(timeout=60.0) as http:
            resp = await http.post(
                url,
                content=xml_content.encode("utf-8"),
                params=params,
                headers=headers,
            )

        if resp.status_code == 429:
            raise AnafRateLimited("Rate limit ANAF la /upload")
        if resp.status_code >= 500:
            raise EFacturaError(f"ANAF server error HTTP {resp.status_code}: {resp.text[:300]}")

        # ANAF returneaza 200 cu corp JSON sau XML
        body = resp.text
        try:
            data = resp.json()
        except Exception:
            # uneori e XML — extragem index_incarcare cu regex
            import re
            m = re.search(r'index_incarcare[=:"\s]+(\d+)', body)
            if m:
                return {"index_incarcare": int(m.group(1)), "raw": body[:500]}
            raise AnafUploadError(f"Nu am putut parsa raspunsul ANAF: {body[:300]}", raw={"body": body[:500]})

        if "index_incarcare" in data:
            return data
        if "eroare" in data or "Errors" in data:
            log.warning("ANAF upload error: %s", data)
            raise AnafUploadError(
                str(data.get("eroare") or data.get("titlu") or "Eroare ANAF necunoscuta"),
                anaf_titlu=data.get("titlu"),
                raw=data,
            )
        return data

    # ---------- stareMesaj ----------

    async def check_status(self, index_incarcare: int) -> dict[str, Any]:
        url = f"{self.base_url}/stareMesaj"
        params = {"id_incarcare": str(index_incarcare)}
        async with httpx.AsyncClient(timeout=20.0) as http:
            resp = await http.get(url, params=params, headers=self._auth_header)
        if resp.status_code == 429:
            raise AnafRateLimited("Rate limit ANAF la /stareMesaj")
        if resp.status_code != 200:
            raise EFacturaError(f"ANAF /stareMesaj HTTP {resp.status_code}: {resp.text[:300]}")
        try:
            return resp.json()
        except Exception:
            return {"raw": resp.text[:500]}

    # ---------- descarcare ----------

    async def download_response(self, download_id: int) -> bytes:
        url = f"{self.base_url}/descarcare"
        params = {"id": str(download_id)}
        async with httpx.AsyncClient(timeout=60.0) as http:
            resp = await http.get(url, params=params, headers=self._auth_header)
        if resp.status_code == 429:
            raise AnafRateLimited("Rate limit ANAF la /descarcare")
        if resp.status_code != 200:
            raise EFacturaError(f"ANAF /descarcare HTTP {resp.status_code}: {resp.text[:300]}")
        return resp.content

    # ---------- listaMesajeFactura ----------

    async def list_messages(self, days: int = 60, filtru: str = "T") -> dict[str, Any]:
        if days < 1 or days > 60:
            raise ValueError("days trebuie sa fie intre 1 si 60")
        if filtru not in ("E", "P", "T", "RASP"):
            raise ValueError("filtru invalid")

        url = f"{self.base_url}/listaMesajeFactura"
        params = {"cif": self.cui, "zile": str(days), "filtru": filtru}
        async with httpx.AsyncClient(timeout=30.0) as http:
            resp = await http.get(url, params=params, headers=self._auth_header)
        if resp.status_code == 429:
            raise AnafRateLimited("Rate limit ANAF la /listaMesajeFactura")
        if resp.status_code != 200:
            raise EFacturaError(f"ANAF /listaMesajeFactura HTTP {resp.status_code}: {resp.text[:300]}")
        return resp.json()

    async def list_messages_paginated(
        self,
        start_ts: int,
        end_ts: int,
        page: int = 1,
        filtru: str = "T",
    ) -> dict[str, Any]:
        url = f"{self.base_url}/listaMesajePaginatieFactura"
        params = {
            "cif": self.cui,
            "startTime": str(start_ts),
            "endTime": str(end_ts),
            "pagina": str(page),
            "filtru": filtru,
        }
        async with httpx.AsyncClient(timeout=30.0) as http:
            resp = await http.get(url, params=params, headers=self._auth_header)
        if resp.status_code == 429:
            raise AnafRateLimited("Rate limit ANAF la /listaMesajePaginatieFactura")
        if resp.status_code != 200:
            raise EFacturaError(f"ANAF /listaMesajePaginatieFactura HTTP {resp.status_code}: {resp.text[:300]}")
        return resp.json()
