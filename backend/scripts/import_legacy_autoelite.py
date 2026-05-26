"""Import legacy BerlinV3 (SQL Server) data — AutoElite profile.

Extends `import_legacy_vulcanizare` with additional phases that map data the
AutoElite dump contains but the Vulcanizare DEVA one did not:

  Phase 6:  SelledServiceManual → receipt_items (item_id=NULL)
  Phase 7:  WheelDimensions → dimensiuni_anvelope (per account)
  Phase 8:  WherehouseLocation → locuri_cazare (per account)
  Phase 9:  WheelCompany → marci_anvelope (global match + propose pending)
  Phase 10: Vehicul → vehicole enrichment (marca/model/vin/km)
  Phase 11: CheckInData → cazari_anvelope (+ cazare_anvelope_items + clienti PF)
  Phase 12: Programari → programari (split datetime, enum status)

Phases 0-5 reuse the vulcanizare implementation verbatim (same source schema).

Usage (CLI)
-----------
    cd backend
    iconv -f UTF-16LE -t UTF-8 ../work/backup_db_berlin26.05.02026.sql > /tmp/d.sql
    python -m scripts.import_legacy_autoelite \\
        --dump /tmp/d.sql --username autoelite --password autoelite \\
        --account-name "Auto Elite"

The script is idempotent at the Account level: if `username` already exists
the script aborts with `UsernameExists`. Re-run strategy after a failed import:
    DELETE FROM accounts WHERE username = 'autoelite';
(CASCADE through all FKs removes the partial import.)
"""
from __future__ import annotations

import argparse
import asyncio
import logging
import re
import sys
import time
from collections import defaultdict
from datetime import datetime, timezone
from itertools import islice
from pathlib import Path

from sqlalchemy import select, insert, text

THIS_DIR = Path(__file__).resolve().parent
BACKEND_DIR = THIS_DIR.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.database import AsyncSessionLocal  # noqa: E402
from app.models.cazare_anvelope import CazareAnvelope, CazareAnvelopaItem  # noqa: E402
from app.models.client import Client  # noqa: E402
from app.models.client_vehicol import ClientVehicol  # noqa: E402
from app.models.dimensiune_anvelopa import DimensiuneAnvelopa  # noqa: E402
from app.models.item import ItemType  # noqa: E402
from app.models.loc_cazare import LocCazare  # noqa: E402
from app.models.marca_anvelopa import MarcaAnvelopa  # noqa: E402
from app.models.programare import Programare, ProgramareStatus  # noqa: E402
from app.models.receipt import Receipt, ReceiptItem, PayMethod  # noqa: E402
from app.models.vehicol import Vehicol  # noqa: E402

from scripts._mssql_dump_parser import parse_inserts, list_tables  # noqa: E402

# Reuse everything that already exists. We only add the new phases below.
from scripts.import_legacy_vulcanizare import (  # noqa: E402
    UsernameExists,
    _aware,
    _decimal,
    _is_soft_deleted,
    _normalize_license_plate,
    _str_or_none,
    batched,
    create_account,
    import_categories,
    import_clients,
    import_companies,
    import_departments,
    import_devices,
    import_employees,
    import_items,
    import_junctions,
    import_locations,
    import_receipt_items,
    import_receipts,
)


log = logging.getLogger("import_legacy_autoelite")


ITEM_BATCH = 5000


# Phase 12: int Status → enum
PROGRAMARE_STATUS_MAP: dict[int, ProgramareStatus] = {
    0: ProgramareStatus.PROGRAMAT,
    1: ProgramareStatus.IN_LUCRU,
    2: ProgramareStatus.EXECUTAT,
    3: ProgramareStatus.ANULAT,
}


# Legacy systems use a handful of "placeholder" strings when the operator
# didn't know the customer name. We treat these as missing so the import can
# substitute the license plate instead of saving a junk name.
_JUNK_NAME_LITERALS = {"'", ".", ";", ",", "-", "_", "/", "\\", "?", "*", ""}


def _is_junk_name(s: str | None) -> bool:
    if not s:
        return True
    t = s.strip()
    if not t:
        return True
    if t in _JUNK_NAME_LITERALS:
        return True
    # Only punctuation / whitespace
    if not any(ch.isalnum() for ch in t):
        return True
    # Single char or repeated single char ("aaa", "...")
    if len(t) <= 1:
        return True
    if len(set(t)) == 1 and not t[0].isalnum():
        return True
    return False


def _build_vehicul_plate_index(dump: Path) -> dict[str, dict]:
    """One pass over Vehicul source → {normalized_plate: {marca, model, vin, km, observatii}}.

    Used by both Phase 10 (enrich vehicole tied to receipts) and Phase 11.5
    (enrich ClientVehicol created from CheckInData).
    """
    index: dict[str, dict] = {}
    for row in parse_inserts(dump, "Vehicul"):
        plate = _normalize_license_plate(_str_or_none(row.get("NrInmatriculare")))
        if plate is None:
            continue
        slot = index.setdefault(plate, {
            "marca": None, "model": None, "vin": None,
            "km": None, "observatii": None,
        })
        if slot["marca"] is None:
            slot["marca"] = _str_or_none(row.get("Marca"))
        if slot["model"] is None:
            slot["model"] = _str_or_none(row.get("Model"))
        if slot["vin"] is None:
            vin = _str_or_none(row.get("VIN"))
            if vin and 5 <= len(vin) <= 17:
                slot["vin"] = vin
        if slot["km"] is None:
            km = row.get("Km") or 0
            if isinstance(km, (int, float)) and km > 0:
                slot["km"] = int(km)
        descr_parts: list[str] = []
        if slot["observatii"]:
            descr_parts.append(slot["observatii"])
        d = _str_or_none(row.get("Description"))
        if d and (not slot["observatii"] or d not in slot["observatii"]):
            descr_parts.append(d)
        an = row.get("AnFabricatie") or 0
        if isinstance(an, (int, float)) and 1900 < an < 2100:
            an_token = f"An: {int(an)}"
            if not slot["observatii"] or an_token not in slot["observatii"]:
                descr_parts.append(an_token)
        slot["observatii"] = " | ".join([p for p in descr_parts if p]) or None
    return index


