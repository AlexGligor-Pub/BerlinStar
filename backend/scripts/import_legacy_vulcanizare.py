"""Import legacy BerlinV3 (SQL Server) data into BerlinStar (Postgres) as a new Account.

Usage
-----
    cd backend
    # 1. Convert UTF-16LE dump to UTF-8 (one-time):
    iconv -f UTF-16LE -t UTF-8 ../work/VulcanizareAlexDEVA_16Mai2026.sql \\
          > /tmp/dump_utf8.sql

    # 2. Dry run (parses everything, inserts nothing):
    python -m scripts.import_legacy_vulcanizare \\
          --dump /tmp/dump_utf8.sql \\
          --username alex-vulcanizare \\
          --password secret123 \\
          --account-name "Vulcanizare Alex" \\
          --dry-run

    # 3. Real run:
    python -m scripts.import_legacy_vulcanizare \\
          --dump /tmp/dump_utf8.sql \\
          --username alex-vulcanizare \\
          --password secret123 \\
          --account-name "Vulcanizare Alex"

The script is idempotent at the Account level: if `username` already exists
the script aborts with exit code 2. To retry, delete the account first
(`DELETE FROM accounts WHERE username = 'X'` cascades through FKs).

Reusability
-----------
This script is intentionally written to be reused for any future BerlinV3
dump. The mapping rules below are encoded directly in the phase functions.
For a different legacy schema, copy this file and adjust the phases — the
parser (`scripts._mssql_dump_parser`) is fully generic.

Phases
------
  0. Create Account (one row).
  1. Reference data: Companies, Sites→Locations, Users→Employees,
     Divisions→Departments, ServiceTypes→Categories, Service→Items,
     Devices.
  2. Junctions: SiteUser→employee_locations, SiteDivision→location_departments.
  3. Clients: CompanyDetails deduped by CIF → Client (only B2B rows).
  4. Receipts: Receipt → receipts + vehicole (batched 1000/commit, license
     plate extracted into Vehicol).
  5. Receipt items: SelledServices → receipt_items (batched 5000/commit).

Skipped tables (per requirements / empty in source):
  Devize, Invoices, Bills, BillDetails, Products, ProductHistory,
  ProductService, ProductSite, SelledServiceManual, CheckInData, Vehicul,
  FDL, FDL_Constatare, FDL_SelledService, FDL_SelledServiceManual,
  AppUsers, SystemUsers, __EFMigrationsHistory.
"""
from __future__ import annotations

import argparse
import asyncio
import logging
import re
import sys
from collections import defaultdict
from datetime import datetime, timezone
from decimal import Decimal
from itertools import islice
from pathlib import Path
from typing import Iterable, Iterator
from zoneinfo import ZoneInfo

from sqlalchemy import select, insert

# Make `app` importable when run as `python -m scripts.import_legacy_vulcanizare`
# from inside the backend directory.
THIS_DIR = Path(__file__).resolve().parent
BACKEND_DIR = THIS_DIR.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.database import AsyncSessionLocal  # noqa: E402
from app.models.account import Account  # noqa: E402
from app.models.category import Category  # noqa: E402
from app.models.client import Client  # noqa: E402
from app.models.company import Company  # noqa: E402
from app.models.department import Department  # noqa: E402
from app.models.device import Device  # noqa: E402
from app.models.employee import Employee  # noqa: E402
from app.models.item import Item, ItemType  # noqa: E402
from app.models.location import Location, employee_locations, location_departments  # noqa: E402
from app.models.receipt import Receipt, ReceiptItem, PayMethod  # noqa: E402
from app.models.vehicol import Vehicol  # noqa: E402
from app.utils.security import hash_password  # noqa: E402

from scripts._mssql_dump_parser import parse_inserts, list_tables  # noqa: E402


log = logging.getLogger("import_legacy")


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

ROMANIA_TZ = ZoneInfo("Europe/Bucharest")
EPOCH_FALLBACK = datetime(1, 1, 1, 0, 0, 0)  # SQL Server "0001-01-01" → drop, use None

