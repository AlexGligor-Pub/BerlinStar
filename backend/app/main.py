import os
import logging
from contextlib import asynccontextmanager
import httpx
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from sqlalchemy.exc import IntegrityError, OperationalError
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from dotenv import load_dotenv

load_dotenv()

from app.logging_config import setup_logging
from app.middleware import RequestLoggingMiddleware
from app.database import engine
from app.rate_limit import limiter

setup_logging()
log = logging.getLogger("berlinstar")

from app.routers import auth, accounts, departments, categories, items, receipts, employees, devices, locations, clienti, companies, disclaimers, registers, marci_anvelope, dimensiuni_anvelope, profiluri_anvelope, coduri_dot_anvelope, anvelope, loc_cazare, cazare_anvelope, montaj_roti, admin, programare, general_settings, global_settings, email_settings, admin_reports, reports, stocuri, admin_legacy_import, subscription, subscription_webhook, admin_subscription, factura_rapida
from app.services.reports import start_scheduler, stop_scheduler
from app.efactura import router_admin as efactura_admin
from app.efactura import router as efactura_user
from app.efactura.scheduler import (
    start_scheduler as start_efactura_scheduler,
    stop_scheduler as stop_efactura_scheduler,
)


# Shared httpx client reused across requests — saves one TCP handshake per call
http_client: httpx.AsyncClient | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global http_client
    http_client = httpx.AsyncClient(timeout=15.0)

    # Bootstrap config eFactura din DB:
    # - asigura rand singleton in efactura_global_settings
    # - completeaza URL-urile NULL cu defaults oficiale ANAF
    # - auto-genereaza Fernet key daca lipseste (o singura data, persistat)
    # - incarca toate valorile in cache-ul module-level pentru acces sincron
    try:
        from app.database import AsyncSessionLocal
        from app.efactura import runtime_config
        from app.efactura.crypto import set_fernet_key
        async with AsyncSessionLocal() as db:
            await runtime_config.ensure_initialized(db)
            cfg = await runtime_config.load(db, force=True)
        set_fernet_key(cfg.fernet_key)
        log.info(
            "eFactura: config initializat (Fernet=%s, scheduler=%s, prod_url=%s)",
            "set" if cfg.fernet_key else "MISSING",
            "ON" if cfg.scheduler_enabled else "off",
            cfg.anaf_api_base_prod,
        )
    except Exception as exc:  # noqa: BLE001
        log.warning("eFactura bootstrap esuat: %s — folosesc fallback env vars.", exc)

    await start_scheduler()
    await start_efactura_scheduler()
    log.info("BerlinStar POS API starting up")
    yield
    log.info("BerlinStar POS API shutting down")
    await stop_efactura_scheduler()
    await stop_scheduler()
    await http_client.aclose()
    await engine.dispose()


app = FastAPI(
    title="BerlinStar POS API",
    version="1.0.0",
    lifespan=lifespan,
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


def _parse_csv_env(name: str, default: str) -> list[str]:
    raw = os.getenv(name, default)
    items = [v.strip() for v in raw.split(",") if v.strip()]
    return items


_cors_origins = _parse_csv_env("CORS_ORIGINS", "http://localhost:2000")
if "*" in _cors_origins:
    raise RuntimeError("CORS_ORIGINS='*' is not allowed with allow_credentials=True. Set explicit origins.")

_allowed_hosts = _parse_csv_env("ALLOWED_HOSTS", "*")

app.add_middleware(RequestLoggingMiddleware)
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=_allowed_hosts,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Requested-With"],
)


@app.exception_handler(IntegrityError)
async def _integrity_handler(_req: Request, exc: IntegrityError):
    log.warning("IntegrityError: %s", exc.orig if hasattr(exc, "orig") else exc)
    return JSONResponse(status_code=409, content={"detail": "Conflict de date."})


@app.exception_handler(OperationalError)
async def _operational_handler(_req: Request, exc: OperationalError):
    log.error("OperationalError: %s", exc, exc_info=True)
    return JSONResponse(status_code=503, content={"detail": "Serviciu temporar indisponibil."})


