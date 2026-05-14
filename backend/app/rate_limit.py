from __future__ import annotations
from slowapi import Limiter
from slowapi.util import get_remote_address

# In-memory rate limiter (suficient pentru ~200 utilizatori, 1 worker).
# Daca scalam la mai multi workeri, treci storage_uri la "redis://..."
limiter = Limiter(key_func=get_remote_address, default_limits=["60/minute"])
