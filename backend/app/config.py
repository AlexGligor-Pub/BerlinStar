import os

# Schimba SECRET_KEY in productie cu o valoare aleatoare puternica
# ex: python -c "import secrets; print(secrets.token_hex(32))"
SECRET_KEY: str = os.getenv("SECRET_KEY", "schimba-asta-in-productie")
ALGORITHM: str = "HS256"
TOKEN_EXPIRE_DAYS: int = 30

# === RO e-Factura ANAF ===
# Toate setarile eFactura se gestioneaza din UI:
#   AdminV2 -> eFactura -> Configurare globala
# (Fernet key, URL-uri ANAF, scheduler enabled, redirect URI etc.)
#
# Daca dintr-un motiv anume DB-ul nu poate fi atins, runtime_config.py
# foloseste ca fallback variabilele de mediu de mai jos. In productie acestea
# pot lipsi — UI-ul va auto-genera cheia Fernet la prima salvare.

# === Asistent AI (AdminV2) ===
# Backend-ul nu ruleaza Claude direct — proxeaza catre "agent-bridge" de pe host
# (vezi ops/agent-bridge/). Feature-flag OFF implicit; se activeaza pe QA.
ASSISTANT_ENABLED: bool = os.getenv("ASSISTANT_ENABLED", "0") == "1"
ASSISTANT_BRIDGE_URL: str = os.getenv("ASSISTANT_BRIDGE_URL", "http://host.docker.internal:8765")
ASSISTANT_BRIDGE_SECRET: str | None = os.getenv("ASSISTANT_BRIDGE_SECRET")

# === Radar AI (serviciu separat) ===
# Secretul comun cu serviciul Radar; implicitul de dev e permis DOAR cand
# serviciul e pe localhost, altfel pornirea se opreste (vezi ADR §4).
RADAR_SERVICE_URL: str = os.getenv("RADAR_SERVICE_URL", "http://localhost:4100")


def _radar_host_is_local(url: str) -> bool:
    from urllib.parse import urlparse

    return (urlparse(url).hostname or "").lower() in ("localhost", "127.0.0.1")


RADAR_SHARED_SECRET: str = os.getenv("RADAR_SHARED_SECRET") or ""
if not RADAR_SHARED_SECRET:
    if _radar_host_is_local(RADAR_SERVICE_URL):
        RADAR_SHARED_SECRET = "dev-secret"
    else:
        raise RuntimeError(
            "RADAR_SHARED_SECRET lipseste, iar RADAR_SERVICE_URL nu indica localhost. "
            "Genereaza secretul cu `python3 -c \"import secrets; print(secrets.token_urlsafe(48))\"` "
            "si pune-l in deploy/.env, identic pe backend si pe serviciul radar."
        )