# ---------------------------------------------------------------------------
# Phase 6 — Receipt items from SelledServiceManual (item_id=NULL)
# ---------------------------------------------------------------------------

async def import_receipt_items_manual(session, dump: Path, account_id: int, id_map: dict) -> dict:
    """Map SelledServiceManual → receipt_items (item_id=NULL).

    These are ad-hoc, custom lines added directly on a receipt — they were
    never linked to the Service catalog in the legacy system. In the new
    schema `ReceiptItem.item_id` is nullable, so we just set `name=Title`
    and leave `item_id=NULL`.
    """
    total = 0
    skipped_no_receipt = 0

    for batch in batched(parse_inserts(dump, "SelledServiceManual"), ITEM_BATCH):
        rows: list[dict] = []
        for row in batch:
            new_receipt = id_map["receipt"].get(row.get("ReceiptId"))
            if new_receipt is None:
                skipped_no_receipt += 1
                continue
            new_emp = id_map["employee"].get(row.get("UserId"))
            rows.append({
                "receipt_id": new_receipt,
                "account_id": account_id,
                "employee_id": new_emp,
                "item_id": None,
                "item_type": ItemType.SERVICE,
                "name": (_str_or_none(row.get("Title")) or "Serviciu manual")[:200],
                "price": _decimal(row.get("Price")),
                "qty": int(row.get("Count") or 1),
                "unit": "buc",
            })
        if rows:
            await session.execute(insert(ReceiptItem), rows)
            total += len(rows)
            await session.commit()
            log.info("Phase 6: manual receipt_items so far = %d", total)

    if skipped_no_receipt:
        log.warning("Phase 6: skipped %d manual rows (parent Receipt missing)", skipped_no_receipt)

    return {"receipt_items_manual": total, "skipped_no_receipt": skipped_no_receipt}


# ---------------------------------------------------------------------------
# Phase 7 — WheelDimensions → dimensiuni_anvelope
# ---------------------------------------------------------------------------

async def import_dimensiuni(session, dump: Path, account_id: int, id_map: dict) -> dict:
    """Per-account import. Keep original Id in id_map for CheckInData lookups
    later (Phase 11 references dimensiuni textually in comments)."""
    total = 0
    for row in parse_inserts(dump, "WheelDimensions"):
        valoare = _str_or_none(row.get("Title"))
        if not valoare:
            continue
        dim = DimensiuneAnvelopa(
            account_id=account_id,
            valoare=valoare[:100],
            created_at=_aware(row.get("CreateDate")) or datetime.now(timezone.utc),
            updated_at=_aware(row.get("UpdateDate")),
            is_deleted=_is_soft_deleted(row),
        )
        session.add(dim)
        await session.flush()
        id_map["dimensiune"][row["Id"]] = dim.id
        # Also remember the text for Phase 11 comments
        id_map["_dimensiune_text"][row["Id"]] = valoare
        total += 1
    log.info("Phase 7: imported %d dimensiuni_anvelope", total)
    return {"dimensiuni_anvelope": total}


# ---------------------------------------------------------------------------
# Phase 8 — WherehouseLocation → locuri_cazare
# ---------------------------------------------------------------------------

async def import_locuri_cazare(session, dump: Path, account_id: int, id_map: dict) -> dict:
    """Per-account import of storage locations. Some legacy rows have junk
    values (a comma, quotes, etc.); we keep them — the user can clean up in
    UI. We still need the Id mapping for CheckInData.WherehouseLocationId."""
    total = 0
    for row in parse_inserts(dump, "WherehouseLocation"):
        nume = _str_or_none(row.get("Title")) or f"Loc #{row['Id']}"
        loc = LocCazare(
            account_id=account_id,
            nume=nume[:200],
            description=_str_or_none(row.get("Description")),
            created_at=_aware(row.get("CreateDate")) or datetime.now(timezone.utc),
            updated_at=_aware(row.get("UpdateDate")),
            is_deleted=_is_soft_deleted(row),
        )
        session.add(loc)
        await session.flush()
        id_map["loc_cazare"][row["Id"]] = loc.id
        total += 1
    log.info("Phase 8: imported %d locuri_cazare", total)
    return {"locuri_cazare": total}


# ---------------------------------------------------------------------------
# Phase 9 — WheelCompany → marci_anvelope (global match / propose)
# ---------------------------------------------------------------------------

