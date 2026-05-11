from __future__ import annotations
import json
from sqlalchemy import inspect as sa_inspect
from sqlalchemy.orm import DeclarativeBase
from fastapi import HTTPException

_columns_cache: dict[type, frozenset[str]] = {}


def _valid_columns(model: type[DeclarativeBase]) -> frozenset[str]:
    cached = _columns_cache.get(model)
    if cached is None:
        cached = frozenset(c.key for c in sa_inspect(model).columns)
        _columns_cache[model] = cached
    return cached


def apply_filters(stmt, model: type[DeclarativeBase], filters_json: str | None):
    if not filters_json:
        return stmt
    try:
        filters: dict = json.loads(filters_json)
    except Exception:
        raise HTTPException(status_code=400, detail="Parametrul 'filters' trebuie sa fie JSON valid.")

    valid = _valid_columns(model)
    for field, value in filters.items():
        if field not in valid:
            continue
        stmt = stmt.where(getattr(model, field) == value)

    return stmt
