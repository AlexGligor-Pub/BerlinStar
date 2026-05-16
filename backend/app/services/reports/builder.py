"""Builder-ele de rapoarte. Toate funcțiile sunt idempotente:
DELETE pe perioada cerută, apoi INSERT cu agregările fresh.

Itemii adăugați manual din POS (item_id IS NULL, item_type IS NULL) sunt
clasificați în rapoarte cu:
  - item_type = 'SERVICE'
  - category / department = 'Introducere Manuala' (dimension_id NULL)
"""
from __future__ import annotations
import logging
from datetime import date
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

log = logging.getLogger("berlinstar.reports")

BUCHAREST_TZ = "Europe/Bucharest"
MANUAL_LABEL = "Introducere Manuala"


async def build_receipts_daily(
    db: AsyncSession, period_start: date, period_end: date
) -> int:
    """Construiește report_receipts_daily + report_receipts_breakdown_daily."""
    # 1A. pivot pe pay_method
    await db.execute(
        text("DELETE FROM report_receipts_daily WHERE report_date BETWEEN :s AND :e"),
        {"s": period_start, "e": period_end},
    )

    pivot_sql = text(f"""
        INSERT INTO report_receipts_daily (
            report_date, account_id, location_id,
            count_total, count_card, count_cash, count_op, count_partial, count_neplatit,
            sum_total, sum_card, sum_cash, sum_op, sum_partial, sum_neplatit,
            sum_paid, sum_unpaid, created_at, updated_at
        )
        SELECT
            (r.created_at AT TIME ZONE '{BUCHAREST_TZ}')::date AS report_date,
            r.account_id,
            r.location_id,
            COUNT(*) AS count_total,
            COUNT(*) FILTER (WHERE r.pay_method::text = 'CARD') AS count_card,
            COUNT(*) FILTER (WHERE r.pay_method::text = 'CASH') AS count_cash,
            COUNT(*) FILTER (WHERE r.pay_method::text = 'OP') AS count_op,
            COUNT(*) FILTER (WHERE r.pay_method::text = 'PARTIAL') AS count_partial,
            COUNT(*) FILTER (WHERE r.pay_method::text = 'NEPLATIT') AS count_neplatit,
            COALESCE(SUM(r.total), 0) AS sum_total,
            COALESCE(SUM(r.total) FILTER (WHERE r.pay_method::text = 'CARD'), 0) AS sum_card,
            COALESCE(SUM(r.total) FILTER (WHERE r.pay_method::text = 'CASH'), 0) AS sum_cash,
            COALESCE(SUM(r.total) FILTER (WHERE r.pay_method::text = 'OP'), 0) AS sum_op,
            COALESCE(SUM(COALESCE(r.partial_pay, 0)) FILTER (WHERE r.pay_method::text = 'PARTIAL'), 0) AS sum_partial,
            COALESCE(SUM(r.total) FILTER (WHERE r.pay_method::text = 'NEPLATIT'), 0) AS sum_neplatit,
            COALESCE(SUM(
                CASE
                    WHEN r.pay_method::text = 'PARTIAL' THEN COALESCE(r.partial_pay, 0)
                    WHEN r.pay_method::text IN ('CARD', 'CASH', 'OP') THEN r.total
                    ELSE 0
                END
            ), 0) AS sum_paid,
            COALESCE(SUM(r.total) FILTER (WHERE r.pay_method::text = 'NEPLATIT'), 0) AS sum_unpaid,
            NOW(), NOW()
        FROM receipts r
        WHERE r.is_deleted = false
          AND (r.created_at AT TIME ZONE '{BUCHAREST_TZ}')::date BETWEEN :s AND :e
        GROUP BY 1, 2, 3
    """)
    pivot_result = await db.execute(pivot_sql, {"s": period_start, "e": period_end})
    pivot_inserted = pivot_result.rowcount or 0

    # 1B. breakdown long-format (item_type, category, department).
    # LEFT JOIN pe items/categories/departments — itemii manuali (item_id IS NULL)
    # apar cu dimension_id NULL și label "Introducere Manuala".
    # Itemii catalog cu item_type NULL (istoric pre-backfill) sunt tratați ca SERVICE.
    await db.execute(
        text("DELETE FROM report_receipts_breakdown_daily WHERE report_date BETWEEN :s AND :e"),
        {"s": period_start, "e": period_end},
    )

    breakdown_sql = text(f"""
        INSERT INTO report_receipts_breakdown_daily (
            report_date, account_id, location_id,
            dimension_type, dimension_id, dimension_value,
            sum_amount, count_items, created_at, updated_at
        )
        SELECT report_date, account_id, location_id,
               dimension_type, dimension_id, dimension_value,
               sum_amount, count_items, NOW(), NOW()
        FROM (
            -- a) item_type (manual -> SERVICE)
            SELECT
                (r.created_at AT TIME ZONE '{BUCHAREST_TZ}')::date AS report_date,
                r.account_id, r.location_id,
                'item_type' AS dimension_type,
                NULL::int AS dimension_id,
                COALESCE(ri.item_type::text, 'SERVICE') AS dimension_value,
                COALESCE(SUM(ri.price * ri.qty), 0) AS sum_amount,
                COALESCE(SUM(ri.qty), 0) AS count_items
            FROM receipts r
            JOIN receipt_items ri ON ri.receipt_id = r.id
            WHERE r.is_deleted = false
              AND (r.created_at AT TIME ZONE '{BUCHAREST_TZ}')::date BETWEEN :s AND :e
            GROUP BY 1, 2, 3, 4, 5, 6

            UNION ALL

            -- b) category (manual -> "Introducere Manuala", dimension_id NULL)
            SELECT
                (r.created_at AT TIME ZONE '{BUCHAREST_TZ}')::date,
                r.account_id, r.location_id,
                'category',
                c.id,
                CASE WHEN ri.item_id IS NULL THEN '{MANUAL_LABEL}' ELSE c.name END,
                COALESCE(SUM(ri.price * ri.qty), 0),
                COALESCE(SUM(ri.qty), 0)
            FROM receipts r
            JOIN receipt_items ri ON ri.receipt_id = r.id
            LEFT JOIN items i ON i.id = ri.item_id
            LEFT JOIN categories c ON c.id = i.category_id
            WHERE r.is_deleted = false
              AND (r.created_at AT TIME ZONE '{BUCHAREST_TZ}')::date BETWEEN :s AND :e
            GROUP BY 1, 2, 3, 4, 5, 6

            UNION ALL

            -- c) department (manual -> "Introducere Manuala", dimension_id NULL)
            SELECT
                (r.created_at AT TIME ZONE '{BUCHAREST_TZ}')::date,
                r.account_id, r.location_id,
                'department',
                d.id,
                CASE WHEN ri.item_id IS NULL THEN '{MANUAL_LABEL}' ELSE d.name END,
                COALESCE(SUM(ri.price * ri.qty), 0),
                COALESCE(SUM(ri.qty), 0)
            FROM receipts r
            JOIN receipt_items ri ON ri.receipt_id = r.id
            LEFT JOIN items i ON i.id = ri.item_id
            LEFT JOIN categories c ON c.id = i.category_id
            LEFT JOIN departments d ON d.id = c.department_id
            WHERE r.is_deleted = false
              AND (r.created_at AT TIME ZONE '{BUCHAREST_TZ}')::date BETWEEN :s AND :e
            GROUP BY 1, 2, 3, 4, 5, 6
        ) breakdown
    """)
    breakdown_result = await db.execute(breakdown_sql, {"s": period_start, "e": period_end})
    breakdown_inserted = breakdown_result.rowcount or 0

    total = pivot_inserted + breakdown_inserted
    log.info(
        "report_receipts_daily build: %s..%s -> pivot=%d, breakdown=%d",
        period_start, period_end, pivot_inserted, breakdown_inserted,
    )
    return total