async def import_marci_anvelope(session, dump: Path, account_id: int, id_map: dict) -> dict:
    """Marcile sunt globale. Pentru fiecare WheelCompany.Title:
    1. Cauta marca cu acelasi nume normalizat in marci_anvelope (orice status).
    2. Daca exista → reuse (no insert).
    3. Daca nu → INSERT cu status='pending' + proposed_by_account_id.
    """
    matched_existing = 0
    proposed_new = 0
    skipped_empty = 0

    # Cache existing marci by normalized name to avoid N queries
    existing_rows = (await session.execute(
        text("SELECT id, LOWER(TRIM(nume)) AS norm FROM marci_anvelope")
    )).fetchall()
    by_norm: dict[str, int] = {r.norm: r.id for r in existing_rows}

    for row in parse_inserts(dump, "WheelCompany"):
        title = _str_or_none(row.get("Title"))
        if not title:
            skipped_empty += 1
            continue
        norm = title.strip().lower()
        existing_id = by_norm.get(norm)
        if existing_id is not None:
            id_map["marca"][row["Id"]] = existing_id
            matched_existing += 1
            continue
        # Insert as pending proposal
        m = MarcaAnvelopa(
            nume=title.strip()[:200],
            status="pending",
            proposed_by_account_id=account_id,
            created_at=_aware(row.get("CreateDate")) or datetime.now(timezone.utc),
            updated_at=_aware(row.get("UpdateDate")),
            is_deleted=False,
        )
        session.add(m)
        await session.flush()
        id_map["marca"][row["Id"]] = m.id
        by_norm[norm] = m.id
        proposed_new += 1

    log.info(
        "Phase 9: marci_anvelope matched=%d proposed=%d skipped_empty=%d",
        matched_existing, proposed_new, skipped_empty,
    )
    return {
        "marci_anvelope_matched": matched_existing,
        "marci_anvelope_proposed": proposed_new,
        "skipped_empty": skipped_empty,
    }


# ---------------------------------------------------------------------------
# Phase 10 — Vehicul → vehicole enrichment
# ---------------------------------------------------------------------------

async def import_vehicul_enrichment(session, account_id: int, plate_index: dict[str, dict]) -> dict:
    """Populeaza marca/model/vin/numar_kilometrii/observatii pe `vehicole`
    (tabela 1:1 cu receipts) folosind plate_index pre-calculat din sursa Vehicul.

    Date pierdute: NumeProprietar (deja in receipt.client_id), Telefon — nu au
    echivalent in modelul nou.
    """
    enriched_count = 0
    plate_not_found = 0

    for plate, data in plate_index.items():
        if not any((data["marca"], data["model"], data["vin"], data["km"], data["observatii"])):
            continue
        result = await session.execute(
            text("""
                UPDATE vehicole
                   SET marca = COALESCE(:marca, marca),
                       model = COALESCE(:model, model),
                       vin = COALESCE(:vin, vin),
                       numar_kilometrii = COALESCE(:km, numar_kilometrii),
                       observatii = COALESCE(:obs, observatii)
                 WHERE account_id = :a AND numar_masina = :plate
            """),
            {
                "marca": (data["marca"] or "")[:100] or None,
                "model": (data["model"] or "")[:100] or None,
                "vin": (data["vin"] or "")[:17] or None,
                "km": data["km"],
                "obs": data["observatii"],
                "a": account_id,
                "plate": plate,
            },
        )
        if result.rowcount and result.rowcount > 0:
            enriched_count += result.rowcount
        else:
            plate_not_found += 1
    await session.commit()
    log.info(
        "Phase 10: vehicle enrichment: rows updated=%d, source plates without target=%d (of %d unique source plates)",
        enriched_count, plate_not_found, len(plate_index),
    )
    return {
        "vehicole_enriched": enriched_count,
        "source_plates_unmatched": plate_not_found,
        "source_plates_total": len(plate_index),
    }


# ---------------------------------------------------------------------------
# Phase 11 — CheckInData → cazari_anvelope (+ items + persoana fizica clients)
# ---------------------------------------------------------------------------

def _normalize_phone(s: str | None) -> str | None:
    if not s:
        return None
    digits = re.sub(r"\D", "", s)
    return digits or None


