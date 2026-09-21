"""Routere subtiri: /api/radar/* devine pass-through catre serviciul Radar AI.

`discovery_router` (/api/radar/discovery) se monteaza INAINTE de `router`
(/api/radar), altfel catch-all-ul il inghite.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_settings_account_id
from app.models.global_settings import GlobalSettings
from app.radar_client import proxy

_METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH"]

# Prompt scurt, dar sincron in serviciu (ADR §6).
_SLOW_PATH = "settings/suggest-context"
_SLOW_READ_TIMEOUT = 200.0

async def require_radar_enabled(
    _account_id: int = Depends(get_settings_account_id),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Radar oprit din AdminV2 => ruta nu exista.

    Ascunderea din meniu nu ajunge: pagina ar ramane accesibila scriind adresa.
    404, nu 403: cand o functionalitate e stinsa, nu exista — nu e o chestiune
    de drepturi.

    Depinde de autentificare, ca aceasta sa ruleze prima: altfel un apel
    neautentificat ar afla din 404-vs-401 daca Radar e pornit. FastAPI
    memoreaza dependinta pe request, deci contul nu se rezolva de doua ori.
    """
    enabled = await db.scalar(select(GlobalSettings.radar_enabled).limit(1))
    # Fara rand in tabela, platforma e proaspat instalata: implicit pornit.
    if enabled is False:
        raise HTTPException(404, "Radar AI este dezactivat.")


# Garda sta pe routere, nu pe rute: o ruta adaugata mai tarziu nu o poate uita.
router = APIRouter(dependencies=[Depends(require_radar_enabled)])
discovery_router = APIRouter(dependencies=[Depends(require_radar_enabled)])


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