async def build_employee_daily(
    db: AsyncSession, period_start: date, period_end: date
) -> int:
    """Construiește report_employee_daily — per (zi, employee, item_type, categorie, departament).

    Itemii manuali apar cu item_type='SERVICE', category_name='Introducere Manuala',
    department_name='Introducere Manuala' (category_id și department_id rămân NULL).
    """
    await db.execute(
        text("DELETE FROM report_employee_daily WHERE report_date BETWEEN :s AND :e"),
        {"s": period_start, "e": period_end},
    )

    sql = text(f"""
        INSERT INTO report_employee_daily (
            report_date, account_id, location_id, employee_id, item_type,
            category_id, category_name,
            department_id, department_name,
            sum_amount, count_items, created_at, updated_at
        )
        SELECT
            (r.created_at AT TIME ZONE '{BUCHAREST_TZ}')::date AS report_date,
            r.account_id,
            r.location_id,
            ri.employee_id,
            COALESCE(ri.item_type::text, 'SERVICE') AS item_type,
            c.id AS category_id,
            CASE WHEN ri.item_id IS NULL THEN '{MANUAL_LABEL}' ELSE c.name END AS category_name,
            d.id AS department_id,
            CASE WHEN ri.item_id IS NULL THEN '{MANUAL_LABEL}' ELSE d.name END AS department_name,
            COALESCE(SUM(ri.price * ri.qty), 0) AS sum_amount,
            COALESCE(SUM(ri.qty), 0) AS count_items,
            NOW(), NOW()
        FROM receipts r
        JOIN receipt_items ri ON ri.receipt_id = r.id
        LEFT JOIN items i ON i.id = ri.item_id
        LEFT JOIN categories c ON c.id = i.category_id
        LEFT JOIN departments d ON d.id = c.department_id
        WHERE r.is_deleted = false
          AND r.pay_method::text <> 'NEPLATIT'
          AND (r.created_at AT TIME ZONE '{BUCHAREST_TZ}')::date BETWEEN :s AND :e
        GROUP BY 1, 2, 3, 4, 5, 6, 7, 8, 9
    """)
    result = await db.execute(sql, {"s": period_start, "e": period_end})
    inserted = result.rowcount or 0
    log.info(
        "report_employee_daily build: %s..%s -> rows=%d",
        period_start, period_end, inserted,
    )
    return inserted


