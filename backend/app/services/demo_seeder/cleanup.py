"""Hard-delete pentru contul demo + toate datele asociate.

Strategie de performanta:
  - DELETE in batch-uri de 5000 randuri folosind CTE (DELETE ... WHERE id IN (...LIMIT 5000))
  - Commit per tabel (elibereaza WAL si lock-uri intre operatii)
  - Ordine respecta FK dependencies; tabelele copii sterse intai pentru a evita
    cascade overhead pe tabela parinte

Pentru o BD de demo cu ~38k receipts + ~95k items + ~47k stock movements,
se executa in 30-90 secunde pe Postgres local WSL2 (vs 10+ minute fara batch).
"""
from __future__ import annotations

import logging

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal
from app.models.account import Account
from app.services.demo_seeder.config import DEMO_USERNAME

log = logging.getLogger("berlinstar")

# Ordine de stergere — copii inainte de parinti. Toate filtrate pe account_id.
_DELETE_ORDER = [
    # rapoarte agregate (FK doar pe accounts, fara dependents)
    "report_cazari_daily",
    "report_clients_daily",
    "report_employee_daily",
    "report_programari_daily",
    "report_receipts_breakdown_daily",
    "report_receipts_daily",
    "report_stock_movements_daily",
    # entitati copii ale Receipt
    "cazare_anvelope_items",
    "cazari_anvelope",
    "anvelope",
    "montaj_roti",
    "programari",
    "vehicole",
    "receipt_items",
    "stock_movements",
    "receipts",
    "stocks",
    "items",
    "categories",
    "departments",          # location_departments are ON DELETE CASCADE
    "employees",            # employee_locations are ON DELETE CASCADE
    "client_vehicole",
    "clienti",
    "devices",
    "email_logs",
    "locations",
    "registers",
    "disclaimers",
    "companies",
    "general_settings",
    "marci_anvelope",
    "dimensiuni_anvelope",
    "profiluri_anvelope",
    "coduri_dot_anvelope",
    "locuri_cazare",
]

BATCH_SIZE = 5000


async def _delete_in_batches(db: AsyncSession, table: str, account_id: int) -> int:
    """Sterge toate randurile din `table` care apartin contului, in batch-uri de BATCH_SIZE.
    Commit dupa fiecare batch pentru a elibera WAL si lock-uri. Returneaza total sters.
    """
    total = 0
    while True:
        # Folosim CTE cu LIMIT pentru a sterge un batch deterministic
        sql = text(f"""
            WITH victims AS (
                SELECT id FROM {table}
                WHERE account_id = :aid
                LIMIT :batch
            )
            DELETE FROM {table}
            WHERE id IN (SELECT id FROM victims)
        """)
        res = await db.execute(sql, {"aid": account_id, "batch": BATCH_SIZE})
        n = res.rowcount or 0
        await db.commit()
        total += n
        if n < BATCH_SIZE:
            break
    return total


async def delete_demo_account() -> dict:
    """Sterge complet contul demo si toate datele asociate.

    Returneaza dict cu counts per tabel sters + flag `existed`.
    Daca contul nu exista, intoarce `existed=False` fara a sterge nimic.
    """
    counts: dict[str, int] = {}
    async with AsyncSessionLocal() as db:
        acc = (await db.execute(
            select(Account).where(Account.username == DEMO_USERNAME)
        )).scalar_one_or_none()
        if acc is None:
            return {"existed": False, "counts": counts}

        account_id = acc.id
        log.info("demo-cleanup: pornit pentru account_id=%s", account_id)

        for table in _DELETE_ORDER:
            try:
                n = await _delete_in_batches(db, table, account_id)
                counts[table] = n
                if n > 0:
                    log.info("demo-cleanup: %s -> %d randuri sterse", table, n)
            except Exception as exc:
                # Tabela poate sa nu existe in versiunile vechi ale BD-ului
                # (migrare pending). Logam si continuam — celelalte oricum vor fi sterse.
                await db.rollback()
                counts[table] = -1
                log.warning("demo-cleanup: skip %s (%s)", table, exc.__class__.__name__)

        # Sterge contul propriu-zis
        try:
            res = await db.execute(
                text("DELETE FROM accounts WHERE id = :aid"),
                {"aid": account_id},
            )
            counts["accounts"] = res.rowcount or 0
            await db.commit()
        except Exception:
            await db.rollback()
            raise
        log.info("demo-cleanup: COMPLET account_id=%s, counts=%s", account_id, counts)

    return {"existed": True, "counts": counts, "account_id": account_id}
