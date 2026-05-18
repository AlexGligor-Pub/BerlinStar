"""Demo data seeder — populeaza contul "ProfessorPrimeDemo" cu ~2 ani de date realiste.

Genereaza in medie 40 devize/zi intre 2024-05-01 si 2026-05-18, cu sezonalitate
(varfuri primavara/toamna, depresiuni iarna/vara), 2 locatii, 10 angajati, 6 divizii,
inventar viu (intrari + iesiri), programari, hotel anvelope cu cicluri vara/iarna.
"""
from __future__ import annotations

import logging
import random
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from faker import Faker
from sqlalchemy import insert, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal
from app.models.account import Account
from app.models.anvelopa import Anvelopa, TipAnvelopa
from app.models.category import Category
from app.models.cazare_anvelope import CazareAnvelope, CazareAnvelopaItem
from app.models.client import Client
from app.models.company import Company
from app.models.department import Department
from app.models.dimensiune_anvelopa import DimensiuneAnvelopa
from app.models.disclaimer import Disclaimer
from app.models.employee import Employee
from app.models.general_settings import GeneralSettings
from app.models.item import Item, ItemType
from app.models.loc_cazare import LocCazare
from app.models.location import Location, employee_locations, location_departments
from app.models.marca_anvelopa import MarcaAnvelopa
from app.models.profil_anvelopa import ProfilAnvelopa
from app.models.programare import Programare, ProgramareStatus
from app.models.receipt import PayMethod, Receipt, ReceiptItem
from app.models.register import Register
from app.models.stock import Stock
from app.models.stock_movement import StockMovement, StockMovementType
from app.models.vehicol import Vehicol
from app.utils.security import hash_password

from app.services.demo_seeder.config import (
    AVG_RECEIPTS_PER_DAY,
    COMMIT_BATCH_SIZE,
    DATE_END,
    DATE_START,
    DEMO_ACCOUNT_NAME,
    DEMO_COMPANY_NAME,
    DEMO_CUI,
    DEMO_EMAIL,
    DEMO_PASSWORD,
    DEMO_USERNAME,
    DEPARTMENTS,
    DEPT_WEIGHTS,
    EMPLOYEES_CENTRU,
    EMPLOYEES_NORD,
    INITIAL_STOCK_DATE,
    LOCATIONS,
    N_CLIENTS_FIZICI,
    N_CLIENTS_JURIDICI,
    PAY_METHOD_SPLIT,
    RECEIPTS_REPORT_EVERY_DAYS,
    TIRE_BRANDS,
    TIRE_HOTEL_CLIENT_RATIO,
    TIRE_HOTEL_CYCLES,
    TIRE_HOTEL_RACKS,
    TIRE_PROFILES,
    TIRE_SIZES,
)
from app.services.demo_seeder.catalog_data import items_for_department, category_name_for
from app.services.demo_seeder.seasonality import (
    pick_department_weights,
    receipts_for_day,
    season_of,
)

log = logging.getLogger("berlinstar")

RNG_SEED = 42

CAR_BRANDS = [
    ("Dacia", ["Logan", "Sandero", "Duster", "Spring"]),
    ("VW", ["Golf", "Passat", "Polo", "Tiguan"]),
    ("Skoda", ["Octavia", "Fabia", "Superb", "Kodiaq"]),
    ("Ford", ["Focus", "Mondeo", "Fiesta", "Kuga"]),
    ("Opel", ["Astra", "Insignia", "Corsa", "Mokka"]),
    ("Renault", ["Clio", "Megane", "Captur", "Kadjar"]),
    ("BMW", ["Seria 3", "Seria 5", "X1", "X3"]),
    ("Mercedes", ["A-Class", "C-Class", "E-Class", "GLA"]),
    ("Audi", ["A3", "A4", "Q3", "Q5"]),
    ("Toyota", ["Corolla", "Yaris", "RAV4", "C-HR"]),
    ("Hyundai", ["Tucson", "i30", "Kona", "i20"]),
]

COUNTY_CODES = ["B", "IF", "CJ", "TM", "CT", "BV", "PH", "AG", "DJ", "IS"]


# ───────────────────────────── Public API ────────────────────────────────────


