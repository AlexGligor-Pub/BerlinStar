from __future__ import annotations
import json
from sqlalchemy import inspect as sa_inspect
from sqlalchemy.orm import DeclarativeBase
from fastapi import HTTPException

_columns_cache: dict[type, frozenset[str]] = {}

# Coloane interne care nu trebuie expuse niciodata prin filtru extern
_BLOCKED_FIELDS = frozenset({"password", "is_deleted", "deleted_at"})

# Limita JSON la 2 KB pentru a evita parse-DoS
_MAX_FILTERS_JSON_BYTES = 2 * 1024


def _valid_columns(model: type[DeclarativeBase]) -> frozenset[str]:
    cached = _columns_cache.get(model)
    if cached is None:
        cached = frozenset(c.key for c in sa_inspect(model).columns)
        _columns_cache[model] = cached
    return cached


def apply_filters(stmt, model: type[DeclarativeBase], filters_json: str | None):
    if not filters_json:
        return stmt
    if len(filters_json.encode("utf-8")) > _MAX_FILTERS_JSON_BYTES:
        raise HTTPException(status_code=400, detail="Parametrul 'filters' este prea mare.")
    try:
        filters: dict = json.loads(filters_json)
    except Exception:
        raise HTTPException(status_code=400, detail="Parametrul 'filters' trebuie sa fie JSON valid.")
    if not isinstance(filters, dict):
        raise HTTPException(status_code=400, detail="Parametrul 'filters' trebuie sa fie un obiect JSON.")

    valid = _valid_columns(model)
    for field, value in filters.items():
        if field in _BLOCKED_FIELDS or field not in valid:
            continue
        # Acceptam doar valori scalare (int, float, str, bool, None)
        if not isinstance(value, (int, float, str, bool)) and value is not None:
            continue
        if isinstance(value, str) and len(value) > 200:
            continue
        stmt = stmt.where(getattr(model, field) == value)

    return stmt
