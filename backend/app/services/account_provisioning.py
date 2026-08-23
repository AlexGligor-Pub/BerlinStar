"""Provisionarea unui cont nou: codul firmei + utilizatorul administrator.

De ce exista: dupa trecerea la autentificare pe utilizatori, login-ul nu mai
citeste `accounts.password` — cauta un rand in `users`. Un cont creat fara user
admin ar fi imposibil de accesat. Migrarea usr01 a rezolvat conturile existente;
acest modul rezolva fiecare cont creat de acum inainte (self-register si AdminV2).

Aceeasi logica de generare a codului ca in migrare, ca sa nu apara doua stiluri
de coduri in acelasi sistem.
"""
from __future__ import annotations
import re
import unicodedata

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.account import Account
from app.models.user import User, UserRole

CODE_MAX = 50


def slugify_code(value: str) -> str:
    """Cod firma lizibil: fara diacritice, doar [a-z0-9-], max 40 caractere."""
    normalized = unicodedata.normalize("NFKD", value or "")
    ascii_only = normalized.encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", ascii_only).strip("-").lower()
    return slug[:40] or "firma"


async def generate_account_code(db: AsyncSession, account: Account) -> str:
    """Cod unic, derivat din numele contului. La coliziune sufixam cu id-ul
    contului, care e unic prin definitie."""
    base = slugify_code(account.name or account.username or f"firma-{account.id}")
    taken = set((await db.execute(select(Account.code).where(Account.code.isnot(None)))).scalars().all())
    if base not in taken:
        return base
    candidate = f"{base}-{account.id}"[:CODE_MAX]
    if candidate not in taken:
        return candidate
    # Extrem de improbabil (cod deja folosit de alt cont cu acelasi id in slug);
    # cautam primul sufix numeric liber ca sa nu intoarcem niciodata un duplicat.
    i = 2
    while f"{base}-{account.id}-{i}"[:CODE_MAX] in taken:
        i += 1
    return f"{base}-{account.id}-{i}"[:CODE_MAX]


async def provision_account_admin(
    db: AsyncSession,
    account: Account,
    password_hash: str,
    *,
    commit: bool = True,
) -> User:
    """Da contului un cod de firma (daca nu are) si un utilizator `admin`.

    `password_hash` este hash-ul deja calculat al parolei alese la crearea
    contului — userul admin porneste cu exact aceleasi credentiale, deci
    proprietarul se autentifica fix cu ce a primit la inregistrare.
    """
    if not account.code:
        account.code = await generate_account_code(db, account)

    existing = (await db.execute(
        select(User).where(User.account_id == account.id, User.username == account.username)
    )).scalar_one_or_none()
    if existing is not None:
        return existing

    user = User(
        account_id=account.id,
        username=account.username,
        password=password_hash,
        role=UserRole.ADMIN,
        name=account.name or account.username,
        email=account.email,
        is_active=True,
    )
    db.add(user)
    if commit:
        await db.commit()
        await db.refresh(user)
    return user
