import os

# Schimba SECRET_KEY in productie cu o valoare aleatoare puternica
# ex: python -c "import secrets; print(secrets.token_hex(32))"
SECRET_KEY: str = os.getenv("SECRET_KEY", "schimba-asta-in-productie")
ALGORITHM: str = "HS256"
TOKEN_EXPIRE_DAYS: int = 30