async def import_cazari_anvelope(session, dump: Path, account_id: int, id_map: dict) -> dict:
    """Map CheckInData rows to CazareAnvelope + N CazareAnvelopaItem rows.

    Strategy:
    - Determine effective client name:
        * If ClientName looks usable → use it.
        * Else if LicensePlate is valid → use plate as nume (clients showed up
          identified only by plate in the legacy UI).
        * Else fall back to a sequential "Client necunoscut #N" placeholder.
    - Dedup client by (effective_name_lower, normalized_phone). If two
      different real names share the same plate, they become two clients —
      that's correct, they're different people.
    - location_id from SiteId mapping; if not found, skip the row.
    - data_checkin from CheckInDate (cast to date).
    - data_checkout from CheckOutDate iff IsCheckOut=1; else NULL.
    - comments: pack Notes + Tip + dimensiune_text + marca_nume + "N buc." as free text.
    - For each TireCount, create one CazareAnvelopaItem with anvelopa_id=NULL.
    - Remember (client_id, plate) pairs to populate ClientVehicol in Phase 11.5.
    """
    created_cazari = 0
    created_items = 0
    created_clients = 0
    skipped_no_location = 0
    skipped_no_date = 0
    junk_name_substituted = 0

    # Cache for PF dedup: (lower(effective_name), normalized phone) -> client_id
    pf_cache: dict[tuple[str, str | None], int] = {}
    # Track (client_id, plate) pairs for Phase 11.5
    client_plate_pairs: set[tuple[int, str]] = set()
    id_map["_pf_client_plate_pairs"] = client_plate_pairs

    dim_text = id_map.get("_dimensiune_text", {})

    # Marca name cache — we need to display marca_nume in comments.
    marca_ids = [v for v in id_map["marca"].values() if v is not None]
    marca_id_to_name: dict[int, str] = {}
    if marca_ids:
        marc_rows = (await session.execute(
            text("SELECT id, nume FROM marci_anvelope WHERE id = ANY(:ids)"),
            {"ids": marca_ids},
        )).fetchall()
        marca_id_to_name = {r.id: r.nume for r in marc_rows}

    unknown_seq = 0
    for row in parse_inserts(dump, "CheckInData"):
        site_id = row.get("SiteId")
        loc_id = id_map["location"].get(site_id)
        if loc_id is None:
            skipped_no_location += 1
            continue
        ci = _aware(row.get("CheckInDate"))
        if ci is None:
            skipped_no_date += 1
            continue

        # Compute effective client name
        raw_cname = _str_or_none(row.get("ClientName"))
        plate = _normalize_license_plate(_str_or_none(row.get("LicensePlate")))
        phone = _normalize_phone(_str_or_none(row.get("Phone")))
        if _is_junk_name(raw_cname):
            if plate:
                effective_name = plate
                junk_name_substituted += 1
            else:
                unknown_seq += 1
                effective_name = f"Client necunoscut #{unknown_seq}"
        else:
            effective_name = raw_cname.strip()

        key = (effective_name.lower(), phone)
        client_id = pf_cache.get(key)
        if client_id is None:
            c = Client(
                account_id=account_id,
                tip="fizic",
                nume=effective_name[:200],
                telefon=phone,
                numar_masina=plate,
                created_at=_aware(row.get("CreateDate")) or datetime.now(timezone.utc),
                updated_at=_aware(row.get("UpdateDate")),
                is_deleted=False,
            )
            session.add(c)
            await session.flush()
            client_id = c.id
            pf_cache[key] = client_id
            created_clients += 1
        if plate:
            client_plate_pairs.add((client_id, plate))

        # Build comments
        parts: list[str] = []
        notes = _str_or_none(row.get("Notes"))
        if notes and notes not in (".", "-"):
            parts.append(notes)
        tip = _str_or_none(row.get("Tip"))
        if tip:
            parts.append(f"Tip: {tip}")
        storage_loc = _str_or_none(row.get("StorageLocation"))
        if storage_loc and storage_loc not in (".", "-"):
            parts.append(f"Loc: {storage_loc}")
        dim_id = row.get("WheelDimensionsId")
        if dim_id and dim_id in dim_text:
            parts.append(f"Dim: {dim_text[dim_id]}")
        wc_id = row.get("WheelCompanyId")
        if wc_id and wc_id in id_map["marca"]:
            marca_nume = marca_id_to_name.get(id_map["marca"][wc_id])
            if marca_nume:
                parts.append(f"Marca: {marca_nume}")
        tcount = int(row.get("TireCount") or 0)
        if tcount:
            parts.append(f"{tcount} buc.")
        comments = " | ".join(parts) or None

        is_checkout = bool(row.get("IsCheckOut") or 0)
        checkout_date = _aware(row.get("CheckOutDate")) if is_checkout else None
        # Drop sentinel 0001-01-01 dates
        if checkout_date is None or checkout_date.year < 1900:
            checkout_date = None

        cazare = CazareAnvelope(
            account_id=account_id,
            client_id=client_id,
            employee_id=id_map["employee"].get(row.get("UserId")),
            loc_cazare_id=id_map["loc_cazare"].get(row.get("WherehouseLocationId")),
            location_id=loc_id,
            data_checkin=ci.date(),
            data_checkout=checkout_date.date() if checkout_date else None,
            comments=comments,
            dep_anvelope=True,
            dep_capace=False,
            dep_roti_complete=False,
            dep_antifurturi=False,
            dep_prezoane=False,
            montate_pe_masina=False,
            numar_masina=plate,
            receipt_id=None,
            created_at=_aware(row.get("CreateDate")) or datetime.now(timezone.utc),
            updated_at=_aware(row.get("UpdateDate")),
            is_deleted=_is_soft_deleted(row),
        )
        session.add(cazare)
        await session.flush()
        created_cazari += 1

        # Create TireCount items (default 4 if missing)
        n_items = tcount if tcount > 0 else 4
        for _ in range(n_items):
            item = CazareAnvelopaItem(
                account_id=account_id,
                cazare_id=cazare.id,
                anvelopa_id=None,
            )
            session.add(item)
            created_items += 1

        # Periodic commit to keep transaction small
        if created_cazari % 200 == 0:
            await session.commit()
            log.info("Phase 11: cazari so far = %d", created_cazari)

    await session.commit()
    log.info(
        "Phase 11: cazari=%d items=%d clients(PF)=%d junk_name_substituted=%d skipped(no_location)=%d skipped(no_date)=%d",
        created_cazari, created_items, created_clients, junk_name_substituted,
        skipped_no_location, skipped_no_date,
    )
    return {
        "cazari_anvelope": created_cazari,
        "cazare_anvelope_items": created_items,
        "clienti_pf_creati": created_clients,
        "junk_name_substituted": junk_name_substituted,
        "skipped_no_location": skipped_no_location,
        "skipped_no_date": skipped_no_date,
    }


# ---------------------------------------------------------------------------
# Phase 11.5 — ClientVehicol (link plates to PF clients for hotel dropdown)
# ---------------------------------------------------------------------------

