from __future__ import annotations
from typing import Callable, TypeVar
from sqlalchemy.ext.asyncio import AsyncSession
from app.schemas.common import Page

T = TypeVar("T")


async def paginate(
    db: AsyncSession,
    stmt,
    limit: int,
    transform: Callable | None = None,
) -> Page:
    """
    Executa un statement SQLAlchemy si returneaza o Page cu cursor-based pagination.
    transform: functie optionala aplicata fiecarui rand inainte de serializare.
    """
    rows = (await db.execute(stmt)).scalars().all()
    has_more = len(rows) > limit
    page = rows[:limit]
    items = [transform(r) for r in page] if transform else list(page)
    return Page(items=items, next_cursor=page[-1].id if has_more else None)
