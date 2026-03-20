from __future__ import annotations
from fastapi import HTTPException
from sqlalchemy import inspect


def apply_sort(stmt, model, sort: str | None, default_col: str = "id"):
    """
    Aplica ORDER BY dupa un camp trimis ca string.
    Prefix '-' = descendent.  Exemplu: sort="name", sort="-price"
    Intotdeauna adauga 'id' ca tiebreaker secundar pentru stabilitatea cursorului.
    """
    if sort:
        desc = sort.startswith("-")
        col_name = sort[1:] if desc else sort
    else:
        col_name, desc = default_col, False

    mapper = inspect(model)
    valid_columns = {c.key for c in mapper.columns}
    if col_name not in valid_columns:
        raise HTTPException(400, f"Camp de sortare invalid: '{col_name}'")

    col = getattr(model, col_name)
    primary = col.desc() if desc else col.asc()

    # id ca tiebreaker — pastreaza cursorul stabil
    if col_name != "id":
        return stmt.order_by(primary, model.id.asc())
    return stmt.order_by(primary)