async def seed_demo_account(force: bool = False) -> dict:
    """Creeaza contul demo + populeaza cu 2 ani de date.

    Returneaza un dict cu rezumat (counts + duration_seconds).
    Daca exista deja un cont cu username `ProfessorPrimeDemo` si force=False,
    arunca ValueError. force=True nu este implementat (decizie utilizator: cleanup manual).

    Pseudo-tranzactie: daca orice pas dupa creearea contului esueaza, apelam
    automat delete_demo_account pentru a evita lasarea unei stari corupte
    (cont partial seedat, FK orfane). Eroarea originala se re-ridica.
    """
    start_ts = datetime.now(timezone.utc)
    seed_started = False
    try:
        async with AsyncSessionLocal() as db:
            existing = (await db.execute(
                select(Account).where(Account.username == DEMO_USERNAME)
            )).scalar_one_or_none()
            if existing is not None:
                raise ValueError(
                    f"Account '{DEMO_USERNAME}' already exists (id={existing.id}). "
                    "Sterge-l manual din DB inainte de a rerula seederul."
                )

            rng = random.Random(RNG_SEED)
            fake = Faker("ro_RO")
            Faker.seed(RNG_SEED)

            log.info("demo-seed: pornit pentru cont '%s'", DEMO_USERNAME)

            ctx = _Ctx(db=db, rng=rng, fake=fake)

            # 1. Master data
            await _create_account_and_company(ctx)
            seed_started = True
            await _create_locations(ctx)
            await _create_departments(ctx)
            await _create_employees(ctx)
            await _create_tire_catalog(ctx)
            await _create_items_and_categories(ctx)
            await _create_clients(ctx)
            await _create_initial_stock(ctx)
            await db.commit()
            log.info("demo-seed: master data OK")

            # 2. Bucla de generare devize
            await _generate_receipts(ctx)
            log.info("demo-seed: receipts OK (n=%d)", ctx.counts["receipts"])

            # 3. Programari (post-pass)
            await _generate_programari(ctx)
            await db.commit()
            log.info("demo-seed: programari OK (n=%d)", ctx.counts["programari"])

            # 4. Hotel anvelope
            await _generate_tire_hotel(ctx)
            await db.commit()
            log.info("demo-seed: hotel anvelope OK (n=%d)", ctx.counts["cazari"])

            # 5. Update register counters + employee targets
            await _finalize_register_and_employees(ctx)
            await db.commit()

        duration = (datetime.now(timezone.utc) - start_ts).total_seconds()
        summary = {**ctx.counts, "duration_seconds": round(duration, 2)}
        log.info("demo-seed: COMPLET in %ss → %s", round(duration, 1), summary)
        return summary
    except Exception:
        if seed_started:
            log.exception(
                "demo-seed: ESEC dupa creearea contului — pornesc cleanup automat",
            )
            try:
                from app.services.demo_seeder.cleanup import delete_demo_account

                await delete_demo_account()
                log.info("demo-seed: cleanup automat OK dupa esec")
            except Exception:
                log.exception(
                    "demo-seed: cleanup automat a esuat — STARE CORUPTA, "
                    "sterge manual contul '%s'", DEMO_USERNAME,
                )
        raise


# ─────────────────────────── Context obiect ──────────────────────────────────


class _Ctx:
    """Context partajat intre toate sub-functiile seederului."""

    def __init__(self, db: AsyncSession, rng: random.Random, fake: Faker):
        self.db = db
        self.rng = rng
        self.fake = fake
        self.counts: dict[str, int] = {
            "receipts": 0, "receipt_items": 0, "stock_movements": 0,
            "programari": 0, "cazari": 0, "clients": 0,
        }
        self.account_id: int = 0
        self.company_id: int = 0
        self.register_id: int = 0
        # locations: list de dicts {id, name, weight, employee_ids[5], loc_cazare_ids[]}
        self.locations: list[dict] = []
        # departments: dict {name: id}
        self.departments: dict[str, int] = {}
        # items pe (location_id, dept_name) → list de dicts {id, name, price, cost_price, type, unit, stoc_minim}
        # globale (toate locatiile share aceleasi items)
        self.items_by_dept: dict[str, list[dict]] = {}
        self.all_items_by_id: dict[int, dict] = {}
        # employees: list de dicts {id, location_id, is_manager}
        self.employees: list[dict] = []
        # clients: list de dicts {id, tip, has_car, numar_masina}
        self.clients: list[dict] = []
        # stock_cache: dict[(item_id, location_id)] -> qty
        self.stock_cache: dict[tuple[int, int], int] = {}
        # serie / numar counters
        self.deviz_counter = 0
        self.factura_counter = 0
        self.chitanta_counter = 0
        # tire catalog
        self.marca_ids: list[int] = []
        self.dimensiune_ids: list[int] = []
        self.profil_id_by_name: dict[str, int] = {}


# ──────────────────────── Master data creation ───────────────────────────────


async def _create_account_and_company(ctx: _Ctx) -> None:
    acc = Account(
        name=DEMO_ACCOUNT_NAME,
        username=DEMO_USERNAME,
        password=hash_password(DEMO_PASSWORD),
        email=DEMO_EMAIL,
        is_locked=False,
    )
    ctx.db.add(acc)
    await ctx.db.flush()
    ctx.account_id = acc.id

    comp = Company(
        account_id=acc.id,
        cui=DEMO_CUI,
        name=DEMO_COMPANY_NAME,
        address="Calea Victoriei 100, Bucuresti, sector 1",
        nr_reg_com="J40/12345/2020",
        phone="021 555 0123",
        postal_code="010091",
        is_vat_payer=True,
        tva_percentage=19.0,
        bank_name="Banca Transilvania",
        iban="RO12BTRL12345678901234567",
        street="Calea Victoriei 100",
        city="Bucuresti",
        county_code="B",
    )
    ctx.db.add(comp)

    # GeneralSettings (lazy defaults)
    ctx.db.add(GeneralSettings(account_id=acc.id))

    disclaimer = Disclaimer(
        account_id=acc.id,
        title="Termeni si conditii",
        text=(
            "Va rugam pastrati bonul/devizul pentru orice reclamatie. "
            "Garantia pieselor montate este de 12 luni de la data interventiei. "
            "Service-ul nu raspunde pentru defectiuni cauzate de utilizare necorespunzatoare."
        ),
    )
    ctx.db.add(disclaimer)

    await ctx.db.flush()
    ctx.company_id = comp.id

    register = Register(
        account_id=acc.id,
        company_id=comp.id,
        name="Registru principal",
        deviz_serie="DEV",
        factura_serie="FCT",
        chitanta_serie="CHT",
    )
    ctx.db.add(register)
    await ctx.db.flush()
    ctx.register_id = register.id

    ctx._disclaimer_id = disclaimer.id  # type: ignore[attr-defined]
    ctx._company_addr_set = True  # type: ignore[attr-defined]


