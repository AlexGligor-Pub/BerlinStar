"""Serviciul Radar AI (FastAPI). API-ul public e sub /v1, apelat doar de monolit."""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Request
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app import monolith
from app.auth import require_service_token
from app.database import AsyncSessionLocal
from app.jobs import queue
from app.logging_config import setup_logging
from app.radar.types import CollectorError
from app.routers import discovery, internal, runs, settings, sources, usage

setup_logging()
log = logging.getLogger("radar.main")

READY_MAX_HEARTBEAT_AGE = 90.0


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("serviciul radar a pornit")
    yield
    await monolith.close()


app = FastAPI(title="BerlinStar Radar", version="1.0.0", lifespan=lifespan)

for module in (settings, sources, runs, discovery, usage):
    app.include_router(module.router, prefix="/v1", dependencies=[Depends(require_service_token)])
app.include_router(internal.router, prefix="/v1")


@app.exception_handler(monolith.MonolithUnavailable)
async def _monolith_unavailable(request: Request, exc: monolith.MonolithUnavailable):
    return JSONResponse(status_code=503, content={"detail": str(exc) or monolith.UNAVAILABLE_MESSAGE})


@app.exception_handler(CollectorError)
async def _collector_error(request: Request, exc: CollectorError):
    return JSONResponse(status_code=400, content={"detail": str(exc)})


@app.get("/health")
async def health():
    """Liveness: fara DB, fara dependinte externe."""
    return {"status": "ok"}


@app.get("/ready")
async def ready():
    checks: dict[str, object] = {}
    try:
        async with AsyncSessionLocal() as db:
            await db.execute(text("SELECT 1"))
            checks["db"] = True
            age = await queue.worker_heartbeat_age(db)
    except Exception as exc:  # noqa: BLE001
        log.warning("ready: baza de date nu raspunde: %s", exc.__class__.__name__)
        return JSONResponse(status_code=503, content={"status": "unavailable", "db": False})
    checks["worker_heartbeat_age"] = None if age is None else round(age, 1)
    checks["worker"] = age is not None and age < READY_MAX_HEARTBEAT_AGE
    status = 200 if checks["worker"] else 503
    return JSONResponse(status_code=status, content={"status": "ok" if status == 200 else "degraded", **checks})