async def build_cazari_daily(
    db: AsyncSession, period_start: date, period_end: date
) -> int:
    """Construiește report_cazari_daily — agregare per (zi, account, location,
    employee) cu contoare de check-in/check-out și anvelope mișcate.

    O cazare cu check-in într-o zi și check-out în alta produce două rânduri
    (unul în ziua intrării, unul în ziua ieșirii). `report_date` e data
    calendaristică Europe/Bucharest a evenimentului (data_checkin / data_checkout
    sunt deja Date, fără timezone — le luăm direct).

    Snapshot-ul „cazări active acum" NU se calculează aici; vezi endpoint-ul
    /api/reports/hotel-anvelope care îl ia live din cazari_anvelope.
    """
    await db.execute(
        text("DELETE FROM report_cazari_daily WHERE report_date BETWEEN :s AND :e"),
        {"s": period_start, "e": period_end},
    )

    sql = text("""
        INSERT INTO report_cazari_daily (
            report_date, account_id, location_id, employee_id,
            count_checkins, count_checkouts, count_checkouts_montate,
            count_anvelope_in, count_anvelope_out,
            created_at, updated_at
        )
        SELECT report_date, account_id, location_id, employee_id,
               SUM(is_checkin)         AS count_checkins,
               SUM(is_checkout)        AS count_checkouts,
               SUM(is_checkout_montat) AS count_checkouts_montate,
               SUM(nr_in)              AS count_anvelope_in,
               SUM(nr_out)             AS count_anvelope_out,
               NOW(), NOW()
        FROM (
            -- a) evenimente de check-in (în ziua data_checkin)
            SELECT c.data_checkin AS report_date,
                   c.account_id, c.location_id, c.employee_id,
                   1 AS is_checkin, 0 AS is_checkout, 0 AS is_checkout_montat,
                   COALESCE(items.nr, 0) AS nr_in, 0 AS nr_out
            FROM cazari_anvelope c
            LEFT JOIN (
                SELECT cazare_id, COUNT(*) AS nr
                FROM cazare_anvelope_items
                GROUP BY cazare_id
            ) items ON items.cazare_id = c.id
            WHERE c.is_deleted = false
              AND c.data_checkin BETWEEN :s AND :e

            UNION ALL

            -- b) evenimente de check-out (în ziua data_checkout)
            SELECT c.data_checkout AS report_date,
                   c.account_id, c.location_id, c.employee_id,
                   0, 1,
                   CASE WHEN c.montate_pe_masina THEN 1 ELSE 0 END,
                   0, COALESCE(items.nr, 0)
            FROM cazari_anvelope c
            LEFT JOIN (
                SELECT cazare_id, COUNT(*) AS nr
                FROM cazare_anvelope_items
                GROUP BY cazare_id
            ) items ON items.cazare_id = c.id
            WHERE c.is_deleted = false
              AND c.data_checkout IS NOT NULL
              AND c.data_checkout BETWEEN :s AND :e
        ) events
        GROUP BY report_date, account_id, location_id, employee_id
    """)
    result = await db.execute(sql, {"s": period_start, "e": period_end})
    inserted = result.rowcount or 0
    log.info(
        "report_cazari_daily build: %s..%s -> rows=%d",
        period_start, period_end, inserted,
    )
    return inserted