async def _create_locations(ctx: _Ctx) -> None:
    for loc_cfg in LOCATIONS:
        loc = Location(
            account_id=ctx.account_id,
            name=loc_cfg["name"],
            description=f"Sediu {loc_cfg['city']}",
            company_id=ctx.company_id,
            disclaimer_id=ctx._disclaimer_id,  # type: ignore[attr-defined]
            register_id=ctx.register_id,
        )
        ctx.db.add(loc)
        await ctx.db.flush()
        ctx.locations.append({
            "id": loc.id,
            "name": loc_cfg["name"],
            "weight": loc_cfg["weight"],
            "employee_ids": [],
            "loc_cazare_ids": [],
        })


async def _create_departments(ctx: _Ctx) -> None:
    for name in DEPARTMENTS:
        d = Department(account_id=ctx.account_id, name=name)
        ctx.db.add(d)
        await ctx.db.flush()
        ctx.departments[name] = d.id

        # M2M: leaga departament la toate locatiile
        for loc in ctx.locations:
            await ctx.db.execute(
                location_departments.insert().values(
                    location_id=loc["id"], department_id=d.id
                )
            )


async def _create_employees(ctx: _Ctx) -> None:
    pairs = [
        (ctx.locations[0], EMPLOYEES_CENTRU),
        (ctx.locations[1], EMPLOYEES_NORD),
    ]
    for loc, emp_list in pairs:
        for name, role in emp_list:
            e = Employee(
                account_id=ctx.account_id,
                name=name,
                description=role,
                target=Decimal("25000.00"),
            )
            ctx.db.add(e)
            await ctx.db.flush()
            loc["employee_ids"].append(e.id)
            ctx.employees.append({
                "id": e.id,
                "location_id": loc["id"],
                "is_manager": role == "Manager",
                "name": name,
            })
            await ctx.db.execute(
                employee_locations.insert().values(employee_id=e.id, location_id=loc["id"])
            )


async def _create_tire_catalog(ctx: _Ctx) -> None:
    # Marci
    for nume in TIRE_BRANDS:
        m = MarcaAnvelopa(account_id=ctx.account_id, nume=nume)
        ctx.db.add(m)
    # Dimensiuni
    for val in TIRE_SIZES:
        d = DimensiuneAnvelopa(account_id=ctx.account_id, valoare=val)
        ctx.db.add(d)
    # Profiluri
    for val in TIRE_PROFILES:
        p = ProfilAnvelopa(account_id=ctx.account_id, valoare=val)
        ctx.db.add(p)
    await ctx.db.flush()

    # Re-read IDs
    res = await ctx.db.execute(
        select(MarcaAnvelopa.id).where(MarcaAnvelopa.account_id == ctx.account_id)
    )
    ctx.marca_ids = [r[0] for r in res.all()]

    res = await ctx.db.execute(
        select(DimensiuneAnvelopa.id).where(DimensiuneAnvelopa.account_id == ctx.account_id)
    )
    ctx.dimensiune_ids = [r[0] for r in res.all()]

    res = await ctx.db.execute(
        select(ProfilAnvelopa.id, ProfilAnvelopa.valoare).where(
            ProfilAnvelopa.account_id == ctx.account_id
        )
    )
    ctx.profil_id_by_name = {row[1]: row[0] for row in res.all()}

    # Locuri cazare — un set per locatie
    for loc in ctx.locations:
        for rack in TIRE_HOTEL_RACKS:
            lc = LocCazare(
                account_id=ctx.account_id,
                nume=f"{rack} — {loc['name']}",
                description=f"Raft depozit anvelope, {loc['name']}",
            )
            ctx.db.add(lc)
            await ctx.db.flush()
            loc["loc_cazare_ids"].append(lc.id)


async def _create_items_and_categories(ctx: _Ctx) -> None:
    """Creeaza Category + Item-uri pentru fiecare divizie."""
    for dept_name, dept_id in ctx.departments.items():
        produse, servicii = items_for_department(dept_name)
        # O singura categorie cu numele divizii
        cat_name = category_name_for(dept_name, "P" if produse else "S")
        cat = Category(account_id=ctx.account_id, department_id=dept_id, name=cat_name)
        ctx.db.add(cat)
        await ctx.db.flush()

        dept_items: list[dict] = []
        for nume, pret_str in produse:
            price = Decimal(pret_str)
            cost = (price * Decimal(str(round(ctx.rng.uniform(0.55, 0.75), 2)))).quantize(Decimal("0.01"))
            stoc_min = ctx.rng.choice([5, 10, 15, 20])
            it = Item(
                account_id=ctx.account_id,
                category_id=cat.id,
                name=nume,
                price=price,
                cost_price=cost,
                unit="buc",
                type=ItemType.PRODUS,
                stoc_minim=stoc_min,
            )
            ctx.db.add(it)
            await ctx.db.flush()
            entry = {
                "id": it.id, "name": nume, "price": price, "cost_price": cost,
                "type": "P", "unit": "buc", "stoc_minim": stoc_min, "dept": dept_name,
            }
            dept_items.append(entry)
            ctx.all_items_by_id[it.id] = entry

        for nume, pret_str in servicii:
            price = Decimal(pret_str)
            it = Item(
                account_id=ctx.account_id,
                category_id=cat.id,
                name=nume,
                price=price,
                cost_price=None,
                unit="buc",
                type=ItemType.SERVICE,
                stoc_minim=0,
            )
            ctx.db.add(it)
            await ctx.db.flush()
            entry = {
                "id": it.id, "name": nume, "price": price, "cost_price": None,
                "type": "S", "unit": "buc", "stoc_minim": 0, "dept": dept_name,
            }
            dept_items.append(entry)
            ctx.all_items_by_id[it.id] = entry

        ctx.items_by_dept[dept_name] = dept_items


