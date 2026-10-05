"""Verificarea ca un id primit de la client apartine contului apelantului.

Nu exista RLS: izolarea intre conturi sta in filtrul pe `account_id` din fiecare
query. Un id venit in body/query (client_id, employee_id, location_id, ...) trebuie
verificat INAINTE sa fie salvat sau folosit, altfel un cont poate lega (si citi
prin relatii) randuri ale altui cont.

Raspunsul e acelasi pentru „nu exista", „e al altui cont" si „e sters", ca sa nu
se poata enumera id-urile altor conturi.
"""
from __future__ import annotations
from typing import Any, Iterable

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


def _owned_filters(model: type[Any], account_id: int, allow_deleted: bool) -> list[Any]:
    if not hasattr(model, "account_id"):
        # Tabelele globale (fara account_id) nu au ce cauta aici; mai bine o eroare
        # de programare decat o verificare care trece in tacere.
        raise TypeError(f"{model.__name__} nu are account_id; nu se verifica apartenenta.")
    filters = [model.account_id == account_id]
    if not allow_deleted and hasattr(model, "is_deleted"):
        filters.append(model.is_deleted == False)  # noqa: E712
    return filters


async def assert_owned(
    db: AsyncSession,
    model: type[Any],
    obj_id: int | None,
    account_id: int,
    *,
    what: str,
    allow_deleted: bool = False,
) -> None:
    """Ridica 400 „{what} nu exista." daca `obj_id` nu e un rand activ al contului.

    `obj_id` None = nimic de verificat. `what` e subiectul articulat al mesajului
    („Clientul", „Angajatul", „Locatia").
    """
    if obj_id is None:
        return
    stmt = select(model.id).where(
        model.id == obj_id, *_owned_filters(model, account_id, allow_deleted)
    )
    if (await db.scalar(stmt)) is None:
        raise HTTPException(400, f"{what} nu exista.")


async def assert_all_owned(
    db: AsyncSession,
    model: type[Any],
    ids: Iterable[int | None] | None,
    account_id: int,
    *,
    what: str,
    allow_deleted: bool = False,
) -> None:
    """Ca `assert_owned`, pentru o lista: un singur query, pica daca ORICARE id
    lipseste sau e strain. Lista goala/None = nimic de verificat; duplicatele si
    valorile None sunt ignorate."""
    wanted = {i for i in (ids or ()) if i is not None}
    if not wanted:
        return
    stmt = select(model.id).where(
        model.id.in_(wanted), *_owned_filters(model, account_id, allow_deleted)
    )
    found = set((await db.execute(stmt)).scalars().all())
    if found != wanted:
        raise HTTPException(400, f"{what} nu exista.")
