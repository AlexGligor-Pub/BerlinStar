"""One-off patch: run Phase 11.5, 13, 14 on an autoelite account that was
imported with an OLD version of import_legacy_autoelite (before those phases
existed).

Use case: UI import via /api/admin/legacy-import/import was run before the
backend picked up the latest code, so the imported account is missing FDL
records, client_vehicole, and receipts→clients linking.

Idempotency: each phase checks for existing rows and skips them.

Usage:
    cd backend
    iconv -f UTF-16LE -t UTF-8 ../work/backup_db_berlin26.05.02026.sql > /tmp/d.sql
    python -m scripts.patch_autoelite_missing_phases --dump /tmp/d.sql --username autoelite3
"""
from __future__ import annotations

import argparse
import asyncio
import logging
import sys
from collections import defaultdict
from pathlib import Path

from sqlalchemy import select, text

THIS_DIR = Path(__file__).resolve().parent
BACKEND_DIR = THIS_DIR.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.database import AsyncSessionLocal  # noqa: E402

from scripts._mssql_dump_parser import parse_inserts  # noqa: E402
from scripts.import_legacy_autoelite import (  # noqa: E402
    _build_vehicul_id_to_plate,
    _build_vehicul_plate_index,
    _is_junk_name,
    _str_or_none,
    import_client_vehicole,
    import_fdl,
    import_link_receipts_to_clients,
)


log = logging.getLogger("patch_autoelite")