async def _create_clients(ctx: _Ctx) -> None:
    """Creeaza ~800 clienti (600 fizici + 200 juridici)."""
    fake = ctx.fake
    rng = ctx.rng
    new_clients: list[Client] = []

    for _ in range(N_CLIENTS_FIZICI):
        nume = fake.name()
        has_car = rng.random() < 0.75
        numar = _random_plate(rng) if has_car else None
        c = Client(
            account_id=ctx.account_id,
            tip="fizic",
            nume=nume,
            telefon="07" + str(rng.randint(10000000, 99999999)),
            email=fake.email() if rng.random() < 0.6 else None,
            adresa=fake.address().replace("\n", ", ")[:250],
            city=fake.city()[:100],
            county_code=rng.choice(COUNTY_CODES),
            numar_masina=numar,
        )
        new_clients.append(c)

    for _ in range(N_CLIENTS_JURIDICI):
        firma = fake.company()
        has_car = rng.random() < 0.95
        numar = _random_plate(rng) if has_car else None
        c = Client(
            account_id=ctx.account_id,
            tip="juridic",
            nume=firma,
            cui=str(rng.randint(10000000, 99999999)),
            reprezentant=fake.name(),
            telefon="021" + str(rng.randint(1000000, 9999999)),
            email=fake.company_email() if rng.random() < 0.8 else None,
            adresa=fake.address().replace("\n", ", ")[:250],
            city=fake.city()[:100],
            county_code=rng.choice(COUNTY_CODES),
            numar_masina=numar,
        )
        new_clients.append(c)

    ctx.db.add_all(new_clients)
    await ctx.db.flush()

    for c in new_clients:
        ctx.clients.append({
            "id": c.id,
            "tip": c.tip,
            "has_car": c.numar_masina is not None,
            "numar_masina": c.numar_masina,
        })
    ctx.counts["clients"] = len(new_clients)


def _random_plate(rng: random.Random) -> str:
    judet = rng.choice(COUNTY_CODES)
    if judet == "B":
        return f"B-{rng.randint(10,999)}-{_rand_letters(rng, 3)}"
    return f"{judet}-{rng.randint(10,99)}-{_rand_letters(rng, 3)}"


def _rand_letters(rng: random.Random, n: int) -> str:
    import string
    return "".join(rng.choices(string.ascii_uppercase, k=n))


# ──────────────────── Stock initial + restock lunar ─────────────────────────


async def _create_initial_stock(ctx: _Ctx) -> None:
    """Genereaza stoc initial pentru toate produsele × locatii (PURCHASE la INITIAL_STOCK_DATE)."""
    stock_rows: list[dict] = []
    movement_rows: list[dict] = []
    ts = datetime.combine(INITIAL_STOCK_DATE, datetime.min.time()).replace(tzinfo=timezone.utc)

    for it_id, it in ctx.all_items_by_id.items():
        if it["type"] != "P":
            continue
        for loc in ctx.locations:
            qty = ctx.rng.randint(20, 100)
            ctx.stock_cache[(it_id, loc["id"])] = qty
            stock_rows.append({
                "account_id": ctx.account_id,
                "item_id": it_id,
                "location_id": loc["id"],
                "qty": qty,
                "updated_at": ts,
            })
            movement_rows.append({
                "account_id": ctx.account_id,
                "item_id": it_id,
                "item_name": it["name"],
                "location_id": loc["id"],
                "employee_id": None,
                "receipt_id": None,
                "movement_type": StockMovementType.PURCHASE,
                "qty_delta": qty,
                "unit_cost": it["cost_price"],
                "unit_price": it["price"],
                "note": "Stoc initial demo seeder",
                "created_at": ts,
                "created_by_user": "demo-seeder",
            })

    chunk = 1000
    if stock_rows:
        for i in range(0, len(stock_rows), chunk):
            await ctx.db.execute(insert(Stock), stock_rows[i:i+chunk])
    if movement_rows:
        for i in range(0, len(movement_rows), chunk):
            await ctx.db.execute(insert(StockMovement), movement_rows[i:i+chunk])
    ctx.counts["stock_movements"] += len(movement_rows)