async def import_client_vehicole(
    session, account_id: int, id_map: dict, plate_index: dict[str, dict],
) -> dict:
    """Pentru fiecare pereche (client_id, plate) memorata in Phase 11, creeaza
    o linie in `client_vehicole` (folosita la Hotel pentru dropdown vehicule
    per client). Datele marca/model/vin/km vin din `plate_index` (Vehicul sursa).

    De ce e necesara: HotelAnvelope.tsx face GET /api/clienti/{id}/vehicole ca
    sa populeze selectorul de vehicule la creare cazare noua. Daca lista e
    goala, userul nu poate selecta vehiculul si trebuie sa-l adauge manual
    pentru fiecare cont importat.
    """
    pairs: set[tuple[int, str]] = id_map.get("_pf_client_plate_pairs", set())
    if not pairs:
        log.info("Phase 11.5: 0 (client, plate) pairs — skipping ClientVehicol creation")
        return {"client_vehicole_created": 0, "enriched_from_vehicul": 0}

    created = 0
    enriched = 0
    for client_id, plate in pairs:
        # Skip if already exists (defensive — set should dedup)
        existing = (await session.execute(
            text("""
                SELECT 1 FROM client_vehicole
                 WHERE account_id = :a AND client_id = :c AND numar_masina = :p
                   AND is_deleted = false
                 LIMIT 1
            """),
            {"a": account_id, "c": client_id, "p": plate},
        )).scalar()
        if existing:
            continue
        data = plate_index.get(plate, {})
        if any(data.get(k) for k in ("marca", "model", "vin", "km", "observatii")):
            enriched += 1
        cv = ClientVehicol(
            account_id=account_id,
            client_id=client_id,
            numar_masina=plate[:50],
            marca=(data.get("marca") or "")[:100] or None,
            model=(data.get("model") or "")[:100] or None,
            vin=(data.get("vin") or "")[:17] or None,
            numar_kilometrii=data.get("km"),
            observatii=data.get("observatii"),
            is_deleted=False,
        )
        session.add(cv)
        created += 1
        if created % 200 == 0:
            await session.flush()
    await session.commit()
    log.info("Phase 11.5: created=%d ClientVehicol, enriched_from_vehicul=%d", created, enriched)
    return {"client_vehicole_created": created, "enriched_from_vehicul": enriched}


# ---------------------------------------------------------------------------
# Phase 12 — Programari → programari
# ---------------------------------------------------------------------------

async def import_programari(session, dump: Path, account_id: int, id_map: dict) -> dict:
    """Single datetime + duration → start/end. Status enum mapping. UserId
    is dropped (programari no longer track who created them)."""
    total = 0
    skipped_no_location = 0
    skipped_no_date = 0

    for row in parse_inserts(dump, "Programari"):
        loc_id = id_map["location"].get(row.get("SiteId"))
        if loc_id is None:
            skipped_no_location += 1
            continue
        start = _aware(row.get("DataProgramarii"))
        if start is None:
            skipped_no_date += 1
            continue
        duration_min = int(row.get("DurataMinute") or 60)
        end = start + _timedelta_min(duration_min)

        status_int = row.get("Status")
        status = PROGRAMARE_STATUS_MAP.get(status_int, ProgramareStatus.PROGRAMAT)

        p = Programare(
            account_id=account_id,
            titlu=(_str_or_none(row.get("Title")) or f"Programare #{row['Id']}")[:200],
            notite=_str_or_none(row.get("Description")),
            client_id=None,
            location_id=loc_id,
            department_id=None,
            start_time=start,
            end_time=end,
            status=status,
            created_at=_aware(row.get("CreateDate")) or datetime.now(timezone.utc),
            updated_at=_aware(row.get("UpdateDate")),
            is_deleted=_is_soft_deleted(row),
        )
        session.add(p)
        total += 1

    await session.commit()
    log.info(
        "Phase 12: programari=%d skipped(no_location)=%d skipped(no_date)=%d",
        total, skipped_no_location, skipped_no_date,
    )
    return {
        "programari": total,
        "skipped_no_location": skipped_no_location,
        "skipped_no_date": skipped_no_date,
    }


def _timedelta_min(m: int):
    from datetime import timedelta
    return timedelta(minutes=m)


# ---------------------------------------------------------------------------
# Phase 13 — FDL (Fisa de Lucru) → Receipt(source='fdl') + items + Vehicol
# ---------------------------------------------------------------------------

def _build_vehicul_id_to_plate(dump: Path) -> dict[int, str]:
    """Vehicul.Id → normalized plate. Used to resolve FDL.VehiculId when
    FDL.Title is empty or doesn't look like a plate."""
    out: dict[int, str] = {}
    for row in parse_inserts(dump, "Vehicul"):
        plate = _normalize_license_plate(_str_or_none(row.get("NrInmatriculare")))
        if plate:
            out[row["Id"]] = plate
    return out


