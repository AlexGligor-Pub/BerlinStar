from __future__ import annotations
from typing import Callable, TypeVar
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.schemas.common import Page

T = TypeVar("T")


def checked_limit(limit: int) -> int:
    """Refuza cu 422 un `limit` mai mic decat 1.

    Listele cer `limit + 1` randuri ca sa afle daca mai urmeaza o pagina: cu
    limit=0 pagina e goala dar „mai sunt randuri" (IndexError pe cursor), iar un
    limit negativ ajunge LIMIT negativ in Postgres — ambele raspundeau 500.
    Acelasi contract ca listele care valideaza prin `Query(ge=1)`.
    """
    if limit < 1:
        raise HTTPException(422, "Parametrul limit trebuie sa fie cel putin 1.")
    return limit


async def paginate(
    db: AsyncSession,
    stmt,
    limit: int,
    transform: Callable | None = None,
    total: int | None = None,
) -> Page:
    """
    Executa un statement SQLAlchemy si returneaza o Page cu cursor-based pagination.
    transform: functie optionala aplicata fiecarui rand inainte de serializare.
    total: numarul total de randuri, calculat de apelant doar la paginarea pe offset.
    """
    # Inainte de executie: apelantul a pus deja `.limit(limit + 1)` pe statement.
    checked_limit(limit)
    rows = (await db.execute(stmt)).scalars().all()
    has_more = len(rows) > limit
    page = rows[:limit]
    items = [transform(r) for r in page] if transform else list(page)
    return Page(items=items, next_cursor=page[-1].id if has_more and page else None, total=total)