# PayMethod int → enum mapping (validated against
# work/Berlin_cpy/Berlin.Domain/Entities/Enums/PayMethod.cs):
# 0=NotPayed, 1=Cash, 2=Card, 3=OP, 4=Other.
# "Other" has no equivalent in the new schema; map to CASH (most likely actual
# payment method for a tire shop) and preserve original code in descriere.
PAY_METHOD_MAP: dict[int, PayMethod] = {
    0: PayMethod.NEPLATIT,
    1: PayMethod.CASH,
    2: PayMethod.CARD,
    3: PayMethod.OP,
    4: PayMethod.CASH,  # legacy "Other" → CASH (annotated in descriere)
}

# Romanian license plate format: 1-2 letter county + 2-3 digits + 3 letters.
# Examples: HD12FAA, B12ABC, B123ABC, TM01ABC.
LICENSE_PLATE_RE = re.compile(r"^[A-Z]{1,2}\s?\d{1,3}\s?[A-Z]{3}$")

RECEIPT_BATCH = 1000
ITEM_BATCH = 5000


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _aware(dt: datetime | None) -> datetime | None:
    """Attach Europe/Bucharest tz to naive datetime; drop 0001-01-01 sentinels."""
    if dt is None:
        return None
    if dt.year < 1900:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=ROMANIA_TZ)
    return dt


def _str_or_none(s: object) -> str | None:
    if s is None:
        return None
    s2 = str(s).strip()
    return s2 if s2 else None


def _decimal(v: object, default: str = "0") -> Decimal:
    if v is None:
        return Decimal(default)
    if isinstance(v, Decimal):
        return v
    return Decimal(str(v))


def _is_soft_deleted(row: dict) -> bool:
    return bool(row.get("IsDeleted") or 0)


def batched(it: Iterable, n: int) -> Iterator[list]:
    """Yield successive n-sized chunks from iterable."""
    iterator = iter(it)
    while True:
        chunk = list(islice(iterator, n))
        if not chunk:
            break
        yield chunk


def _normalize_license_plate(s: str | None) -> str | None:
    """Return canonical plate (no spaces, upper) or None if not a plate."""
    if not s:
        return None
    candidate = s.strip().replace(" ", "").upper()
    if LICENSE_PLATE_RE.match(candidate.replace("", "")):
        return candidate
    # Try original — sometimes plates have spaces (HD 12 FAA)
    candidate2 = s.strip().upper()
    if LICENSE_PLATE_RE.match(candidate2):
        return candidate.replace(" ", "")
    return None


# ---------------------------------------------------------------------------
# Phase 0 — Account
# ---------------------------------------------------------------------------

async def create_account(session, username: str, password: str, account_name: str) -> int:
    """Create the new Account; abort if username already exists."""
    existing = (await session.execute(
        select(Account).where(Account.username == username)
    )).scalar_one_or_none()
    if existing is not None:
        raise SystemExit(
            f"[FATAL] Account with username '{username}' already exists "
            f"(id={existing.id}). Delete it first to retry."
        )
    account = Account(
        username=username,
        password=hash_password(password),
        name=account_name,
        email=None,
    )
    session.add(account)
    await session.flush()
    log.info("Created Account id=%s username=%s", account.id, account.username)
    return account.id


# ---------------------------------------------------------------------------
# Phase 1 — Reference data
# ---------------------------------------------------------------------------

async def import_companies(session, dump: Path, account_id: int, id_map: dict) -> None:
    for row in parse_inserts(dump, "Companies"):
        cui_raw = _str_or_none(row.get("CIF"))
        try:
            cui = int(cui_raw) if cui_raw else 0
        except ValueError:
            cui = 0
        company = Company(
            account_id=account_id,
            cui=cui,
            name=(_str_or_none(row.get("Title")) or "Companie fara nume")[:300],
            address=_str_or_none(row.get("Address")),
            nr_reg_com=_str_or_none(row.get("RegCom")),
            phone=_str_or_none(row.get("Phone")),
            email=_str_or_none(row.get("Email")),
            tva_percentage=float(row.get("TVA") or 0) or None,
            bank_name=_str_or_none(row.get("Bank")) if _str_or_none(row.get("Bank")) != "-" else None,
            iban=_str_or_none(row.get("IBAN")) if _str_or_none(row.get("IBAN")) != "-" else None,
            capital_social=_to_float_or_none(row.get("SocialCapital")),
            comments=_str_or_none(row.get("Comments")),
            created_at=_aware(row.get("CreateDate")) or datetime.now(timezone.utc),
            updated_at=_aware(row.get("UpdateDate")),
            is_deleted=_is_soft_deleted(row),
        )
        session.add(company)
        await session.flush()
        id_map["company"][row["Id"]] = company.id
    log.info("Phase 1: imported %d companies", len(id_map["company"]))


