from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import auth, accounts, themes, categories, items, receipts, employees


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
    allow_origins=["http://localhost:2000"],
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


@app.get("/health")
async def health():
    return {"status": "ok"}