async def import_fdl(
    session, dump: Path, account_id: int, id_map: dict,
    plate_index: dict[str, dict], vehicul_id_to_plate: dict[int, str],
) -> dict:
    """Map legacy FDL rows to Receipt(source='fdl') + linked items + Vehicol.

    Strategy:
    - One Receipt per FDL row with source='fdl', pay_method=NEPLATIT,
      total=TotalCost, timp_estimat_ore=TimeEstimation, sugestii=Suggestions.
    - constatari: concat all FDL_Constatare.Title for this FDLId (newline-separated).
    - location_id from SiteId.
    - client_id from CompanyDetailsId (B2B match, may be NULL).
    - titlu = FDL.Title (typically the plate) or "FDL #N" fallback.
    - Vehicol (1:1) created when FDL.Title parses as a plate OR FDL.VehiculId
      resolves to a Vehicul.NrInmatriculare. Enriched with marca/model/vin/km
      from plate_index when available.
    - Receipt items: FDL_SelledService (with item_id match) +
      FDL_SelledServiceManual (item_id=NULL).
    """
    cd_to_client = id_map.get("client_details", {})
    service_unit = id_map.get("_service_unit", {})

    # Pre-collect Constatare + items grouped by FDLId so we don't re-stream
    # 3 files per FDL.
    constatari_by_fdl: dict[int, list[str]] = {}
    for row in parse_inserts(dump, "FDL_Constatare"):
        fdl_id = row.get("FDLId")
        title = _str_or_none(row.get("Title"))
        if fdl_id is None or not title:
            continue
        constatari_by_fdl.setdefault(fdl_id, []).append(title)

    sel_by_fdl: dict[int, list[dict]] = {}
    for row in parse_inserts(dump, "FDL_SelledService"):
        fdl_id = row.get("FDLId")
        if fdl_id is None:
            continue
        sel_by_fdl.setdefault(fdl_id, []).append(row)

    sel_manual_by_fdl: dict[int, list[dict]] = {}
    for row in parse_inserts(dump, "FDL_SelledServiceManual"):
        fdl_id = row.get("FDLId")
        if fdl_id is None:
            continue
        sel_manual_by_fdl.setdefault(fdl_id, []).append(row)

    created_fdl = 0
    created_items_catalog = 0
    created_items_manual = 0
    created_vehicole = 0
    skipped_no_location = 0

    for row in parse_inserts(dump, "FDL"):
        old_id = row["Id"]
        loc_id = id_map["location"].get(row.get("SiteId"))
        if loc_id is None:
            skipped_no_location += 1
            continue

        # Resolve plate (Title first, then VehiculId)
        title_raw = _str_or_none(row.get("Title"))
        plate = _normalize_license_plate(title_raw)
        if plate is None:
            vid = row.get("VehiculId")
            if vid and vid in vehicul_id_to_plate:
                plate = vehicul_id_to_plate[vid]

        titlu = (title_raw or plate or f"FDL #{old_id}")[:200]
        client_id = cd_to_client.get(row.get("CompanyDetailsId"))
        constatari = "\n".join(constatari_by_fdl.get(old_id, [])) or None
        sugestii = _str_or_none(row.get("Suggestions"))
        time_est = row.get("TimeEstimation")
        timp_estimat = _decimal(time_est) if time_est is not None else None
        created_at = _aware(row.get("CreateDate")) or datetime.now(timezone.utc)

        fdl_receipt = Receipt(
            account_id=account_id,
            titlu=titlu,
            descriere=_str_or_none(row.get("Description")),
            total=_decimal(row.get("TotalCost")),
            pay_method=PayMethod.NEPLATIT,
            client_id=client_id,
            location_id=loc_id,
            deviz_serie="",
            deviz_nr=0,
            factura_serie="",
            factura_nr=0,
            chitanta_serie="",
            chitanta_nr=0,
            source="fdl",
            constatari=constatari,
            sugestii=sugestii,
            timp_estimat_ore=timp_estimat,
            is_deleted=_is_soft_deleted(row),
            created_at=created_at,
            updated_at=_aware(row.get("UpdateDate")),
        )
        session.add(fdl_receipt)
        await session.flush()
        new_receipt_id = fdl_receipt.id
        created_fdl += 1

        # Vehicol 1:1 (UNIQUE on receipt_id, so safe to insert once)
        if plate:
            data = plate_index.get(plate, {})
            vh = Vehicol(
                account_id=account_id,
                receipt_id=new_receipt_id,
                numar_masina=plate[:50],
                marca=(data.get("marca") or "")[:100] or None,
                model=(data.get("model") or "")[:100] or None,
                vin=(data.get("vin") or "")[:17] or None,
                numar_kilometrii=data.get("km"),
                observatii=data.get("observatii"),
                created_at=created_at,
                is_deleted=False,
            )
            session.add(vh)
            created_vehicole += 1

        # Items — catalog (FDL_SelledService)
        catalog_rows = []
        for item_row in sel_by_fdl.get(old_id, []):
            new_item_id = id_map["item"].get(item_row.get("ServiceId"))
            unit = service_unit.get(item_row.get("ServiceId"), "buc")
            catalog_rows.append({
                "receipt_id": new_receipt_id,
                "account_id": account_id,
                "employee_id": None,
                "item_id": new_item_id,
                "item_type": ItemType.SERVICE,
                "name": (_str_or_none(item_row.get("Title")) or "Serviciu")[:200],
                "price": _decimal(item_row.get("Price")),
                "qty": int(item_row.get("Count") or 1),
                "unit": unit[:50],
            })
        if catalog_rows:
            await session.execute(insert(ReceiptItem), catalog_rows)
            created_items_catalog += len(catalog_rows)

        # Items — manual (FDL_SelledServiceManual)
        manual_rows = []
        for item_row in sel_manual_by_fdl.get(old_id, []):
            manual_rows.append({
                "receipt_id": new_receipt_id,
                "account_id": account_id,
                "employee_id": None,
                "item_id": None,
                "item_type": ItemType.SERVICE,
                "name": (_str_or_none(item_row.get("Title")) or "Serviciu manual")[:200],
                "price": _decimal(item_row.get("Price")),
                "qty": int(item_row.get("Count") or 1),
                "unit": "buc",
            })
        if manual_rows:
            await session.execute(insert(ReceiptItem), manual_rows)
            created_items_manual += len(manual_rows)

        if created_fdl % 200 == 0:
            await session.commit()
            log.info("Phase 13: FDL imported so far = %d", created_fdl)

    await session.commit()
    log.info(
        "Phase 13: fdl=%d items_catalog=%d items_manual=%d vehicole=%d skipped(no_location)=%d",
        created_fdl, created_items_catalog, created_items_manual, created_vehicole, skipped_no_location,
    )
    return {
        "fdl_receipts": created_fdl,
        "fdl_items_catalog": created_items_catalog,
        "fdl_items_manual": created_items_manual,
        "fdl_vehicole": created_vehicole,
        "skipped_no_location": skipped_no_location,
    }