async def _monthly_restock(ctx: _Ctx, when: date) -> None:
    """Re-aprovizionare lunara: pentru itemi cu stoc < stoc_minim*1.5 cumpara 50 unitati."""
    movement_rows: list[dict] = []
    ts = datetime.combine(when, datetime.min.time().replace(hour=8)).replace(tzinfo=timezone.utc)

    for (it_id, loc_id), qty in list(ctx.stock_cache.items()):
        it = ctx.all_items_by_id[it_id]
        threshold = max(int(it["stoc_minim"] * 1.5), 5)
        if qty < threshold:
            add = 50
            ctx.stock_cache[(it_id, loc_id)] = qty + add
            movement_rows.append({
                "account_id": ctx.account_id,
                "item_id": it_id,
                "item_name": it["name"],
                "location_id": loc_id,
                "employee_id": None,
                "receipt_id": None,
                "movement_type": StockMovementType.PURCHASE,
                "qty_delta": add,
                "unit_cost": it["cost_price"],
                "unit_price": it["price"],
                "note": f"Aprovizionare {when.isoformat()}",
                "created_at": ts,
                "created_by_user": "demo-seeder",
            })

    if movement_rows:
        chunk = 1000
        for i in range(0, len(movement_rows), chunk):
            await ctx.db.execute(insert(StockMovement), movement_rows[i:i+chunk])
        ctx.counts["stock_movements"] += len(movement_rows)


# ────────────────────── Generare devize (CORE) ──────────────────────────────