app.include_router(auth.router,       prefix="/api/auth",       tags=["auth"])
app.include_router(accounts.router,   prefix="/api/accounts",   tags=["accounts"])
app.include_router(departments.router, prefix="/api/departments", tags=["departments"])
app.include_router(categories.router, prefix="/api/categories", tags=["categories"])
app.include_router(items.router,      prefix="/api/items",      tags=["items"])
app.include_router(receipts.router,   prefix="/api/receipts",   tags=["receipts"])
app.include_router(employees.router,  prefix="/api/employees",  tags=["employees"])
app.include_router(devices.router,    prefix="/api/devices",    tags=["devices"])
app.include_router(locations.router,  prefix="/api/locations",  tags=["locations"])
app.include_router(clienti.router,    prefix="/api/clienti",    tags=["clienti"])
app.include_router(companies.router,   prefix="/api/companies",   tags=["companies"])
app.include_router(disclaimers.router, prefix="/api/disclaimers", tags=["disclaimers"])
app.include_router(registers.router,       prefix="/api/registers",           tags=["registers"])
app.include_router(marci_anvelope.router,  prefix="/api/marci-anvelope",      tags=["marci-anvelope"])
app.include_router(dimensiuni_anvelope.router, prefix="/api/dimensiuni-anvelope", tags=["dimensiuni-anvelope"])
app.include_router(profiluri_anvelope.router, prefix="/api/profiluri-anvelope",   tags=["profiluri-anvelope"])
app.include_router(coduri_dot_anvelope.router, prefix="/api/coduri-dot-anvelope", tags=["coduri-dot-anvelope"])
app.include_router(anvelope.router,        prefix="/api/anvelope",            tags=["anvelope"])
app.include_router(loc_cazare.router,      prefix="/api/loc-cazare",          tags=["loc-cazare"])
app.include_router(cazare_anvelope.router, prefix="/api/cazare-anvelope",     tags=["cazare-anvelope"])
app.include_router(montaj_roti.router,     prefix="/api/montaj-roti",         tags=["montaj-roti"])
app.include_router(admin.router,           prefix="/api/admin",               tags=["admin"])
app.include_router(admin_legacy_import.router, prefix="/api/admin/legacy-import", tags=["admin-legacy-import"])
app.include_router(programare.router,      prefix="/api/programari",           tags=["programari"])
app.include_router(general_settings.router, prefix="/api/general-settings",    tags=["general-settings"])
app.include_router(global_settings.router,  prefix="/api/global-settings",     tags=["global-settings"])
app.include_router(email_settings.router,  prefix="/api/email-settings",      tags=["email-settings"])
app.include_router(admin_reports.router,    prefix="/api/admin/reports",       tags=["admin-reports"])
app.include_router(reports.router,          prefix="/api/reports",             tags=["reports"])
app.include_router(stocuri.router,          prefix="/api/stocuri",             tags=["stocuri"])
app.include_router(efactura_admin.router,   prefix="/api/admin/efactura",      tags=["admin-efactura"])
app.include_router(efactura_user.router,    prefix="/api/efactura",            tags=["efactura"])
app.include_router(subscription.router,     prefix="/api/subscription",        tags=["subscription"])
app.include_router(subscription_webhook.router, prefix="/api/subscription",    tags=["subscription-webhook"])
app.include_router(admin_subscription.router,   prefix="/api/admin/subscription", tags=["admin-subscription"])
app.include_router(factura_rapida.router,   prefix="/api/factura-rapida",      tags=["factura-rapida"])


@app.get("/api/health")
async def health():
    from sqlalchemy import text
    from app.database import AsyncSessionLocal
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
        db_status = "ok"
    except Exception as exc:
        log.error("Health check: DB unreachable: %s", exc)
        db_status = "error"
    return {"status": "ok" if db_status == "ok" else "degraded", "db": db_status}
