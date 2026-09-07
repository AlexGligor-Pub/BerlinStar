"""Configurarea serviciului Radar. Totul din mediu; `.env` doar pentru dev local."""
from __future__ import annotations

import os
from pathlib import Path
from urllib.parse import urlparse

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

load_dotenv(BASE_DIR / ".env")

MONOLITH_URL: str = (os.getenv("MONOLITH_URL") or "http://localhost:4000").rstrip("/")

DATABASE_URL: str | None = os.getenv("RADAR_DATABASE_URL") or os.getenv("DATABASE_URL")

RADAR_MAX_RUN_COST_USD: float = float(os.getenv("RADAR_MAX_RUN_COST_USD") or 3.0)
RADAR_LOG_LEVEL: str = (os.getenv("RADAR_LOG_LEVEL") or "INFO").upper()

MONOLITH_TIMEOUT = 30.0
AI_CONFIG_TTL = 60.0


def _is_local(url: str) -> bool:
    return (urlparse(url).hostname or "").lower() in ("localhost", "127.0.0.1")


SHARED_SECRET: str = os.getenv("RADAR_SHARED_SECRET") or ""
if not SHARED_SECRET:
    if _is_local(MONOLITH_URL):
        SHARED_SECRET = "dev-secret"
    else:
        raise RuntimeError(
            "RADAR_SHARED_SECRET lipseste, iar MONOLITH_URL nu indica localhost. "
            "Genereaza secretul cu `python3 -c \"import secrets; print(secrets.token_urlsafe(48))\"` "
            "si pune-l identic in deploy/.env pentru backend si radar."
        )