async def _generate_receipts(ctx: _Ctx) -> None:
    """Bucla principala: pentru fiecare zi din interval, genereaza N devize."""
    rng = ctx.rng

    loc_choices = [loc["id"] for loc in ctx.locations]
    loc_weights = [loc["weight"] for loc in ctx.locations]
    loc_by_id = {loc["id"]: loc for loc in ctx.locations}
    employees_by_loc: dict[int, list[int]] = {
        loc["id"]: loc["employee_ids"] for loc in ctx.locations
    }
    clients_by_id: dict[int, dict] = {c["id"]: c for c in ctx.clients}

    total_days = (DATE_END - DATE_START).days + 1
    days_processed = 0
    last_month: tuple[int, int] = (-1, -1)
    daily_receipt_count_for_emp: dict[int, Decimal] = {}  # luna curenta accumulation
    today_real = date.today()

    # Pentru employee_target_accumulation, trebuie sa stim ce e "luna curenta" relativ la DATE_END
    # Vom calcula pe baza receipt-urilor care apar in luna ce contine DATE_END
    target_month_start = date(DATE_END.year, DATE_END.month, 1)

    cur_day = DATE_START
    pending_receipts: list[dict] = []   # acumulator pentru a face commit la batch
    pending_items: list[dict] = []
    pending_vehicole: list[dict] = []
    pending_movements: list[dict] = []
    receipt_objs_pending: list[Receipt] = []

    while cur_day <= DATE_END:
        # Restock lunar (in prima zi a lunii noi)
        if (cur_day.year, cur_day.month) != last_month:
            if last_month != (-1, -1):
                await _monthly_restock(ctx, cur_day)
            last_month = (cur_day.year, cur_day.month)

        n = receipts_for_day(cur_day, AVG_RECEIPTS_PER_DAY, rng)
        dept_weights = pick_department_weights(cur_day, DEPT_WEIGHTS)
        dept_names = list(dept_weights.keys())
        dept_probs = list(dept_weights.values())

        for _ in range(n):
            loc_id = rng.choices(loc_choices, weights=loc_weights, k=1)[0]
            loc = loc_by_id[loc_id]
            dept_name = rng.choices(dept_names, weights=dept_probs, k=1)[0]
            emp_id = rng.choice(employees_by_loc[loc_id])

            # client: 60% existing, 40% none (walk-in fara client_id)
            client_id: int | None = None
            client_has_car = False
            client_numar = None
            if rng.random() < 0.85:  # 85% au client asignat
                cl = rng.choice(ctx.clients)
                client_id = cl["id"]
                client_has_car = cl["has_car"]
                client_numar = cl["numar_masina"]

            # Daca clientul nu are masina dar dept-ul cere masina, generam o masina ad-hoc
            needs_car = dept_name != "Spalatorie Auto" or rng.random() < 0.85
            numar_masina = client_numar
            if needs_car and not numar_masina:
                numar_masina = _random_plate(rng)

            # Linii deviz: alegem 1-4 itemi din departament
            dept_items = ctx.items_by_dept[dept_name]
            k = rng.randint(1, min(4, len(dept_items)))
            picked = rng.sample(dept_items, k)

            line_specs: list[tuple[dict, int]] = []  # (item_dict, qty)
            for it in picked:
                qty = 1
                if it["type"] == "P":
                    qty = rng.choices([1, 2, 4], weights=[0.55, 0.20, 0.25], k=1)[0]
                line_specs.append((it, qty))

            total = sum((it["price"] * Decimal(qty) for it, qty in line_specs), Decimal("0"))

            # Plata
            r = rng.random()
            if r < PAY_METHOD_SPLIT["PLATIT_RATE"]:
                # esto platit — alege metoda
                m = rng.random()
                if m < PAY_METHOD_SPLIT["CARD_RATE"]:
                    pay_method = PayMethod.CARD
                elif m < PAY_METHOD_SPLIT["CARD_RATE"] + PAY_METHOD_SPLIT["CASH_RATE"]:
                    pay_method = PayMethod.CASH
                else:
                    pay_method = PayMethod.OP
                partial_pay = None
            elif r < PAY_METHOD_SPLIT["PLATIT_RATE"] + PAY_METHOD_SPLIT["PARTIAL_RATE"]:
                pay_method = PayMethod.PARTIAL
                partial_pay = (total * Decimal("0.5")).quantize(Decimal("0.01"))
            else:
                pay_method = PayMethod.NEPLATIT
                partial_pay = None

            # Numerotare
            ctx.deviz_counter += 1
            factura_serie = ""
            factura_nr = 0
            chitanta_serie = ""
            chitanta_nr = 0
            if pay_method != PayMethod.NEPLATIT and client_id is not None:
                # Verificam daca clientul e juridic → factura
                cl_data = clients_by_id.get(client_id)
                if cl_data and cl_data["tip"] == "juridic":
                    ctx.factura_counter += 1
                    factura_serie = "FCT"
                    factura_nr = ctx.factura_counter
            if pay_method == PayMethod.CASH:
                ctx.chitanta_counter += 1
                chitanta_serie = "CHT"
                chitanta_nr = ctx.chitanta_counter

            # Ora la care s-a creat receipt-ul: 09:00-18:00
            hour = rng.randint(9, 17)
            minute = rng.randint(0, 59)
            created_at = datetime.combine(cur_day, datetime.min.time()).replace(
                hour=hour, minute=minute, tzinfo=timezone.utc
            )

            tax_excl = (total / Decimal("1.19")).quantize(Decimal("0.01"))
            tax_total = (total - tax_excl).quantize(Decimal("0.01"))

            receipt = Receipt(
                account_id=ctx.account_id,
                titlu=f"{dept_name}" + (f" - {numar_masina}" if numar_masina else ""),
                descriere=f"Lucrare {dept_name.lower()} la sediul {loc['name']}",
                total=total,
                pay_method=pay_method,
                partial_pay=partial_pay,
                client_id=client_id,
                deviz_serie="DEV",
                deviz_nr=ctx.deviz_counter,
                factura_serie=factura_serie,
                factura_nr=factura_nr,
                chitanta_serie=chitanta_serie,
                chitanta_nr=chitanta_nr,
                location_id=loc_id,
                currency="RON",
                tax_exclusive_total=tax_excl,
                tax_total=tax_total,
                created_at=created_at,
            )
            ctx.db.add(receipt)
            receipt_objs_pending.append(receipt)

            # Stoc decrement + StockMovement pentru produse platite
            for it, qty in line_specs:
                if it["type"] == "P" and pay_method != PayMethod.NEPLATIT:
                    key = (it["id"], loc_id)
                    cur_qty = ctx.stock_cache.get(key, 0)
                    new_qty = cur_qty - qty
                    ctx.stock_cache[key] = new_qty
                    pending_movements.append({
                        "account_id": ctx.account_id,
                        "item_id": it["id"],
                        "item_name": it["name"],
                        "location_id": loc_id,
                        "employee_id": emp_id,
                        # receipt_id va fi completat dupa flush
                        "_receipt_idx": len(receipt_objs_pending) - 1,
                        "movement_type": StockMovementType.SALE,
                        "qty_delta": -qty,
                        "unit_cost": it["cost_price"],
                        "unit_price": it["price"],
                        "note": None,
                        "created_at": created_at,
                        "created_by_user": "demo-seeder",
                    })

            # Acumulam items_data si vehicol pentru post-flush
            pending_receipts.append({
                "_idx": len(receipt_objs_pending) - 1,
                "line_specs": line_specs,
                "emp_id": emp_id,
                "loc_id": loc_id,
                "created_at": created_at,
                "numar_masina": numar_masina,
                "client_id": client_id,
                "total": total,
                "in_target_month": cur_day >= target_month_start and cur_day <= DATE_END,
            })

            if pay_method != PayMethod.NEPLATIT:
                if pending_receipts[-1]["in_target_month"]:
                    daily_receipt_count_for_emp[emp_id] = (
                        daily_receipt_count_for_emp.get(emp_id, Decimal("0")) + total
                    )

        # Daca am acumulat suficient → flush + bulk inserts
        if len(receipt_objs_pending) >= COMMIT_BATCH_SIZE:
            await _flush_receipts_batch(
                ctx, receipt_objs_pending, pending_receipts, pending_movements
            )
            receipt_objs_pending.clear()
            pending_receipts.clear()
            pending_movements.clear()
            await ctx.db.commit()

        days_processed += 1
        if days_processed % RECEIPTS_REPORT_EVERY_DAYS == 0:
            log.info(
                "demo-seed: %d/%d zile (%.0f%%), %d receipts",
                days_processed, total_days, 100 * days_processed / total_days,
                ctx.counts["receipts"] + len(receipt_objs_pending),
            )

        cur_day += timedelta(days=1)

    # Flush rest
    if receipt_objs_pending:
        await _flush_receipts_batch(
            ctx, receipt_objs_pending, pending_receipts, pending_movements
        )
        await ctx.db.commit()

    # Update Stock cu cantitatile curente
    await _persist_stock_cache(ctx)
    await ctx.db.commit()

    ctx._employee_target_accumulation = daily_receipt_count_for_emp  # type: ignore[attr-defined]