async def _reconstruct_id_maps(session, account_id: int, dump: Path) -> dict:
    """Build the same id_map structure import_legacy_autoelite uses, by
    matching legacy IDs to existing DB rows on this account.

    Strategy:
    - Single location: SiteId=1 (sole Sites row) → only locations row.
    - Categories/items/employees/departments: match by name to current DB
      rows (autoelite has unique names within each entity).
    - Marca: match dump WheelCompany.Title against marci_anvelope.nume.
    - Client_details: match CompanyDetails.CIF against clienti.cui.
    - _service_unit: legacy Service.Id → Service.UM (text only, no DB lookup).
    - _dimensiune_text: legacy WheelDimensions.Id → Title.
    - _pf_client_plate_pairs: pull from existing clienti.numar_masina.
    """
    id_map: dict[str, dict] = defaultdict(dict)

    # location: one location only — Sites=1 row
    locs = (await session.execute(text(
        "SELECT id FROM locations WHERE account_id=:a ORDER BY id"
    ), {"a": account_id})).fetchall()
    if not locs:
        raise RuntimeError(f"No locations on account {account_id}")
    single_loc_id = locs[0].id
    # All legacy Sites map to this location (autoelite has only 1)
    for row in parse_inserts(dump, "Sites"):
        id_map["location"][row["Id"]] = single_loc_id

    # employee: match by name
    emps = {r.name: r.id for r in (await session.execute(text(
        "SELECT id, name FROM employees WHERE account_id=:a"
    ), {"a": account_id})).fetchall()}
    for row in parse_inserts(dump, "Users"):
        legacy_id = row["Id"]
        name = (_str_or_none(row.get("Title")) or "Angajat")[:200]
        eid = emps.get(name)
        if eid is not None:
            id_map["employee"][legacy_id] = eid

    # department
    depts = {r.name: r.id for r in (await session.execute(text(
        "SELECT id, name FROM departments WHERE account_id=:a"
    ), {"a": account_id})).fetchall()}
    for row in parse_inserts(dump, "Divisions"):
        legacy_id = row["Id"]
        name = (_str_or_none(row.get("Title")) or "Departament")[:100]
        did = depts.get(name)
        if did is not None:
            id_map["department"][legacy_id] = did

    # category
    cats = {r.name: r.id for r in (await session.execute(text(
        "SELECT id, name FROM categories WHERE account_id=:a"
    ), {"a": account_id})).fetchall()}
    for row in parse_inserts(dump, "ServiceTypes"):
        legacy_id = row["Id"]
        name = (_str_or_none(row.get("Title")) or "Categorie")[:100]
        cid = cats.get(name)
        if cid is not None:
            id_map["category"][legacy_id] = cid

    # item + _service_unit
    items_by_name: dict[str, int] = {r.name: r.id for r in (await session.execute(text(
        "SELECT id, name FROM items WHERE account_id=:a"
    ), {"a": account_id})).fetchall()}
    service_unit: dict[int, str] = {}
    for row in parse_inserts(dump, "Service"):
        legacy_id = row["Id"]
        name = (_str_or_none(row.get("Title")) or "Serviciu")[:200]
        unit = _str_or_none(row.get("UM")) or "buc"
        service_unit[legacy_id] = unit
        iid = items_by_name.get(name)
        if iid is not None:
            id_map["item"][legacy_id] = iid
    id_map["_service_unit"] = service_unit

    # client_details: legacy CompanyDetails.Id → clienti.id by CIF
    cui_to_client: dict[str, int] = {r.cui: r.id for r in (await session.execute(text(
        "SELECT id, cui FROM clienti WHERE account_id=:a AND tip='juridic' AND cui IS NOT NULL"
    ), {"a": account_id})).fetchall()}
    for row in parse_inserts(dump, "CompanyDetails"):
        cif = _str_or_none(row.get("CIF"))
        if not cif:
            continue
        cid = cui_to_client.get(cif[:50])
        if cid is not None:
            id_map["client_details"][row["Id"]] = cid

    # marca: legacy WheelCompany.Id → marci_anvelope.id by normalized name
    marci_rows = (await session.execute(text(
        "SELECT id, LOWER(TRIM(nume)) AS norm FROM marci_anvelope"
    ))).fetchall()
    by_norm = {r.norm: r.id for r in marci_rows}
    for row in parse_inserts(dump, "WheelCompany"):
        title = _str_or_none(row.get("Title"))
        if not title:
            continue
        mid = by_norm.get(title.strip().lower())
        if mid is not None:
            id_map["marca"][row["Id"]] = mid

    # _pf_client_plate_pairs: existing PF clients with plates
    pairs = (await session.execute(text(
        "SELECT id, numar_masina FROM clienti WHERE account_id=:a AND tip='fizic' AND numar_masina IS NOT NULL"
    ), {"a": account_id})).fetchall()
    id_map["_pf_client_plate_pairs"] = {(p.id, p.numar_masina) for p in pairs}
    # Also seed _plate_to_pf_client (used by Phase 14)
    id_map["_plate_to_pf_client"] = {p.numar_masina: p.id for p in pairs}

    log.info(
        "Reconstructed id_maps: locations=%d employees=%d departments=%d "
        "categories=%d items=%d client_details=%d marca=%d pf_client_plate_pairs=%d",
        1, len(id_map["employee"]), len(id_map["department"]),
        len(id_map["category"]), len(id_map["item"]),
        len(id_map["client_details"]), len(id_map["marca"]),
        len(id_map["_pf_client_plate_pairs"]),
    )
    return id_map


