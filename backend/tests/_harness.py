"""Suport comun pentru testele care au nevoie de baza de date.

Rulam pe SQLite in memorie, cu DOAR tabelele de care au nevoie testele:
`create_all` pe tot metadata-ul pica, fiindca unele coloane sunt JSONB (tip
specific Postgres). Subsetul e suficient — ce testam aici e logica de business
(roluri, preturi, registrul de plati), nu DDL-ul de productie.

Fara pytest: repo-ul nu il are instalat, iar testele existente se ruleaza
standalone (`python -m tests.test_x` din `backend/`, in venv). Pastram
conventia.
"""
from __future__ import annotations
import asyncio
import os
from datetime import datetime, timezone
from decimal import Decimal

os.environ.setdefault("BERLINSTAR_DEV_SQLITE", "1")

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

import app.main  # noqa: F401  — importa toate modelele in metadata
from app.models.account import Account
from app.models.base import Base
from app.models.category import Category
from app.models.client import Client
from app.models.client_vehicol import ClientVehicol
from app.models.department import Department
from app.models.employee import Employee
from app.models.item import Item, ItemType
from app.models.receipt import PayMethod, Receipt, ReceiptItem
from app.models.vehicol import Vehicol
from app.models.user import User, UserRole, UserSession

def _sqlite_ready_tables():
    """Toate tabelele care se pot crea pe SQLite.

    Cateva coloane sunt JSONB (tip specific Postgres) si nu se compileaza aici;
    le sarim in loc sa enumeram manual un subset — altfel orice relatie noua cu
    `lazy="selectin"` pe un model deja testat ar pica testele cu „no such table".
    """
    from sqlalchemy.dialects import sqlite
    from sqlalchemy.schema import CreateTable

    dialect = sqlite.dialect()
    ok, skipped = [], []
    for table in Base.metadata.sorted_tables:
        try:
            CreateTable(table).compile(dialect=dialect)
        except Exception:
            skipped.append(table.name)
        else:
            ok.append(table)
    return ok, skipped


_TABLES, SKIPPED_TABLES = _sqlite_ready_tables()


async def make_session() -> AsyncSession:
    """Baza goala, cu schema creata. Fiecare test isi ia una proprie.

    Sesiunea si engine-ul sunt inchise de `run()` la finalul testului; altfel
    SQLAlchemy se plange ca le curata garbage collector-ul.
    """
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(lambda c: Base.metadata.create_all(c, tables=_TABLES))
    session = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)()
    _OPEN.append((session, engine))
    return session


# Sesiunile deschise de testul curent, ca `run()` sa le poata inchide.
_OPEN: list[tuple[AsyncSession, object]] = []


async def _close_all() -> None:
    while _OPEN:
        session, engine = _OPEN.pop()
        await session.close()
        await engine.dispose()


# ─── Constructori de fixture ──────────────────────────────────────────────────

async def make_account(db: AsyncSession, username: str = "firma", code: str = "firma") -> Account:
    acc = Account(name=username.title(), username=username, password="x", code=code)
    db.add(acc)
    await db.flush()
    return acc


async def make_user(
    db: AsyncSession, account: Account, username: str, role: UserRole = UserRole.WORKER, **kw
) -> User:
    user = User(
        account_id=account.id,
        username=username,
        password="x",
        role=role,
        name=kw.pop("name", username),
        is_active=kw.pop("is_active", True),
        **kw,
    )
    db.add(user)
    await db.flush()
    return user


async def make_employee(db: AsyncSession, account: Account, name: str = "Ion") -> Employee:
    emp = Employee(account_id=account.id, name=name)
    db.add(emp)
    await db.flush()
    return emp