# ---------------------------------------------------------------------------
# Verification (extended)
# ---------------------------------------------------------------------------

async def _verify_counts_extended(session, account_id: int) -> dict:
    """Same as vulcanizare verification + autoelite-specific tables."""
    from decimal import Decimal as _D
    queries = {
        "companies":             "SELECT COUNT(*) FROM companies WHERE account_id = :a",
        "locations":             "SELECT COUNT(*) FROM locations WHERE account_id = :a",
        "employees":             "SELECT COUNT(*) FROM employees WHERE account_id = :a",
        "departments":           "SELECT COUNT(*) FROM departments WHERE account_id = :a",
        "categories":            "SELECT COUNT(*) FROM categories WHERE account_id = :a",
        "items":                 "SELECT COUNT(*) FROM items WHERE account_id = :a",
        "devices":               "SELECT COUNT(*) FROM devices WHERE account_id = :a",
        "clienti":               "SELECT COUNT(*) FROM clienti WHERE account_id = :a",
        "receipts":              "SELECT COUNT(*) FROM receipts WHERE account_id = :a",
        "vehicole":              "SELECT COUNT(*) FROM vehicole WHERE account_id = :a",
        "receipt_items":         "SELECT COUNT(*) FROM receipt_items WHERE account_id = :a",
        "dimensiuni_anvelope":   "SELECT COUNT(*) FROM dimensiuni_anvelope WHERE account_id = :a",
        "locuri_cazare":         "SELECT COUNT(*) FROM locuri_cazare WHERE account_id = :a",
        "cazari_anvelope":       "SELECT COUNT(*) FROM cazari_anvelope WHERE account_id = :a",
        "cazare_anvelope_items": "SELECT COUNT(*) FROM cazare_anvelope_items WHERE account_id = :a",
        "client_vehicole":       "SELECT COUNT(*) FROM client_vehicole WHERE account_id = :a",
        "programari":            "SELECT COUNT(*) FROM programari WHERE account_id = :a",
        "fdl_receipts":          "SELECT COUNT(*) FROM receipts WHERE account_id = :a AND source = 'fdl'",
        "marci_anvelope_proposed_by_account": (
            "SELECT COUNT(*) FROM marci_anvelope WHERE proposed_by_account_id = :a"
        ),
        "marci_anvelope_pending_by_account": (
            "SELECT COUNT(*) FROM marci_anvelope WHERE proposed_by_account_id = :a AND status = 'pending'"
        ),
    }
    out: dict[str, int | str] = {}
    for key, q in queries.items():
        out[key] = int((await session.execute(text(q), {"a": account_id})).scalar() or 0)
    total = (await session.execute(
        text("SELECT COALESCE(SUM(total), 0) FROM receipts WHERE account_id = :a"),
        {"a": account_id},
    )).scalar() or _D("0")
    out["sum_total"] = str(total)
    return out


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------

