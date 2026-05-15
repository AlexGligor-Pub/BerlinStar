from __future__ import annotations
import logging
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models.category import Category
from app.models.company import Company
from app.models.department import Department
from app.models.disclaimer import Disclaimer
from app.models.employee import Employee
from app.models.general_settings import GeneralSettings
from app.models.item import Item, ItemType
from app.models.location import Location, employee_locations, location_departments
from app.models.register import Register
from app.utils.anaf import lookup_anaf

log = logging.getLogger("berlinstar")


SEED = {
    "Vulcanizare": {
        "Anvelope vara": {
            "produse": [
                ("Anvelopa vara 195/65 R15", "320.00", "buc"),
                ("Anvelopa vara 205/55 R16", "380.00", "buc"),
            ],
            "servicii": [
                ("Montare anvelopa vara", "25.00", "buc"),
                ("Echilibrare roata", "15.00", "buc"),
            ],
        },
        "Anvelope iarna": {
            "produse": [
                ("Anvelopa iarna 195/65 R15", "360.00", "buc"),
                ("Anvelopa iarna 205/55 R16", "420.00", "buc"),
            ],
            "servicii": [
                ("Montare anvelopa iarna", "25.00", "buc"),
                ("Schimb sezonier set 4 roti", "90.00", "set"),
            ],
        },
    },
    "Geometrie": {
        "Geometrie directie": {
            "produse": [
                ("Kit bara directie", "280.00", "buc"),
                ("Kit pivot inferior", "220.00", "buc"),
            ],
            "servicii": [
                ("Reglaj geometrie axa fata", "120.00", "buc"),
                ("Reglaj geometrie 4 roti", "200.00", "buc"),
            ],
        },
        "Suspensie": {
            "produse": [
                ("Amortizor fata", "350.00", "buc"),
                ("Arc elicoidal", "180.00", "buc"),
            ],
            "servicii": [
                ("Inlocuire amortizoare fata", "150.00", "buc"),
                ("Verificare suspensie", "60.00", "buc"),
            ],
        },
    },
}

DISCLAIMER_TEXT = (
    "Va rugam pastrati bonul/devizul pentru orice reclamatie. "
    "Garantia pieselor este de 12 luni de la data montajului, conform legii. "
    "Service-ul nu raspunde pentru defectiuni cauzate de utilizare necorespunzatoare."
)


async def seed_new_account(
    account_id: int,
    company_id: int,
    cui: int,
    fallback_name: str,
    fallback_phone: str,
) -> None:
    """Populeaza un cont proaspat inregistrat cu date demo functionale.

    Ruleaza in background dupa /api/auth/register. Esuarea unei sub-etape
    nu re-arunca exceptie — logam si ne oprim. Contul ramane partial seeded
    si poate fi completat manual sau prin re-run.
    """
    try:
        async with AsyncSessionLocal() as db:
            # 1. ANAF enrichment (best-effort)
            anaf = await lookup_anaf(cui)
            company = await db.get(Company, company_id)
            if company is not None and anaf is not None:
                if anaf.get("name"):
                    company.name = anaf["name"][:300]
                company.address = anaf.get("address")
                company.nr_reg_com = anaf.get("nr_reg_com")
                company.postal_code = anaf.get("postal_code")
                company.is_vat_payer = anaf.get("is_vat_payer")
                company.registration_status = anaf.get("registration_status")
                if not company.phone and anaf.get("phone"):
                    company.phone = anaf["phone"]
                company.updated_at = datetime.now(timezone.utc)
            elif company is None:
                log.warning("Seed: company %s missing for account %s", company_id, account_id)

            # 2. GeneralSettings (defaults pe model)
            gs_exists = (await db.execute(
                select(GeneralSettings).where(GeneralSettings.account_id == account_id)
            )).scalar_one_or_none()
            if gs_exists is None:
                db.add(GeneralSettings(account_id=account_id))

            # 3. Disclaimer
            disclaimer = Disclaimer(
                account_id=account_id,
                title="Termeni si conditii",
                text=DISCLAIMER_TEXT,
            )
            db.add(disclaimer)

            # 4. Register
            register = Register(
                account_id=account_id,
                company_id=company_id,
                name="Registru principal",
            )
            db.add(register)

            await db.flush()  # need disclaimer.id, register.id

            # 5. Location
            location = Location(
                account_id=account_id,
                name="Berlin",
                company_id=company_id,
                disclaimer_id=disclaimer.id,
                register_id=register.id,
            )
            db.add(location)
            await db.flush()

            # 6. Departments + Categories + Items
            department_ids: list[int] = []
            for dept_name, categs in SEED.items():
                dept = Department(account_id=account_id, name=dept_name)
                db.add(dept)
                await db.flush()
                department_ids.append(dept.id)

                for cat_name, items_dict in categs.items():
                    category = Category(
                        account_id=account_id,
                        name=cat_name,
                        department_id=dept.id,
                    )
                    db.add(category)
                    await db.flush()

                    for name, price, unit in items_dict["produse"]:
                        db.add(Item(
                            account_id=account_id,
                            category_id=category.id,
                            name=name,
                            price=Decimal(price),
                            unit=unit,
                            type=ItemType.PRODUS,
                        ))
                    for name, price, unit in items_dict["servicii"]:
                        db.add(Item(
                            account_id=account_id,
                            category_id=category.id,
                            name=name,
                            price=Decimal(price),
                            unit=unit,
                            type=ItemType.SERVICE,
                        ))

            # 7. M2M location ↔ departments
            for dept_id in department_ids:
                await db.execute(
                    location_departments.insert().values(
                        location_id=location.id, department_id=dept_id
                    )
                )

            # 8. Angajat Alex
            employee = Employee(
                account_id=account_id,
                name="Alex",
                description="Administrator",
            )
            db.add(employee)
            await db.flush()

            await db.execute(
                employee_locations.insert().values(
                    employee_id=employee.id, location_id=location.id
                )
            )

            await db.commit()
            log.info(
                "Seed new account OK account_id=%s company_id=%s anaf=%s",
                account_id, company_id, anaf is not None,
            )
    except Exception:
        log.exception("Seed new account failed account_id=%s", account_id)