async def build_clients_daily(
    db: AsyncSession, period_start: date, period_end: date
) -> int:
    """Construiește report_clients_daily — agregare per (zi, account, location,
    client) cu suma plătită, total bonuri și flag `is_first_visit`.

    `is_first_visit` e true în ziua în care client_id apare pentru prima dată în
    `receipts` (calculat global, indiferent de perioadă, prin sub-query pe
    MIN(report_date)). Bonurile fără `client_id` (walk-in) sunt incluse cu
    client_id NULL.
    """
    await db.execute(
        text("DELETE FROM report_clients_daily WHERE report_date BETWEEN :s AND :e"),
        {"s": period_start, "e": period_end},
    )

    sql = text(f"""
        INSERT INTO report_clients_daily (
            report_date, account_id, location_id, client_id,
            sum_paid, sum_total, count_receipts, is_first_visit,
            created_at, updated_at
        )
        SELECT
            agg.report_date,
            agg.account_id,
            agg.location_id,
            agg.client_id,
            agg.sum_paid,
            agg.sum_total,
            agg.count_receipts,
            CASE
                WHEN agg.client_id IS NULL THEN false
                WHEN fv.first_date = agg.report_date THEN true
                ELSE false
            END AS is_first_visit,
            NOW(), NOW()
        FROM (
            SELECT
                (r.created_at AT TIME ZONE '{BUCHAREST_TZ}')::date AS report_date,
                r.account_id,
                r.location_id,
                r.client_id,
                COALESCE(SUM(
                    CASE
                        WHEN r.pay_method::text = 'PARTIAL' THEN COALESCE(r.partial_pay, 0)
                        WHEN r.pay_method::text IN ('CARD', 'CASH', 'OP') THEN r.total
                        ELSE 0
                    END
                ), 0) AS sum_paid,
                COALESCE(SUM(r.total), 0) AS sum_total,
                COUNT(*) AS count_receipts
            FROM receipts r
            WHERE r.is_deleted = false
              AND (r.created_at AT TIME ZONE '{BUCHAREST_TZ}')::date BETWEEN :s AND :e
            GROUP BY 1, 2, 3, 4
        ) agg
        LEFT JOIN (
            SELECT r.client_id,
                   MIN((r.created_at AT TIME ZONE '{BUCHAREST_TZ}')::date) AS first_date
            FROM receipts r
            WHERE r.is_deleted = false AND r.client_id IS NOT NULL
            GROUP BY r.client_id
        ) fv ON fv.client_id = agg.client_id
    """)
    result = await db.execute(sql, {"s": period_start, "e": period_end})
    inserted = result.rowcount or 0
    log.info(
        "report_clients_daily build: %s..%s -> rows=%d",
        period_start, period_end, inserted,
    )
    return inserted