def _to_float_or_none(v) -> float | None:
    if v is None:
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


async def import_locations(session, dump: Path, account_id: int, id_map: dict) -> None:
    for row in parse_inserts(dump, "Sites"):
        loc = Location(
            account_id=account_id,
            name=(_str_or_none(row.get("Title")) or "Locatie")[:200],
            description=_str_or_none(row.get("Description")),
            company_id=id_map["company"].get(row.get("CompanyId")),
            created_at=_aware(row.get("CreateDate")) or datetime.now(timezone.utc),
            updated_at=_aware(row.get("UpdateDate")),
            is_deleted=_is_soft_deleted(row),
        )
        session.add(loc)
        await session.flush()
        id_map["location"][row["Id"]] = loc.id
    log.info("Phase 1: imported %d locations", len(id_map["location"]))


async def import_employees(session, dump: Path, account_id: int, id_map: dict) -> None:
    for row in parse_inserts(dump, "Users"):
        emp = Employee(
            account_id=account_id,
            name=(_str_or_none(row.get("Title")) or "Angajat")[:200],
            description=_str_or_none(row.get("Description")),
            image_path=_str_or_none(row.get("ImageUrl")),
            target=_decimal(row.get("Target"), default="25000"),
            created_at=_aware(row.get("CreateDate")) or datetime.now(timezone.utc),
            updated_at=_aware(row.get("UpdateDate")),
            is_deleted=_is_soft_deleted(row),
        )
        session.add(emp)
        await session.flush()
        id_map["employee"][row["Id"]] = emp.id
    log.info("Phase 1: imported %d employees", len(id_map["employee"]))


async def import_departments(session, dump: Path, account_id: int, id_map: dict) -> None:
    for row in parse_inserts(dump, "Divisions"):
        dept = Department(
            account_id=account_id,
            name=(_str_or_none(row.get("Title")) or "Departament")[:100],
            description=_str_or_none(row.get("Description")),
            image_path=_str_or_none(row.get("ImageUrl")),
            created_at=_aware(row.get("CreateDate")) or datetime.now(timezone.utc),
            updated_at=_aware(row.get("UpdateDate")),
            is_deleted=_is_soft_deleted(row),
        )
        session.add(dept)
        await session.flush()
        id_map["department"][row["Id"]] = dept.id
    log.info("Phase 1: imported %d departments", len(id_map["department"]))


async def import_categories(session, dump: Path, account_id: int, id_map: dict) -> None:
    for row in parse_inserts(dump, "ServiceTypes"):
        dep_id = id_map["department"].get(row.get("DevisionId"))
        if dep_id is None:
            log.warning("ServiceType %s skipped: parent Division %s missing",
                        row.get("Id"), row.get("DevisionId"))
            continue
        cat = Category(
            account_id=account_id,
            name=(_str_or_none(row.get("Title")) or "Categorie")[:100],
            image_path=_str_or_none(row.get("ImageUrl")),
            department_id=dep_id,
            created_at=_aware(row.get("CreateDate")) or datetime.now(timezone.utc),
            updated_at=_aware(row.get("UpdateDate")),
            is_deleted=_is_soft_deleted(row),
        )
        session.add(cat)
        await session.flush()
        id_map["category"][row["Id"]] = cat.id
    log.info("Phase 1: imported %d categories", len(id_map["category"]))


async def import_items(session, dump: Path, account_id: int, id_map: dict) -> None:
    """Map legacy Service → Item (type=SERVICE). Also remember Service.UM for
    later use when creating ReceiptItems."""
    service_unit: dict[int, str] = {}
    for row in parse_inserts(dump, "Service"):
        cat_id = id_map["category"].get(row.get("ServiceTypeId"))
        if cat_id is None:
            log.warning("Service %s skipped: parent ServiceType %s missing",
                        row.get("Id"), row.get("ServiceTypeId"))
            continue
        unit = _str_or_none(row.get("UM")) or "buc"
        service_unit[row["Id"]] = unit
        item = Item(
            account_id=account_id,
            name=(_str_or_none(row.get("Title")) or "Serviciu")[:200],
            description=_str_or_none(row.get("Description")),
            price=_decimal(row.get("Price")),
            unit=unit[:50],
            currency="RON",
            image_path=_str_or_none(row.get("ImageUrl")),
            type=ItemType.SERVICE,
            category_id=cat_id,
            created_at=_aware(row.get("CreateDate")) or datetime.now(timezone.utc),
            updated_at=_aware(row.get("UpdateDate")),
            is_deleted=_is_soft_deleted(row),
        )
        session.add(item)
        await session.flush()
        id_map["item"][row["Id"]] = item.id
    id_map["_service_unit"] = service_unit  # cached for Phase 5
    log.info("Phase 1: imported %d items (services)", len(id_map["item"]))