async def _flush_receipts_batch(
    ctx: _Ctx,
    receipts: list[Receipt],
    pending: list[dict],
    movements: list[dict],
) -> None:
    """Flush Receipt-urile (pentru ID-uri), apoi bulk insert items + vehicole + movements."""
    if not receipts:
        return
    await ctx.db.flush()  # populeaza receipts.id

    receipt_items: list[dict] = []
    vehicole: list[dict] = []

    for p in pending:
        receipt = receipts[p["_idx"]]
        for it, qty in p["line_specs"]:
            receipt_items.append({
                "receipt_id": receipt.id,
                "account_id": ctx.account_id,
                "employee_id": p["emp_id"],
                "item_id": it["id"],
                "item_type": ItemType.PRODUS if it["type"] == "P" else ItemType.SERVICE,
                "name": it["name"],
                "price": it["price"],
                "qty": qty,
                "unit": it["unit"],
                "vat_category": "S",
                "vat_percent": Decimal("19.00"),
            })
        if p["numar_masina"]:
            # ~ 60% din receipt-urile cu numar_masina genereaza si Vehicol
            if ctx.rng.random() < 0.6:
                car_brand, models = ctx.rng.choice(CAR_BRANDS)
                vehicole.append({
                    "account_id": ctx.account_id,
                    "receipt_id": receipt.id,
                    "numar_masina": p["numar_masina"],
                    "marca": car_brand,
                    "model": ctx.rng.choice(models),
                    "numar_kilometrii": ctx.rng.randint(20000, 280000),
                    "vin": None,
                    "observatii": None,
                })

    # Update movement receipt_ids
    for m in movements:
        idx = m.pop("_receipt_idx")
        m["receipt_id"] = receipts[idx].id

    chunk_size = 1000
    if receipt_items:
        for i in range(0, len(receipt_items), chunk_size):
            await ctx.db.execute(insert(ReceiptItem), receipt_items[i:i+chunk_size])
        ctx.counts["receipt_items"] += len(receipt_items)
    if vehicole:
        for i in range(0, len(vehicole), chunk_size):
            await ctx.db.execute(insert(Vehicol), vehicole[i:i+chunk_size])
    if movements:
        for i in range(0, len(movements), chunk_size):
            await ctx.db.execute(insert(StockMovement), movements[i:i+chunk_size])
        ctx.counts["stock_movements"] += len(movements)

    ctx.counts["receipts"] += len(receipts)


async def _persist_stock_cache(ctx: _Ctx) -> None:
    """Updateaza stocurile curente in DB pe baza dictului stock_cache."""
    ts = datetime.now(timezone.utc)
    # Construim un map din DB pentru a sti id-urile existente
    res = await ctx.db.execute(
        select(Stock.id, Stock.item_id, Stock.location_id).where(
            Stock.account_id == ctx.account_id
        )
    )
    db_map: dict[tuple[int, int], int] = {(row.item_id, row.location_id): row.id for row in res.all()}

    updates: list[dict] = []
    for (it_id, loc_id), qty in ctx.stock_cache.items():
        stock_id = db_map.get((it_id, loc_id))
        if stock_id is None:
            continue
        updates.append({"b_id": stock_id, "b_qty": qty, "b_ts": ts})

    if updates:
        # Folosim text() raw pentru a evita ORM bulk UPDATE by PK code path
        stmt = text("UPDATE stocks SET qty = :b_qty, updated_at = :b_ts WHERE id = :b_id")
        chunk = 1000
        for i in range(0, len(updates), chunk):
            await ctx.db.execute(stmt, updates[i:i+chunk])


# ────────────────────── Programari (post-pass) ──────────────────────────────


async def _generate_programari(ctx: _Ctx) -> None:
    """15% din receipt-urile EXECUTAT genereaza o programare istorica + 30-50 viitoare."""
    rng = ctx.rng

    res = await ctx.db.execute(
        select(Receipt.id, Receipt.client_id, Receipt.location_id, Receipt.created_at,
               Receipt.titlu, Receipt.pay_method)
        .where(Receipt.account_id == ctx.account_id)
    )
    receipts = list(res.all())

    # Sample 15%
    n_pick = int(len(receipts) * 0.15)
    picked = rng.sample(receipts, n_pick)

    rows: list[dict] = []
    dept_ids = list(ctx.departments.values())

    for r in picked:
        created_at = r.created_at
        offset_days = rng.randint(0, 3)
        start = created_at - timedelta(days=offset_days, hours=rng.randint(0, 4))
        end = start + timedelta(hours=rng.randint(1, 3))

        # Status mix: 88% executat, 8% anulat, 4% in lucru
        s = rng.random()
        if s < 0.88:
            status_val = ProgramareStatus.EXECUTAT
        elif s < 0.96:
            status_val = ProgramareStatus.ANULAT
        else:
            status_val = ProgramareStatus.IN_LUCRU

        rows.append({
            "account_id": ctx.account_id,
            "titlu": r.titlu[:200],
            "notite": "Programare retroactiva pe deviz",
            "client_id": r.client_id,
            "location_id": r.location_id,
            "department_id": rng.choice(dept_ids),
            "start_time": start,
            "end_time": end,
            "status": status_val,
        })

    # Programari viitoare (dupa DATE_END, ~30-50)
    for i in range(rng.randint(30, 50)):
        future_offset = rng.randint(1, 30)
        loc = rng.choice(ctx.locations)
        start = datetime.combine(DATE_END + timedelta(days=future_offset),
                                  datetime.min.time().replace(hour=rng.randint(9, 16)),
                                  ).replace(tzinfo=timezone.utc)
        end = start + timedelta(hours=rng.randint(1, 3))
        client = rng.choice(ctx.clients)
        rows.append({
            "account_id": ctx.account_id,
            "titlu": f"Programare viitoare #{i+1}",
            "notite": None,
            "client_id": client["id"],
            "location_id": loc["id"],
            "department_id": rng.choice(dept_ids),
            "start_time": start,
            "end_time": end,
            "status": ProgramareStatus.PROGRAMAT,
        })

    if rows:
        # batch in chunks de 500 pentru a evita parametri Postgres > 32767
        chunk_size = 500
        for i in range(0, len(rows), chunk_size):
            await ctx.db.execute(insert(Programare), rows[i:i+chunk_size])
        ctx.counts["programari"] = len(rows)