async def run_import(
    dump_path: Path,
    username: str,
    password: str,
    account_name: str,
    dry_run: bool = False,
) -> dict:
    started = time.monotonic()
    dump = Path(dump_path).resolve()
    if not dump.exists():
        raise FileNotFoundError(f"Dump file not found: {dump}")

    inventory = {name: cnt for name, cnt in list_tables(dump).items()}
    log.info("=== Dump inventory === %s", inventory)

    phases: list[dict] = []

    if dry_run:
        log.warning("DRY RUN — parsing only, no DB writes.")
        sample_tables = [
            "Companies", "Sites", "Users", "Divisions", "ServiceTypes",
            "Service", "Devices", "SiteUser", "SiteDivision",
            "CompanyDetails", "Receipt", "SelledServices",
            "SelledServiceManual", "WheelDimensions", "WherehouseLocation",
            "WheelCompany", "Vehicul", "CheckInData", "Programari",
        ]
        sample_counts = {t: inventory.get(t, 0) for t in sample_tables}
        phases.append({"name": "Dry run inventory", "status": "ok", "counts": sample_counts})
        return {
            "account_id": None,
            "username": username,
            "phases": phases,
            "verification": None,
            "dry_run": True,
            "inventory": inventory,
            "duration_seconds": round(time.monotonic() - started, 2),
        }

    id_map: dict[str, dict] = defaultdict(dict)

    async with AsyncSessionLocal() as session:
        # Phase 0
        account_id = await create_account(session, username, password, account_name)
        await session.commit()
        phases.append({"name": "Phase 0: Account",
                       "status": "ok",
                       "counts": {"account_id": account_id}})

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
        phases.append({"name": "Phase 1: reference data", "status": "ok",
                       "counts": {"companies": len(id_map["company"]),
                                  "locations": len(id_map["location"]),
                                  "employees": len(id_map["employee"]),
                                  "departments": len(id_map["department"]),
                                  "categories": len(id_map["category"]),
                                  "items": len(id_map["item"]),
                                  "devices": len(id_map["device"])}})

        # Phase 2
        log.info("--- Phase 2: junctions ---")
        junctions = await import_junctions(session, dump, id_map)
        await session.commit()
        phases.append({"name": "Phase 2: junctions", "status": "ok", "counts": junctions})

        # Phase 3
        log.info("--- Phase 3: clients ---")
        clients = await import_clients(session, dump, account_id, id_map)
        await session.commit()
        phases.append({"name": "Phase 3: clients (B2B dedup pe CIF)",
                       "status": "ok", "counts": clients})

        # Phase 4
        log.info("--- Phase 4: receipts + vehicole ---")
        receipts = await import_receipts(session, dump, account_id, id_map)
        phases.append({"name": "Phase 4: receipts + vehicole",
                       "status": "ok", "counts": receipts})

        # Phase 5
        log.info("--- Phase 5: receipt items (SelledServices) ---")
        items_res = await import_receipt_items(session, dump, account_id, id_map)
        phases.append({"name": "Phase 5: receipt items (catalog)",
                       "status": "ok", "counts": items_res})

        # Phase 6
        log.info("--- Phase 6: receipt items (SelledServiceManual) ---")
        manual_res = await import_receipt_items_manual(session, dump, account_id, id_map)
        phases.append({"name": "Phase 6: receipt items (manuale)",
                       "status": "ok", "counts": manual_res})

        # Phase 7
        log.info("--- Phase 7: dimensiuni_anvelope ---")
        dim_res = await import_dimensiuni(session, dump, account_id, id_map)
        await session.commit()
        phases.append({"name": "Phase 7: dimensiuni_anvelope",
                       "status": "ok", "counts": dim_res})

        # Phase 8
        log.info("--- Phase 8: locuri_cazare ---")
        loc_res = await import_locuri_cazare(session, dump, account_id, id_map)
        await session.commit()
        phases.append({"name": "Phase 8: locuri_cazare",
                       "status": "ok", "counts": loc_res})

        # Phase 9
        log.info("--- Phase 9: marci_anvelope (global match / propose) ---")
        marci_res = await import_marci_anvelope(session, dump, account_id, id_map)
        await session.commit()
        phases.append({"name": "Phase 9: marci_anvelope",
                       "status": "ok", "counts": marci_res})

        # Build Vehicul plate index once — reused in Phase 10, 11.5 and 13.
        log.info("Building Vehicul plate indexes...")
        plate_index = _build_vehicul_plate_index(dump)
        vehicul_id_to_plate = _build_vehicul_id_to_plate(dump)
        log.info(
            "Vehicul plate index: %d unique plates with metadata, %d id→plate mappings",
            len(plate_index), len(vehicul_id_to_plate),
        )

        # Phase 10
        log.info("--- Phase 10: vehicole enrichment ---")
        veh_res = await import_vehicul_enrichment(session, account_id, plate_index)
        phases.append({"name": "Phase 10: vehicole enrichment",
                       "status": "ok", "counts": veh_res})

        # Phase 11
        log.info("--- Phase 11: cazari_anvelope ---")
        caz_res = await import_cazari_anvelope(session, dump, account_id, id_map)
        phases.append({"name": "Phase 11: cazari_anvelope",
                       "status": "ok", "counts": caz_res})

        # Phase 11.5
        log.info("--- Phase 11.5: client_vehicole (link plates → hotel dropdown) ---")
        cv_res = await import_client_vehicole(session, account_id, id_map, plate_index)
        phases.append({"name": "Phase 11.5: client_vehicole",
                       "status": "ok", "counts": cv_res})

        # Phase 12
        log.info("--- Phase 12: programari ---")
        prog_res = await import_programari(session, dump, account_id, id_map)
        phases.append({"name": "Phase 12: programari",
                       "status": "ok", "counts": prog_res})

        # Phase 13
        log.info("--- Phase 13: FDL (Fise de Lucru) ---")
        fdl_res = await import_fdl(
            session, dump, account_id, id_map, plate_index, vehicul_id_to_plate,
        )
        phases.append({"name": "Phase 13: FDL (Fise de Lucru)",
                       "status": "ok", "counts": fdl_res})

        verification = await _verify_counts_extended(session, account_id)

        log.info("=== DONE === account_id=%s username=%s", account_id, username)

    return {
        "account_id": account_id,
        "username": username,
        "phases": phases,
        "verification": verification,
        "dry_run": False,
        "inventory": inventory,
        "duration_seconds": round(time.monotonic() - started, 2),
    }


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

async def _run_cli(args: argparse.Namespace) -> None:
    try:
        result = await run_import(
            dump_path=Path(args.dump),
            username=args.username,
            password=args.password,
            account_name=args.account_name,
            dry_run=args.dry_run,
        )
    except UsernameExists as e:
        raise SystemExit(f"[FATAL] {e}")
    except FileNotFoundError as e:
        raise SystemExit(f"[FATAL] {e}")

    if result["dry_run"]:
        log.info("=== DRY RUN DONE === inventory: %s", result["inventory"])
    else:
        log.info(
            "=== DONE === account_id=%s username=%s verification=%s",
            result["account_id"], result["username"], result["verification"],
        )


def main() -> None:
    parser = argparse.ArgumentParser(description="Import AutoElite legacy SQL Server dump.")
    parser.add_argument("--dump", required=True, help="Path to UTF-8 SQL dump.")
    parser.add_argument("--username", required=True)
    parser.add_argument("--password", required=True)
    parser.add_argument("--account-name", default="Auto Elite")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--log-level", default="INFO")
    args = parser.parse_args()

    logging.basicConfig(
        level=args.log_level,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    asyncio.run(_run_cli(args))


if __name__ == "__main__":
    main()