async def import_devices(session, dump: Path, account_id: int, id_map: dict) -> None:
    for row in parse_inserts(dump, "Devices"):
        loc_id = id_map["location"].get(row.get("SiteId"))
        if loc_id is None:
            log.warning("Device %s skipped: site %s missing", row.get("Id"), row.get("SiteId"))
            continue
        dev = Device(
            account_id=account_id,
            name=(_str_or_none(row.get("Title")) or "Device")[:200],
            location_id=loc_id,
            created_at=_aware(row.get("CreateDate")) or datetime.now(timezone.utc),
        )
        session.add(dev)
        await session.flush()
        id_map["device"][row["Id"]] = dev.id
    log.info("Phase 1: imported %d devices", len(id_map["device"]))


# ---------------------------------------------------------------------------
# Phase 2 — Junctions
# ---------------------------------------------------------------------------

async def import_junctions(session, dump: Path, id_map: dict) -> None:
    # SiteUser → employee_locations
    pairs_eu: set[tuple[int, int]] = set()
    for row in parse_inserts(dump, "SiteUser"):
        emp_id = id_map["employee"].get(row.get("UserId"))
        loc_id = id_map["location"].get(row.get("SiteId"))
        if emp_id and loc_id:
            pairs_eu.add((emp_id, loc_id))
    for emp_id, loc_id in pairs_eu:
        await session.execute(
            employee_locations.insert().values(employee_id=emp_id, location_id=loc_id)
        )
    log.info("Phase 2: linked %d employee↔location pairs", len(pairs_eu))

    # SiteDivision → location_departments
    pairs_ld: set[tuple[int, int]] = set()
    for row in parse_inserts(dump, "SiteDivision"):
        loc_id = id_map["location"].get(row.get("SiteId"))
        dep_id = id_map["department"].get(row.get("DivisionId"))
        if loc_id and dep_id:
            pairs_ld.add((loc_id, dep_id))
    for loc_id, dep_id in pairs_ld:
        await session.execute(
            location_departments.insert().values(location_id=loc_id, department_id=dep_id)
        )
    log.info("Phase 2: linked %d location↔department pairs", len(pairs_ld))


# ---------------------------------------------------------------------------
# Phase 3 — Clients (dedup B2B by CIF)
# ---------------------------------------------------------------------------

async def import_clients(session, dump: Path, account_id: int, id_map: dict) -> None:
    """Create one Client per unique CIF in CompanyDetails. Map every
    CompanyDetails.Id (whether dedup-merged or skipped) to that Client.id when
    a Client was created.

    CompanyDetails rows with empty/null CIF are NOT turned into clients —
    those receipts will have client_id=NULL (only Vehicol with license plate).
    """
    cif_to_client: dict[str, int] = {}
    cd_to_client: dict[int, int] = {}
    skipped_empty = 0
    for row in parse_inserts(dump, "CompanyDetails"):
        cif = _str_or_none(row.get("CIF"))
        if not cif:
            skipped_empty += 1
            continue
        # Already created Client for this CIF? reuse
        if cif in cif_to_client:
            cd_to_client[row["Id"]] = cif_to_client[cif]
            continue
        client = Client(
            account_id=account_id,
            tip="juridic",
            nume=(_str_or_none(row.get("Title")) or f"Client CIF {cif}")[:200],
            cui=cif[:50],
            reprezentant=_str_or_none(row.get("Delegate")),
            telefon=_str_or_none(row.get("Phone")),
            email=_str_or_none(row.get("Email")),
            adresa=_str_or_none(row.get("Address")),
            comments=_str_or_none(row.get("Comments")),
            created_at=_aware(row.get("CreateDate")) or datetime.now(timezone.utc),
            updated_at=_aware(row.get("UpdateDate")),
            is_deleted=_is_soft_deleted(row),
        )
        session.add(client)
        await session.flush()
        cif_to_client[cif] = client.id
        cd_to_client[row["Id"]] = client.id
    id_map["client_details"] = cd_to_client
    log.info(
        "Phase 3: created %d unique clients from CompanyDetails (skipped %d empty placeholders)",
        len(cif_to_client), skipped_empty,
    )