# ───────────────────── Hotel anvelope (post-pass) ───────────────────────────


async def _generate_tire_hotel(ctx: _Ctx) -> None:
    """Genereaza cicluri vara/iarna pentru ~10% din clienti cu masina."""
    rng = ctx.rng

    eligible = [c for c in ctx.clients if c["has_car"]]
    n = max(1, int(len(eligible) * TIRE_HOTEL_CLIENT_RATIO))
    picked_clients = rng.sample(eligible, min(n, len(eligible)))

    cazare_rows: list[CazareAnvelope] = []
    item_rows: list[dict] = []
    anvelopa_rows: list[Anvelopa] = []

    for cl in picked_clients:
        loc = rng.choice(ctx.locations)
        rack_id = rng.choice(loc["loc_cazare_ids"])
        emp_id = rng.choice(loc["employee_ids"])
        # Marca anvelopa fixa pentru client (toate ciclurile)
        marca_id = rng.choice(ctx.marca_ids)
        dimensiune_id = rng.choice(ctx.dimensiune_ids)

        previous_cazare: CazareAnvelope | None = None
        cazari_for_client: list[CazareAnvelope] = []

        for cycle in TIRE_HOTEL_CYCLES:
            (
                cin_yoff, cin_m, cin_d,
                cout_yoff, cout_m, cout_d,
                stored_season,
            ) = cycle
            cin_year = DATE_START.year + cin_yoff
            cout_year = DATE_START.year + cout_yoff
            try:
                checkin = date(cin_year, cin_m, cin_d)
                checkout = date(cout_year, cout_m, cout_d)
            except ValueError:
                continue
            # Pastreaza doar daca checkin e in interval
            if checkin > DATE_END:
                continue
            # Daca checkout > DATE_END, cazarea e inca activa
            if checkout > DATE_END:
                checkout_db = None
            else:
                checkout_db = checkout

            tip_anv = TipAnvelopa.VARA if stored_season == "vara" else TipAnvelopa.IARNA
            profil_name = "Vara" if stored_season == "vara" else "Iarna"
            profil_id = ctx.profil_id_by_name.get(profil_name)

            caz = CazareAnvelope(
                account_id=ctx.account_id,
                client_id=cl["id"],
                employee_id=emp_id,
                loc_cazare_id=rack_id,
                location_id=loc["id"],
                data_checkin=checkin,
                data_checkout=checkout_db,
                dep_anvelope=True,
                dep_capace=rng.random() < 0.4,
                dep_antifurturi=rng.random() < 0.2,
                dep_prezoane=rng.random() < 0.3,
                numar_masina=cl["numar_masina"],
                montate_pe_masina=False,
                referinta_cazare_id=previous_cazare.id if previous_cazare else None,
                comments=f"Anvelope {stored_season}",
            )
            ctx.db.add(caz)
            await ctx.db.flush()

            # 4 anvelope pentru aceasta cazare
            for _ in range(4):
                anv = Anvelopa(
                    account_id=ctx.account_id,
                    client_id=cl["id"],
                    marca_id=marca_id,
                    dimensiune_id=dimensiune_id,
                    profil_id=profil_id,
                    tip=tip_anv,
                    adancime=round(rng.uniform(4.0, 8.0), 1),
                )
                ctx.db.add(anv)
                await ctx.db.flush()
                item_rows.append({
                    "account_id": ctx.account_id,
                    "cazare_id": caz.id,
                    "anvelopa_id": anv.id,
                })

            previous_cazare = caz
            cazari_for_client.append(caz)

        ctx.counts["cazari"] += len(cazari_for_client)

    if item_rows:
        chunk = 500
        for i in range(0, len(item_rows), chunk):
            await ctx.db.execute(insert(CazareAnvelopaItem), item_rows[i:i+chunk])


# ───────────────────── Finalize (register + employee target) ───────────────


async def _finalize_register_and_employees(ctx: _Ctx) -> None:
    """Update Register counters + employee.current_target_accumulation."""
    await ctx.db.execute(
        update(Register)
        .where(Register.id == ctx.register_id)
        .values(
            deviz_numar=ctx.deviz_counter,
            factura_numar=ctx.factura_counter,
            chitanta_numar=ctx.chitanta_counter,
        )
    )

    accum = getattr(ctx, "_employee_target_accumulation", {})
    for emp_id, total in accum.items():
        await ctx.db.execute(
            update(Employee)
            .where(Employee.id == emp_id)
            .values(current_target_accumulation=total.quantize(Decimal("0.01")))
        )