async def make_item(db: AsyncSession, account: Account, name: str, price: str) -> Item:
    """Articol de catalog, cu departamentul si categoria minime pe care le cere
    schema (`items.category_id` e NOT NULL)."""
    dept = Department(account_id=account.id, name="Auto")
    db.add(dept)
    await db.flush()
    cat = Category(account_id=account.id, name="General", department_id=dept.id)
    db.add(cat)
    await db.flush()
    item = Item(
        account_id=account.id,
        name=name,
        price=Decimal(price),
        unit="buc",
        type=ItemType.PRODUS,
        category_id=cat.id,
    )
    db.add(item)
    await db.flush()
    return item


async def make_receipt(db: AsyncSession, account: Account, total: str = "100.00", **kw) -> Receipt:
    receipt = Receipt(
        account_id=account.id,
        titlu=kw.pop("titlu", "Bon test"),
        total=Decimal(total),
        pay_method=kw.pop("pay_method", PayMethod.NEPLATIT),
        created_at=datetime.now(timezone.utc),
        **kw,
    )
    db.add(receipt)
    await db.flush()
    return receipt


async def add_line(
    db: AsyncSession, receipt: Receipt, name: str, price: str, qty: int = 1,
    original_price: str | None = None, item_id: int | None = None,
) -> ReceiptItem:
    line = ReceiptItem(
        receipt_id=receipt.id,
        name=name,
        price=Decimal(price),
        original_price=Decimal(original_price) if original_price is not None else None,
        qty=qty,
        unit="buc",
        item_id=item_id,
    )
    db.add(line)
    await db.flush()
    return line


async def make_client(db: AsyncSession, account: Account, nume: str = "Popescu Ion") -> Client:
    client = Client(account_id=account.id, nume=nume, tip="fizic")
    db.add(client)
    await db.flush()
    return client


async def set_receipt_vehicol(
    db: AsyncSession, receipt: Receipt, numar_masina: str, **fields
) -> Vehicol:
    """Snapshotul de vehicul al unui bon: creeaza-l sau actualizeaza-l, exact ca
    endpointul PUT /receipts/{id}/vehicol."""
    vehicol = (await db.execute(
        select(Vehicol).where(Vehicol.receipt_id == receipt.id)
    )).scalar_one_or_none()
    if vehicol is None:
        vehicol = Vehicol(
            account_id=receipt.account_id, receipt_id=receipt.id, numar_masina=numar_masina,
        )
        db.add(vehicol)
    vehicol.numar_masina = numar_masina
    for k, v in fields.items():
        setattr(vehicol, k, v)
    await db.flush()
    return vehicol


async def client_garage(db: AsyncSession, client: Client) -> list[ClientVehicol]:
    """Masinile vizibile in fisa clientului, in ordinea din UI."""
    return list((await db.execute(
        select(ClientVehicol)
        .where(ClientVehicol.client_id == client.id, ClientVehicol.is_deleted == False)
        .order_by(ClientVehicol.id)
    )).scalars().all())


class FakeCtx:
    """Substitut minim de AuthContext: garzile folosesc doar `can(...)`."""

    def __init__(self, role: UserRole):
        self.role = role

    def can(self, resource) -> bool:
        from app.permissions import role_can
        return role_can(self.role, resource)


class Line:
    """Substitut de ReceiptItemCreate (schema Pydantic) pentru payload-uri."""

    def __init__(self, name, price, qty=1, original_price=None, item_id=None, vat_percent=None):
        self.name = name
        self.price = Decimal(str(price))
        self.qty = qty
        self.original_price = Decimal(str(original_price)) if original_price is not None else None
        self.item_id = item_id
        self.vat_percent = vat_percent


def run(coro):
    """Ruleaza un test async si inchide curat tot ce a deschis."""
    async def _wrapped():
        try:
            return await coro
        finally:
            await _close_all()
    return asyncio.run(_wrapped())


async def raises_http(status: int, coro):
    """Asteapta o HTTPException cu codul dat; intoarce detaliul."""
    from fastapi import HTTPException
    try:
        await coro
    except HTTPException as exc:
        assert exc.status_code == status, f"astept {status}, primit {exc.status_code}: {exc.detail}"
        return exc.detail
    raise AssertionError(f"astept HTTPException({status}), dar apelul a reusit")
