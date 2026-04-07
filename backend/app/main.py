import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from app.logging_config import setup_logging
from app.middleware import RequestLoggingMiddleware
from app.database import engine

setup_logging()
log = logging.getLogger("berlinstar")

from app.routers import auth, accounts, departments, categories, items, receipts, employees, devices, locations, clienti, companies, disclaimers, registers, marci_anvelope, dimensiuni_anvelope, profiluri_anvelope, anvelope, loc_cazare, cazare_anvelope, admin, programare, general_settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("BerlinStar POS API starting up")
    yield
    log.info("BerlinStar POS API shutting down")
    await engine.dispose()


app = FastAPI(
    title="BerlinStar POS API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(RequestLoggingMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:2000").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
app.include_router(anvelope.router,        prefix="/api/anvelope",            tags=["anvelope"])
app.include_router(loc_cazare.router,      prefix="/api/loc-cazare",          tags=["loc-cazare"])
app.include_router(cazare_anvelope.router, prefix="/api/cazare-anvelope",     tags=["cazare-anvelope"])
app.include_router(admin.router,           prefix="/api/admin",               tags=["admin"])
app.include_router(programare.router,      prefix="/api/programari",           tags=["programari"])
app.include_router(general_settings.router, prefix="/api/general-settings",    tags=["general-settings"])


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
