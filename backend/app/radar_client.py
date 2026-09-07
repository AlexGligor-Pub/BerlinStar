"""Client HTTP comun catre serviciul Radar AI + proxy generic pentru routerele subtiri.

PDF-urile se trimit buffer-ate (rapoartele sunt < 5 MB), nu ca stream.
"""
from __future__ import annotations

import logging

import httpx
from fastapi import HTTPException, Request, Response

from app.config import RADAR_SERVICE_URL, RADAR_SHARED_SECRET

log = logging.getLogger("berlinstar.radar_client")

UNAVAILABLE = "Serviciul Radar AI nu este disponibil momentan. Încearcă din nou în câteva minute."

_DEFAULT_TIMEOUT = httpx.Timeout(connect=5.0, read=30.0, write=10.0, pool=5.0)
_DOWN = (httpx.ConnectError, httpx.ConnectTimeout, httpx.ReadTimeout, httpx.RemoteProtocolError)


def new_client(transport: httpx.AsyncBaseTransport | None = None) -> httpx.AsyncClient:
    """Clientul keep-alive catre serviciu; `transport` doar pentru teste."""
    return httpx.AsyncClient(
        base_url=RADAR_SERVICE_URL,
        timeout=_DEFAULT_TIMEOUT,
        limits=httpx.Limits(max_keepalive_connections=20, max_connections=50),
        headers={"X-Service-Token": RADAR_SHARED_SECRET},
        transport=transport,
    )


client = new_client()


def _timeout_kwargs(read_timeout: float | None) -> dict:
    if read_timeout is None:
        return {}
    return {"timeout": httpx.Timeout(connect=5.0, read=read_timeout, write=10.0, pool=5.0)}


async def proxy(
    request: Request,
    account_id: int,
    path: str,
    *,
    read_timeout: float | None = None,
) -> Response:
    """Trece cererea catre serviciu si intoarce raspunsul lui neschimbat."""
    headers = {"X-Account-Id": str(account_id)}
    for name in ("content-type", "idempotency-key"):
        value = request.headers.get(name)
        if value:
            headers[name] = value

    target = path
    if request.url.query:
        target = f"{path}?{request.url.query}"

    try:
        upstream = await client.request(
            request.method,
            target,
            content=await request.body(),
            headers=headers,
            **_timeout_kwargs(read_timeout),
        )
    except _DOWN as exc:
        log.warning("Radar AI indisponibil (%s %s): %s", request.method, path, exc)
        raise HTTPException(503, UNAVAILABLE) from exc

    out = Response(
        content=upstream.content,
        status_code=upstream.status_code,
        media_type=upstream.headers.get("content-type"),
    )
    disposition = upstream.headers.get("content-disposition")
    if disposition:
        out.headers["Content-Disposition"] = disposition
    return out


async def get_json(
    path: str,
    account_id: int | None = None,
    params: dict | None = None,
    read_timeout: float | None = None,
):
    """GET JSON din serviciu (uz admin/intern); ridica 503 daca serviciul e jos."""
    headers = {} if account_id is None else {"X-Account-Id": str(account_id)}
    try:
        resp = await client.get(path, params=params, headers=headers, **_timeout_kwargs(read_timeout))
    except _DOWN as exc:
        log.warning("Radar AI indisponibil (GET %s): %s", path, exc)
        raise HTTPException(503, UNAVAILABLE) from exc

    if resp.is_error:
        detail = "Serviciul Radar AI a raspuns cu eroare."
        try:
            payload = resp.json()
        except ValueError:
            payload = None
        if isinstance(payload, dict) and payload.get("detail"):
            detail = payload["detail"]
        raise HTTPException(resp.status_code, detail)
    return resp.json()


async def aclose() -> None:
    await client.aclose()
