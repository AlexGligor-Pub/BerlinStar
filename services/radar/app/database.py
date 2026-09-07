"""Engine-ul si sesiunile serviciului. Toate tabelele sunt in schema `radar`."""
from __future__ import annotations

import os

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import DATABASE_URL as _CONFIGURED_URL

# Why: flagul explicit bate DSN-ul din .env, ca testele sa nu ia dialectul
# Postgres (coada foloseste SQL specific dialectului: SKIP LOCKED, ON CONFLICT).
if os.getenv("BERLINSTAR_DEV_SQLITE") == "1":
    DATABASE_URL = "sqlite+aiosqlite:///./radar.db"
elif _CONFIGURED_URL:
    DATABASE_URL = _CONFIGURED_URL
else:
    raise RuntimeError(
        "RADAR_DATABASE_URL este obligatoriu. Seteaza postgresql+asyncpg://... "
        "sau BERLINSTAR_DEV_SQLITE=1 pentru fallback la SQLite in dev."
    )

IS_POSTGRES = DATABASE_URL.startswith("postgresql")

if IS_POSTGRES:
    engine = create_async_engine(
        DATABASE_URL,
        echo=False,
        pool_size=5,
        max_overflow=5,
        pool_pre_ping=True,
        pool_recycle=3600,
        pool_timeout=30,
        connect_args={"server_settings": {"search_path": "radar,public"}},
    )
else:
    # Why: SQLite nu are schema; fara translate map ar compila „radar.radar_runs".
    engine = create_async_engine(DATABASE_URL, echo=False).execution_options(
        schema_translate_map={"radar": None}
    )

AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