async def run_patch(dump_path: Path, username: str) -> None:
    dump = Path(dump_path).resolve()
    if not dump.exists():
        raise FileNotFoundError(f"Dump not found: {dump}")

    async with AsyncSessionLocal() as session:
        # Resolve account_id
        r = (await session.execute(text(
            "SELECT id FROM accounts WHERE username = :u"
        ), {"u": username})).fetchone()
        if not r:
            raise SystemExit(f"No account with username '{username}'")
        account_id = r.id
        log.info("Patching account_id=%d username=%s", account_id, username)

        id_map = await _reconstruct_id_maps(session, account_id, dump)

        plate_index = _build_vehicul_plate_index(dump)
        vehicul_id_to_plate = _build_vehicul_id_to_plate(dump)
        log.info(
            "Vehicul plate index: %d unique plates with metadata, %d id→plate mappings",
            len(plate_index), len(vehicul_id_to_plate),
        )

        # --- Phase 11-FIX: junk-name PF clients with plates --------------
        log.info("--- Phase 11-FIX: replace junk names with plate ---")
        # Also build plate -> best real name from dump (same logic as Phase 11)
        plate_real_names: dict[str, dict[str, int]] = {}
        for row in parse_inserts(dump, "CheckInData"):
            plate = _str_or_none(row.get("LicensePlate"))
            if plate:
                plate = plate.strip().upper().replace(" ", "")
            cname = _str_or_none(row.get("ClientName"))
            if not plate or _is_junk_name(cname):
                continue
            d = plate_real_names.setdefault(plate, {})
            name = cname.strip()
            d[name] = d.get(name, 0) + 1
        plate_to_real_name = {
            p: max(n.items(), key=lambda kv: kv[1])[0]
            for p, n in plate_real_names.items() if n
        }

        # Fetch all PF clients with junk names
        junk_clients = (await session.execute(text("""
            SELECT id, nume, numar_masina FROM clienti
            WHERE account_id = :a AND tip = 'fizic'
        """), {"a": account_id})).fetchall()
        fixed_to_real = 0
        fixed_to_plate = 0
        for c in junk_clients:
            if not _is_junk_name(c.nume):
                continue
            plate = c.numar_masina
            new_name = None
            if plate and plate in plate_to_real_name:
                new_name = plate_to_real_name[plate]
                fixed_to_real += 1
            elif plate:
                new_name = plate
                fixed_to_plate += 1
            if new_name:
                await session.execute(text(
                    "UPDATE clienti SET nume = :n WHERE id = :i"
                ), {"n": new_name[:200], "i": c.id})
        await session.commit()
        log.info("Phase 11-FIX: fixed_to_real=%d fixed_to_plate=%d", fixed_to_real, fixed_to_plate)

        # After name fixes, _plate_to_pf_client may have stale name info but
        # the id mappings are still correct — Phase 14 only uses ids, not names.

        # Phase 11.5
        log.info("--- Phase 11.5: client_vehicole ---")
        cv_res = await import_client_vehicole(session, account_id, id_map, plate_index)
        log.info("Phase 11.5 result: %s", cv_res)

        # Phase 13
        log.info("--- Phase 13: FDL (Fise de Lucru) ---")
        fdl_res = await import_fdl(
            session, dump, account_id, id_map, plate_index, vehicul_id_to_plate,
        )
        log.info("Phase 13 result: %s", fdl_res)

        # Phase 14 — needs to re-collect _plate_to_pf_client after Phase 13
        # didn't change it; reuse the same map.
        log.info("--- Phase 14: link receipts → clients ---")
        link_res = await import_link_receipts_to_clients(
            session, account_id, id_map, plate_index,
        )
        log.info("Phase 14 result: %s", link_res)

        # Final counts
        for label, q in [
            ("clienti",                "SELECT COUNT(*) FROM clienti WHERE account_id=:a"),
            ("client_vehicole",        "SELECT COUNT(*) FROM client_vehicole WHERE account_id=:a"),
            ("receipts",               "SELECT COUNT(*) FROM receipts WHERE account_id=:a"),
            ("fdl_receipts",           "SELECT COUNT(*) FROM receipts WHERE account_id=:a AND source='fdl'"),
            ("receipts_with_client",   "SELECT COUNT(*) FROM receipts WHERE account_id=:a AND client_id IS NOT NULL"),
            ("vehicole",               "SELECT COUNT(*) FROM vehicole WHERE account_id=:a"),
            ("receipt_items",          "SELECT COUNT(*) FROM receipt_items WHERE account_id=:a"),
        ]:
            n = (await session.execute(text(q), {"a": account_id})).scalar()
            log.info("  %s = %s", label, n)


def main() -> None:
    p = argparse.ArgumentParser(description="Patch missing phases on existing autoelite account.")
    p.add_argument("--dump", required=True)
    p.add_argument("--username", required=True)
    p.add_argument("--log-level", default="INFO")
    args = p.parse_args()
    logging.basicConfig(level=args.log_level, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    asyncio.run(run_patch(Path(args.dump), args.username))


if __name__ == "__main__":
    main()