async def build_programari_daily(
    db: AsyncSession, period_start: date, period_end: date
) -> int:
    """Construiește report_programari_daily — agregare per
    (zi, account, location, hour_slot) cu pivot pe status, sumă lead-time
    (zile între created_at și start_time) și nr. programări legate de bon.

    Statusul programări e stocat ca valoarea enum (vezi
    `ProgramareStatus.value`: 'Programat', 'In lucru', 'Executat', 'Anulat').
    """
    await db.execute(
        text("DELETE FROM report_programari_daily WHERE report_date BETWEEN :s AND :e"),
        {"s": period_start, "e": period_end},
    )

    sql = text(f"""
        INSERT INTO report_programari_daily (
            report_date, account_id, location_id, hour_slot,
            count_total, count_programat, count_in_lucru, count_executat, count_anulat,
            count_with_receipt, sum_lead_time_days,
            created_at, updated_at
        )
        SELECT
            (p.start_time AT TIME ZONE '{BUCHAREST_TZ}')::date AS report_date,
            p.account_id,
            p.location_id,
            EXTRACT(HOUR FROM (p.start_time AT TIME ZONE '{BUCHAREST_TZ}'))::int AS hour_slot,
            COUNT(*) AS count_total,
            COUNT(*) FILTER (WHERE p.status::text = 'Programat') AS count_programat,
            COUNT(*) FILTER (WHERE p.status::text = 'In lucru')  AS count_in_lucru,
            COUNT(*) FILTER (WHERE p.status::text = 'Executat')  AS count_executat,
            COUNT(*) FILTER (WHERE p.status::text = 'Anulat')    AS count_anulat,
            COUNT(*) FILTER (WHERE rcv.programare_id IS NOT NULL) AS count_with_receipt,
            COALESCE(SUM(
                GREATEST(
                    ((p.start_time AT TIME ZONE '{BUCHAREST_TZ}')::date
                     - (p.created_at AT TIME ZONE '{BUCHAREST_TZ}')::date),
                    0
                )
            ), 0)::int AS sum_lead_time_days,
            NOW(), NOW()
        FROM programari p
        LEFT JOIN (
            SELECT DISTINCT programare_id
            FROM receipts
            WHERE programare_id IS NOT NULL AND is_deleted = false
        ) rcv ON rcv.programare_id = p.id
        WHERE p.is_deleted = false
          AND (p.start_time AT TIME ZONE '{BUCHAREST_TZ}')::date BETWEEN :s AND :e
        GROUP BY 1, 2, 3, 4
    """)
    result = await db.execute(sql, {"s": period_start, "e": period_end})
    inserted = result.rowcount or 0
    log.info(
        "report_programari_daily build: %s..%s -> rows=%d",
        period_start, period_end, inserted,
    )
    return inserted


async def build_stock_movements_daily(
    db: AsyncSession, period_start: date, period_end: date
) -> int:
    """Agregare zilnica a `stock_movements` pe (account, locatie, produs, angajat, tip).

    Granularitate fina pentru a permite filtre flexibile in Rapoarte: top produse
    vandute, vanzari per angajat, intrari de marfa, ajustari. Idempotent —
    DELETE pe perioada ceruta, apoi INSERT proaspat.
    """
    await db.execute(
        text("DELETE FROM report_stock_movements_daily WHERE report_date BETWEEN :s AND :e"),
        {"s": period_start, "e": period_end},
    )

    insert_sql = text(f"""
        INSERT INTO report_stock_movements_daily (
            report_date, account_id, location_id, item_id, item_name,
            employee_id, movement_type,
            qty_total, qty_delta_total, valoare_vanzare, valoare_cost,
            nr_movements, created_at, updated_at
        )
        SELECT
            (sm.created_at AT TIME ZONE '{BUCHAREST_TZ}')::date AS report_date,
            sm.account_id,
            sm.location_id,
            sm.item_id,
            MAX(sm.item_name) AS item_name,
            sm.employee_id,
            sm.movement_type,
            COALESCE(SUM(ABS(sm.qty_delta)), 0) AS qty_total,
            COALESCE(SUM(sm.qty_delta), 0) AS qty_delta_total,
            COALESCE(SUM(ABS(sm.qty_delta) * COALESCE(sm.unit_price, 0)), 0) AS valoare_vanzare,
            COALESCE(SUM(ABS(sm.qty_delta) * COALESCE(sm.unit_cost, 0)), 0) AS valoare_cost,
            COUNT(*) AS nr_movements,
            NOW(), NOW()
        FROM stock_movements sm
        WHERE (sm.created_at AT TIME ZONE '{BUCHAREST_TZ}')::date BETWEEN :s AND :e
        GROUP BY 1, 2, 3, 4, 6, 7
    """)
    result = await db.execute(insert_sql, {"s": period_start, "e": period_end})
    inserted = result.rowcount or 0
    log.info(
        "report_stock_movements_daily build: %s..%s -> %d randuri",
        period_start, period_end, inserted,
    )
    return inserted


# Registru: report_type -> funcție builder
BUILDERS = {
    "receipts_daily": build_receipts_daily,
    "employee_daily": build_employee_daily,
    "cazari_daily": build_cazari_daily,
    "clients_daily": build_clients_daily,
    "programari_daily": build_programari_daily,
    "stock_movements_daily": build_stock_movements_daily,
}
