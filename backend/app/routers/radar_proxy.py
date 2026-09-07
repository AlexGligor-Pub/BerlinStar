"""Routere subtiri: /api/radar/* devine pass-through catre serviciul Radar AI.

`discovery_router` (/api/radar/discovery) se monteaza INAINTE de `router`
(/api/radar), altfel catch-all-ul il inghite.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Request, Response

from app.dependencies import get_settings_account_id
from app.radar_client import proxy

_METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH"]

# Prompt scurt, dar sincron in serviciu (ADR §6).
_SLOW_PATH = "settings/suggest-context"
_SLOW_READ_TIMEOUT = 200.0

router = APIRouter()
discovery_router = APIRouter()


@router.api_route("", methods=_METHODS)
async def radar_root(
    request: Request,
    account_id: int = Depends(get_settings_account_id),
) -> Response:
    return await proxy(request, account_id, "/v1")


@router.api_route("/{path:path}", methods=_METHODS)
async def radar_any(
    request: Request,
    path: str,
    account_id: int = Depends(get_settings_account_id),
) -> Response:
    """Orice cale /api/radar/X ajunge la /v1/X in serviciu."""
    read_timeout = _SLOW_READ_TIMEOUT if path == _SLOW_PATH else None
    return await proxy(request, account_id, f"/v1/{path}", read_timeout=read_timeout)


@discovery_router.api_route("", methods=_METHODS)
async def discovery_root(
    request: Request,
    account_id: int = Depends(get_settings_account_id),
) -> Response:
    return await proxy(request, account_id, "/v1/discovery")


@discovery_router.api_route("/{path:path}", methods=_METHODS)
async def discovery_any(
    request: Request,
    path: str,
    account_id: int = Depends(get_settings_account_id),
) -> Response:
    """Orice cale /api/radar/discovery/X ajunge la /v1/discovery/X in serviciu."""
    return await proxy(request, account_id, f"/v1/discovery/{path}")
