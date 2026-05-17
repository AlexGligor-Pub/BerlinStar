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
