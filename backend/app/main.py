import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from app.routers import auth, accounts, themes, categories, items, receipts, employees, devices, locations


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(
    title="BerlinStar POS API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:2000").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router,       prefix="/api/auth",       tags=["auth"])
app.include_router(accounts.router,   prefix="/api/accounts",   tags=["accounts"])
app.include_router(themes.router,     prefix="/api/themes",     tags=["themes"])
app.include_router(categories.router, prefix="/api/categories", tags=["categories"])
app.include_router(items.router,      prefix="/api/items",      tags=["items"])
app.include_router(receipts.router,   prefix="/api/receipts",   tags=["receipts"])
app.include_router(employees.router,  prefix="/api/employees",  tags=["employees"])
app.include_router(devices.router,    prefix="/api/devices",    tags=["devices"])
app.include_router(locations.router,  prefix="/api/locations",  tags=["locations"])


@app.get("/health")
async def health():
    return {"status": "ok"}