# ---------------------------------------------------------------------------
# Phase 4 — Receipts + Vehicole (batched)
# ---------------------------------------------------------------------------

async def import_receipts(session, dump: Path, account_id: int, id_map: dict) -> None:
    """Stream Receipt rows; bulk-insert in batches; create Vehicol for rows
    whose Title looks like a license plate."""
    total = 0
    cd_to_client = id_map.get("client_details", {})

    for batch in batched(parse_inserts(dump, "Receipt"), RECEIPT_BATCH):
        receipt_values: list[dict] = []
        # We need each Receipt's new id to create a Vehicol, so we insert
        # receipts with .returning(id) to get them back.
        old_ids: list[int] = []
        plates: list[str | None] = []
        created_ats: list[datetime] = []

        for row in batch:
            old_id = row["Id"]
            old_ids.append(old_id)
            plate = _normalize_license_plate(_str_or_none(row.get("Title")))
            plates.append(plate)

            # Determine location_id: legacy Receipt.SiteId points to Sites.Id
            loc_id = id_map["location"].get(row.get("SiteId"))

            client_id = cd_to_client.get(row.get("ClientDetailsId"))

            # PayMethod mapping + descriere annotation for legacy "Other"
            pm_raw = row.get("PayMethod")
            pm_enum = PAY_METHOD_MAP.get(pm_raw, PayMethod.NEPLATIT)
            descr_parts: list[str] = []
            base_descr = _str_or_none(row.get("Description"))
            if base_descr:
                descr_parts.append(base_descr)
            if pm_raw == 4:
                descr_parts.append("[legacy PayMethod=Other]")
            descriere = " ".join(descr_parts) or None

            # Title: include plate if present, otherwise raw Title
            raw_title = _str_or_none(row.get("Title")) or f"Bon #{old_id}"
            titlu = raw_title[:200]

            created_at = _aware(row.get("CreateDate")) or datetime.now(timezone.utc)
            created_ats.append(created_at)

            receipt_values.append({
                "account_id": account_id,
                "titlu": titlu,
                "descriere": descriere,
                "total": _decimal(row.get("Total")),
                "pay_method": pm_enum,
                "client_id": client_id,
                "location_id": loc_id,
                "deviz_serie": "",
                "deviz_nr": 0,
                "factura_serie": "",
                "factura_nr": 0,
                "chitanta_serie": "",
                "chitanta_nr": 0,
                "is_deleted": _is_soft_deleted(row),
                "created_at": created_at,
                "updated_at": _aware(row.get("UpdateDate")),
            })

        # Bulk insert with RETURNING to get new ids in order
        result = await session.execute(
            insert(Receipt).returning(Receipt.id),
            receipt_values,
        )
        new_ids = [r[0] for r in result.fetchall()]

        for old_id, new_id in zip(old_ids, new_ids):
            id_map["receipt"][old_id] = new_id

        # Vehicole — only for rows with valid plate. 1:1 with Receipt.
        vehicol_values: list[dict] = []
        for new_id, plate, created_at in zip(new_ids, plates, created_ats):
            if plate is None:
                continue
            vehicol_values.append({
                "account_id": account_id,
                "receipt_id": new_id,
                "numar_masina": plate[:50],
                "created_at": created_at,
                "is_deleted": False,
            })
        if vehicol_values:
            await session.execute(insert(Vehicol), vehicol_values)

        total += len(receipt_values)
        await session.commit()
        log.info("Phase 4: receipts imported so far = %d", total)


# ---------------------------------------------------------------------------
# Phase 5 — Receipt items from SelledServices
# ---------------------------------------------------------------------------

