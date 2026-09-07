"""Suport comun pentru testele serviciului Radar.

Rulam pe SQLite in memorie, cu `schema_translate_map` ca schema `radar` sa
devina schema implicita. Fara pytest: fiecare fisier de test e rulabil
standalone (`venv/bin/python -m tests.test_x`), la fel ca in monolit.
"""
from __future__ import annotations
import asyncio
import os

os.environ.setdefault("BERLINSTAR_DEV_SQLITE", "1")
os.environ.setdefault("MONOLITH_URL", "http://localhost:4000")

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.models import Base  # noqa: F401  — aduce toate tabelele in metadata

_TRANSLATE = {"radar": None}

# Sesiunile deschise de testul curent, ca `run()` sa le poata inchide.
_OPEN: list[tuple[AsyncSession, object]] = []


async def make_session() -> AsyncSession:
    """Baza goala, cu toate tabelele serviciului. Fiecare test isi ia una proprie."""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:").execution_options(
        schema_translate_map=_TRANSLATE
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    session = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)()
    _OPEN.append((session, engine))
    return session


async def _close_all() -> None:
    while _OPEN:
        session, engine = _OPEN.pop()
        await session.close()
        await engine.dispose()


class SessionFactory:
    """Inlocuieste `AsyncSessionLocal` din module cu sesiunea de test."""

    def __init__(self, db: AsyncSession):
        self.db = db

    def __call__(self):
        return self

    async def __aenter__(self):
        return self.db

    async def __aexit__(self, *exc):
        return False


def business_context(
    account_id: int = 6,
    account_name: str = "Service Test",
    companies: list[dict] | None = None,
    items: list[dict] | None = None,
) -> dict:
    """Forma pe care serviciul o primeste de la `/api/internal/business-context`."""
    return {
        "account_id": account_id,
        "account_name": account_name,
        "companies": companies
        if companies is not None
        else [
            {
                "id": 1,
                "cui": 12345678,
                "name": "Service Test SRL",
                "address": "Str. Exemplu 1, Timisoara, judetul Timis",
                "website": "https://service-test.ro",
                "description": "Service auto multimarca",
            }
        ],
        "items": items
        if items is not None
        else [
            {"name": "Schimb ulei", "price": 150.0, "unit": "buc", "type": "serviciu"},
            {"name": "Vulcanizare", "price": 80.0, "unit": "buc", "type": "serviciu"},
        ],
    }


def run(coro):
    """Ruleaza un test async si inchide curat tot ce a deschis."""
    async def _wrapped():
        try:
            return await coro
        finally:
            await _close_all()
    return asyncio.run(_wrapped())


async def raises_http(status: int, coro):
    """Asteapta o HTTPException cu codul dat; intoarce detaliul."""
    from fastapi import HTTPException
    try:
        await coro
    except HTTPException as exc:
        assert exc.status_code == status, f"astept {status}, primit {exc.status_code}: {exc.detail}"
        return exc.detail
    raise AssertionError(f"astept HTTPException({status}), dar apelul a reusit")
