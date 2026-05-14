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
            report_date, account_id, employee_id, item_type,
            category_id, category_name,
            department_id, department_name,
            sum_amount, count_items, created_at, updated_at
        )
        SELECT
            (r.created_at AT TIME ZONE '{BUCHAREST_TZ}')::date AS report_date,
            r.account_id,
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
        GROUP BY 1, 2, 3, 4, 5, 6, 7, 8
    """)
    result = await db.execute(sql, {"s": period_start, "e": period_end})
    inserted = result.rowcount or 0
    log.info(
        "report_employee_daily build: %s..%s -> rows=%d",
        period_start, period_end, inserted,
    )
    return inserted


# Registru: report_type -> funcție builder
BUILDERS = {
    "receipts_daily": build_receipts_daily,
    "employee_daily": build_employee_daily,
}