async def import_receipt_items(session, dump: Path, account_id: int, id_map: dict) -> None:
    """Stream SelledServices and bulk-insert as receipt_items. Service.UM is
    used for the unit field; falls back to "buc" when missing."""
    total = 0
    skipped_no_receipt = 0
    service_unit = id_map.get("_service_unit", {})

    for batch in batched(parse_inserts(dump, "SelledServices"), ITEM_BATCH):
        rows: list[dict] = []
        for row in batch:
            new_receipt = id_map["receipt"].get(row.get("ReceiptId"))
            if new_receipt is None:
                skipped_no_receipt += 1
                continue
            new_item = id_map["item"].get(row.get("ServiceId"))
            new_emp = id_map["employee"].get(row.get("UserId"))
            unit = service_unit.get(row.get("ServiceId"), "buc")
            rows.append({
                "receipt_id": new_receipt,
                "account_id": account_id,
                "employee_id": new_emp,
                "item_id": new_item,
                "item_type": ItemType.SERVICE,
                "name": (_str_or_none(row.get("Title")) or "Serviciu")[:200],
                "price": _decimal(row.get("Price")),
                "qty": int(row.get("Count") or 1),
                "unit": unit[:50],
            })
        if rows:
            await session.execute(insert(ReceiptItem), rows)
            total += len(rows)
            await session.commit()
            log.info("Phase 5: receipt_items imported so far = %d", total)

    if skipped_no_receipt:
        log.warning("Phase 5: skipped %d SelledServices rows (parent Receipt missing)",
                    skipped_no_receipt)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

async def run(args: argparse.Namespace) -> None:
    dump = Path(args.dump).resolve()
    if not dump.exists():
        raise SystemExit(f"[FATAL] Dump file not found: {dump}")

    log.info("=== Dump inventory ===")
    for name, cnt in sorted(list_tables(dump).items(), key=lambda x: -x[1]):
        log.info("  %s: %d", name, cnt)

    if args.dry_run:
        log.warning("DRY RUN — counters only, no DB inserts will be performed.")
        # Quick parse check: try to read 10 sample rows from each table
        for tbl in ["Companies", "Sites", "Users", "Divisions", "ServiceTypes",
                    "Service", "Devices", "SiteUser", "SiteDivision",
                    "CompanyDetails", "Receipt", "SelledServices"]:
            try:
                sample = next(parse_inserts(dump, tbl), None)
                if sample is None:
                    log.info("  %s: no rows", tbl)
                else:
                    log.info("  %s: sample = %s", tbl, sample)
            except Exception as e:
                log.error("  %s: parse error: %s", tbl, e)
        return

    id_map: dict[str, dict] = defaultdict(dict)

    async with AsyncSessionLocal() as session:
        # Phase 0
        account_id = await create_account(
            session, args.username, args.password, args.account_name
        )
        await session.commit()

        # Phase 1
        log.info("--- Phase 1: reference data ---")
        await import_companies(session, dump, account_id, id_map)
        await import_locations(session, dump, account_id, id_map)
        await import_employees(session, dump, account_id, id_map)
        await import_departments(session, dump, account_id, id_map)
        await import_categories(session, dump, account_id, id_map)
        await import_items(session, dump, account_id, id_map)
        await import_devices(session, dump, account_id, id_map)
        await session.commit()

        # Phase 2
        log.info("--- Phase 2: junctions ---")
        await import_junctions(session, dump, id_map)
        await session.commit()

        # Phase 3
        log.info("--- Phase 3: clients ---")
        await import_clients(session, dump, account_id, id_map)
        await session.commit()

        # Phase 4
        log.info("--- Phase 4: receipts + vehicole ---")
        await import_receipts(session, dump, account_id, id_map)

        # Phase 5
        log.info("--- Phase 5: receipt items ---")
        await import_receipt_items(session, dump, account_id, id_map)

        log.info("=== DONE === account_id=%s username=%s", account_id, args.username)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--dump", required=True, help="Path to UTF-8 SQL dump.")
    parser.add_argument("--username", required=True, help="New account login username.")
    parser.add_argument("--password", required=True, help="New account login password (plaintext, will be bcrypt-hashed).")
    parser.add_argument("--account-name", default="Vulcanizare Alex",
                        help="Display name for the new Account.")
    parser.add_argument("--dry-run", action="store_true",
                        help="Parse only, no DB writes.")
    parser.add_argument("--log-level", default="INFO")
    args = parser.parse_args()

    logging.basicConfig(
        level=args.log_level,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )

    asyncio.run(run(args))


if __name__ == "__main__":
    main()
