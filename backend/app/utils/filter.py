from __future__ import annotations
import json
from sqlalchemy import inspect as sa_inspect
from sqlalchemy.orm import DeclarativeBase
from fastapi import HTTPException


def apply_filters(stmt, model: type[DeclarativeBase], filters_json: str | None):
    """
    Aplica filtre custom dintr-un JSON string pe un statement SQLAlchemy.

    Exemplu: filters='{"currency":"RON","type":"Produs"}'
    Campurile necunoscute sunt ignorate (nu expun erori interne).
    """
    if not filters_json:
        return stmt
    try:
        filters: dict = json.loads(filters_json)
    except Exception:
        raise HTTPException(status_code=400, detail="Parametrul 'filters' trebuie sa fie JSON valid.")

    mapper = sa_inspect(model)
    valid_columns = {c.key for c in mapper.columns}

    for field, value in filters.items():
        if field not in valid_columns:
            continue
        stmt = stmt.where(getattr(model, field) == value)

    return stmt
