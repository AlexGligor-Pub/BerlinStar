"""
Script de seed idempotent — sigur de rulat de mai multe ori.
Comanda: python -m app.seed
"""
from __future__ import annotations
import asyncio
import base64
from decimal import Decimal
from sqlalchemy import select

from app.database import AsyncSessionLocal, engine
from app.models.base import Base
from app.models.account import Account
from app.models.theme import Theme
from app.models.category import Category
from app.models.item import Item, ItemType

SEED_DATA = [
    {
        "theme": "Alimentatie",
        "categories": [
            {
                "name": "Bauturi",
                "items": [
                    {"name": "Coca-Cola 0.5L",    "price": "5.50",  "unit": "buc"},
                    {"name": "Apa Plata 0.5L",    "price": "2.00",  "unit": "buc"},
                    {"name": "Bere Ursus 0.5L",   "price": "7.00",  "unit": "buc"},
                    {"name": "Suc Portocale 1L",  "price": "9.50",  "unit": "buc"},
                ],
            },
            {
                "name": "Alimente",
                "items": [
                    {"name": "Paine Alba",    "price": "4.00",  "unit": "buc"},
                    {"name": "Lapte 1L",      "price": "8.50",  "unit": "buc"},
                    {"name": "Oua (10 buc)",  "price": "14.00", "unit": "cutie"},
                    {"name": "Cascaval 200g", "price": "18.00", "unit": "pac"},
                ],
            },
            {
                "name": "Snacks",
                "items": [
                    {"name": "Chips Lays",      "price": "7.50",  "unit": "buc"},
                    {"name": "Ciocolata Milka", "price": "12.00", "unit": "buc"},
                    {"name": "Guma Orbit",      "price": "5.00",  "unit": "buc"},
                    {"name": "Baton KitKat",    "price": "6.00",  "unit": "buc"},
                ],
            },
        ],
    }
]


async def seed() -> None:
    # Creeaza tabelele daca nu exista (safety net)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:
        # Account implicit
        account = (await db.execute(
            select(Account).where(Account.username == "admin")
        )).scalar_one_or_none()
        if not account:
            account = Account(
                name="Administrator",
                username="admin",
                password=base64.b64encode(b"admin").decode(),
            )
            db.add(account)
            await db.flush()

        for theme_data in SEED_DATA:
            theme = (await db.execute(
                select(Theme).where(Theme.name == theme_data["theme"])
            )).scalar_one_or_none()
            if not theme:
                theme = Theme(name=theme_data["theme"], account_id=account.id)
                db.add(theme)
                await db.flush()

            for cat_data in theme_data["categories"]:
                category = (await db.execute(
                    select(Category).where(
                        Category.name == cat_data["name"],
                        Category.theme_id == theme.id,
                    )
                )).scalar_one_or_none()
                if not category:
                    category = Category(
                        name=cat_data["name"],
                        theme_id=theme.id,
                        account_id=account.id,
                    )
                    db.add(category)
                    await db.flush()

                for item_data in cat_data["items"]:
                    exists = (await db.execute(
                        select(Item).where(
                            Item.name == item_data["name"],
                            Item.category_id == category.id,
                        )
                    )).scalar_one_or_none()
                    if not exists:
                        db.add(Item(
                            name=item_data["name"],
                            price=Decimal(item_data["price"]),
                            currency="RON",
                            unit=item_data["unit"],
                            type=ItemType.PRODUS,
                            category_id=category.id,
                            account_id=account.id,
                        ))

        await db.commit()
    print("Seed complet.")


if __name__ == "__main__":
    asyncio.run(seed())
