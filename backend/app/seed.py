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
                    {"name": "Coca-Cola 0.5L",    "price": "5.50",  "unit": "buc",   "type": "Produs"},
                    {"name": "Apa Plata 0.5L",    "price": "2.00",  "unit": "buc",   "type": "Produs"},
                    {"name": "Bere Ursus 0.5L",   "price": "7.00",  "unit": "buc",   "type": "Produs"},
                    {"name": "Suc Portocale 1L",  "price": "9.50",  "unit": "buc",   "type": "Produs"},
                ],
            },
            {
                "name": "Alimente",
                "items": [
                    {"name": "Paine Alba",    "price": "4.00",  "unit": "buc",   "type": "Produs"},
                    {"name": "Lapte 1L",      "price": "8.50",  "unit": "buc",   "type": "Produs"},
                    {"name": "Oua (10 buc)",  "price": "14.00", "unit": "cutie", "type": "Produs"},
                    {"name": "Cascaval 200g", "price": "18.00", "unit": "pac",   "type": "Produs"},
                ],
            },
            {
                "name": "Snacks",
                "items": [
                    {"name": "Chips Lays",      "price": "7.50",  "unit": "buc", "type": "Produs"},
                    {"name": "Ciocolata Milka", "price": "12.00", "unit": "buc", "type": "Produs"},
                    {"name": "Guma Orbit",      "price": "5.00",  "unit": "buc", "type": "Produs"},
                    {"name": "Baton KitKat",    "price": "6.00",  "unit": "buc", "type": "Produs"},
                ],
            },
        ],
    },
    {
        "theme": "Piese Auto",
        "categories": [
            {
                "name": "Filtre",
                "items": [
                    {"name": "Filtru ulei Mann W712",       "price": "35.00",  "unit": "buc", "type": "Produs"},
                    {"name": "Filtru aer Mann C2695",       "price": "48.00",  "unit": "buc", "type": "Produs"},
                    {"name": "Filtru polen Bosch 1987432",  "price": "52.00",  "unit": "buc", "type": "Produs"},
                    {"name": "Filtru combustibil WK820",    "price": "65.00",  "unit": "buc", "type": "Produs"},
                    {"name": "Filtru habitaclu carbon",     "price": "78.00",  "unit": "buc", "type": "Produs"},
                ],
            },
            {
                "name": "Uleiuri si Lichide",
                "items": [
                    {"name": "Ulei motor 5W-40 4L Castrol",  "price": "185.00", "unit": "buc", "type": "Produs"},
                    {"name": "Ulei motor 5W-30 5L Mobil",    "price": "210.00", "unit": "buc", "type": "Produs"},
                    {"name": "Lichid racire G12+ 1L",        "price": "28.00",  "unit": "buc", "type": "Produs"},
                    {"name": "Lichid frana DOT 4 500ml",     "price": "32.00",  "unit": "buc", "type": "Produs"},
                    {"name": "Lichid parbriz concentrat 1L", "price": "18.00",  "unit": "buc", "type": "Produs"},
                    {"name": "Ulei cutie viteze ATF 1L",     "price": "55.00",  "unit": "buc", "type": "Produs"},
                ],
            },
            {
                "name": "Frane",
                "items": [
                    {"name": "Placute frana fata Brembo",   "price": "145.00", "unit": "set", "type": "Produs"},
                    {"name": "Placute frana spate Brembo",  "price": "125.00", "unit": "set", "type": "Produs"},
                    {"name": "Disc frana fata 280mm",       "price": "195.00", "unit": "buc", "type": "Produs"},
                    {"name": "Disc frana spate 260mm",      "price": "175.00", "unit": "buc", "type": "Produs"},
                    {"name": "Tambur frana",                "price": "220.00", "unit": "buc", "type": "Produs"},
                ],
            },
            {
                "name": "Suspensie",
                "items": [
                    {"name": "Amortizor fata Monroe",       "price": "380.00", "unit": "buc", "type": "Produs"},
                    {"name": "Amortizor spate Monroe",      "price": "320.00", "unit": "buc", "type": "Produs"},
                    {"name": "Arc suspensie fata",          "price": "210.00", "unit": "buc", "type": "Produs"},
                    {"name": "Brat suspensie stanga",       "price": "285.00", "unit": "buc", "type": "Produs"},
                    {"name": "Cap de bara directie",        "price": "95.00",  "unit": "buc", "type": "Produs"},
                    {"name": "Bucsa stabilizator",          "price": "35.00",  "unit": "buc", "type": "Produs"},
                ],
            },
            {
                "name": "Electrice",
                "items": [
                    {"name": "Bujie NGK Iridium",           "price": "42.00",  "unit": "buc", "type": "Produs"},
                    {"name": "Set bujii 4 buc NGK",         "price": "160.00", "unit": "set", "type": "Produs"},
                    {"name": "Alternator reconditioant",    "price": "650.00", "unit": "buc", "type": "Produs"},
                    {"name": "Electromotor reconditionat",  "price": "580.00", "unit": "buc", "type": "Produs"},
                    {"name": "Baterie 12V 60Ah Varta",      "price": "420.00", "unit": "buc", "type": "Produs"},
                    {"name": "Senzor temperatura motor",    "price": "85.00",  "unit": "buc", "type": "Produs"},
                ],
            },
        ],
    },
    {
        "theme": "Servicii Mecanica",
        "categories": [
            {
                "name": "Revizie",
                "items": [
                    {"name": "Schimb ulei + filtru",                "price": "80.00",  "unit": "buc", "type": "Serviciu"},
                    {"name": "Revizie completa 30.000 km",          "price": "350.00", "unit": "buc", "type": "Serviciu"},
                    {"name": "Revizie completa 60.000 km",          "price": "550.00", "unit": "buc", "type": "Serviciu"},
                    {"name": "Inlocuire kit distributie",           "price": "450.00", "unit": "buc", "type": "Serviciu"},
                    {"name": "Verificare tehnica generala",         "price": "120.00", "unit": "buc", "type": "Serviciu"},
                ],
            },
            {
                "name": "Frane si Suspensie",
                "items": [
                    {"name": "Montaj placute frana fata",           "price": "80.00",  "unit": "buc", "type": "Serviciu"},
                    {"name": "Montaj placute frana spate",          "price": "80.00",  "unit": "buc", "type": "Serviciu"},
                    {"name": "Montaj disc frana (buc)",             "price": "60.00",  "unit": "buc", "type": "Serviciu"},
                    {"name": "Purjare circuit frana",               "price": "90.00",  "unit": "buc", "type": "Serviciu"},
                    {"name": "Montaj amortizor (buc)",              "price": "120.00", "unit": "buc", "type": "Serviciu"},
                    {"name": "Geometrie roti (2D)",                 "price": "120.00", "unit": "buc", "type": "Serviciu"},
                    {"name": "Geometrie roti (3D)",                 "price": "180.00", "unit": "buc", "type": "Serviciu"},
                ],
            },
            {
                "name": "Motor si Transmisie",
                "items": [
                    {"name": "Diagnosticare electronica",           "price": "100.00", "unit": "buc", "type": "Serviciu"},
                    {"name": "Inlocuire curea accesorii",           "price": "180.00", "unit": "buc", "type": "Serviciu"},
                    {"name": "Inlocuire garnitura chiuloasa",       "price": "800.00", "unit": "buc", "type": "Serviciu"},
                    {"name": "Curatare injectoare (buc)",           "price": "80.00",  "unit": "buc", "type": "Serviciu"},
                    {"name": "Inlocuire ambreiaj complet",          "price": "600.00", "unit": "buc", "type": "Serviciu"},
                    {"name": "Schimb ulei cutie viteze",            "price": "120.00", "unit": "buc", "type": "Serviciu"},
                ],
            },
            {
                "name": "Climatizare si Electrica",
                "items": [
                    {"name": "Incarcare freon AC R134a",            "price": "200.00", "unit": "buc", "type": "Serviciu"},
                    {"name": "Curatare si dezinfectare AC",         "price": "120.00", "unit": "buc", "type": "Serviciu"},
                    {"name": "Diagnosticare sistem electric",       "price": "120.00", "unit": "buc", "type": "Serviciu"},
                    {"name": "Inlocuire alternator",                "price": "180.00", "unit": "buc", "type": "Serviciu"},
                    {"name": "Inlocuire electromotor",              "price": "150.00", "unit": "buc", "type": "Serviciu"},
                    {"name": "Montaj / schimb baterie",             "price": "50.00",  "unit": "buc", "type": "Serviciu"},
                ],
            },
        ],
    },
    {
        "theme": "Anvelope si Jante",
        "categories": [
            {
                "name": "Anvelope Vara",
                "items": [
                    {"name": "Anvelopa vara 195/65 R15 Michelin",   "price": "420.00", "unit": "buc", "type": "Produs"},
                    {"name": "Anvelopa vara 205/55 R16 Continental","price": "480.00", "unit": "buc", "type": "Produs"},
                    {"name": "Anvelopa vara 225/45 R17 Pirelli",    "price": "580.00", "unit": "buc", "type": "Produs"},
                    {"name": "Anvelopa vara 185/60 R14 Bridgestone","price": "350.00", "unit": "buc", "type": "Produs"},
                ],
            },
            {
                "name": "Anvelope Iarna",
                "items": [
                    {"name": "Anvelopa iarna 195/65 R15 Nokian",    "price": "460.00", "unit": "buc", "type": "Produs"},
                    {"name": "Anvelopa iarna 205/55 R16 Hankook",   "price": "510.00", "unit": "buc", "type": "Produs"},
                    {"name": "Anvelopa iarna 225/45 R17 Goodyear",  "price": "620.00", "unit": "buc", "type": "Produs"},
                    {"name": "Anvelopa iarna 175/70 R13 Sava",      "price": "280.00", "unit": "buc", "type": "Produs"},
                ],
            },
            {
                "name": "Servicii Anvelope",
                "items": [
                    {"name": "Montaj + echilibrare roata (buc)",    "price": "35.00",  "unit": "buc", "type": "Serviciu"},
                    {"name": "Sezonier complet (4 roti)",           "price": "120.00", "unit": "buc", "type": "Serviciu"},
                    {"name": "Vulcanizare anvelopa",                "price": "50.00",  "unit": "buc", "type": "Serviciu"},
                    {"name": "Verificare si umflare roti (4 buc)",  "price": "20.00",  "unit": "buc", "type": "Serviciu"},
                    {"name": "Depozitare anvelope sezon",           "price": "150.00", "unit": "buc", "type": "Serviciu"},
                ],
            },
            {
                "name": "Jante",
                "items": [
                    {"name": "Janta aliaj 15\" 6.5J ET38",          "price": "350.00", "unit": "buc", "type": "Produs"},
                    {"name": "Janta aliaj 16\" 7J ET40",            "price": "420.00", "unit": "buc", "type": "Produs"},
                    {"name": "Janta tabla 15\" 6J",                 "price": "180.00", "unit": "buc", "type": "Produs"},
                    {"name": "Reparatie janta aliaj (fisura)",      "price": "180.00", "unit": "buc", "type": "Serviciu"},
                    {"name": "Vopsit janta aliaj",                  "price": "120.00", "unit": "buc", "type": "Serviciu"},
                ],
            },
        ],
    },
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
                        item_type = ItemType.SERVICE if item_data.get("type") == "Serviciu" else ItemType.PRODUS
                        db.add(Item(
                            name=item_data["name"],
                            price=Decimal(item_data["price"]),
                            currency="RON",
                            unit=item_data["unit"],
                            type=item_type,
                            category_id=category.id,
                            account_id=account.id,
                        ))

        await db.commit()
    print("Seed complet.")


if __name__ == "__main__":
    asyncio.run(seed())
