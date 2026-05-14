"""Rapoarte vizibile per utilizator (autentificare JWT user, nu admin).

Citesc datele agregate din tabelele report_* care sunt populate de worker-ul
programat (vezi app/services/reports/).
"""
from __future__ import annotations
from datetime import date, timedelta
from decimal import Decimal
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_account_id

router = APIRouter()


class DailyTotal(BaseModel):
    report_date: date
    sum_total: Decimal
    sum_paid: Decimal
    sum_unpaid: Decimal
    count_total: int


class PayMethodBreakdown(BaseModel):
    sum_card: Decimal
    sum_cash: Decimal
    sum_op: Decimal
    sum_partial: Decimal
    sum_neplatit: Decimal
    sum_paid: Decimal
    sum_unpaid: Decimal


class LocatiiSummary(BaseModel):
    daily: list[DailyTotal]
    pay_methods: PayMethodBreakdown
    total: Decimal
    bonuri: int
    period_start: date | None
    period_end: date | None


def _default_period() -> tuple[date, date]:
    today = date.today()
    return today.replace(day=1), today


@router.get("/locatii", response_model=LocatiiSummary)
async def reports_locatii(
    date_from: date | None = None,
    date_to: date | None = None,
    location_id: int | None = None,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    """Date pentru secțiunea Locații: line chart cu sum_total zilnic +
    donut cu defalcarea pe pay_method.

    Parametri:
    - date_from / date_to: filtre opționale (Europe/Bucharest). Default = luna curentă.
    - location_id: filtru opțional. Lipsa = toate locațiile.
    """
    if date_from is None or date_to is None:
        d1, d2 = _default_period()
        date_from = date_from or d1
        date_to = date_to or d2

    params = {"acc": account_id, "d1": date_from, "d2": date_to}
    loc_filter = ""
    if location_id is not None:
        params["loc"] = location_id
        loc_filter = "AND location_id = :loc"

    daily_rows = (await db.execute(
        text(f"""
            SELECT report_date,
                   SUM(sum_total)   AS sum_total,
                   SUM(sum_paid)    AS sum_paid,
                   SUM(sum_unpaid)  AS sum_unpaid,
                   SUM(count_total) AS count_total
            FROM report_receipts_daily
            WHERE account_id = :acc
              AND report_date BETWEEN :d1 AND :d2
              {loc_filter}
            GROUP BY report_date
            ORDER BY report_date
        """),
        params,
    )).all()

    totals_row = (await db.execute(
        text(f"""
            SELECT
                COALESCE(SUM(sum_card),     0) AS sum_card,
                COALESCE(SUM(sum_cash),     0) AS sum_cash,
                COALESCE(SUM(sum_op),       0) AS sum_op,
                COALESCE(SUM(sum_partial),  0) AS sum_partial,
                COALESCE(SUM(sum_neplatit), 0) AS sum_neplatit,
                COALESCE(SUM(sum_paid),     0) AS sum_paid,
                COALESCE(SUM(sum_unpaid),   0) AS sum_unpaid,
                COALESCE(SUM(sum_total),    0) AS total,
                COALESCE(SUM(count_total),  0) AS bonuri
            FROM report_receipts_daily
            WHERE account_id = :acc
              AND report_date BETWEEN :d1 AND :d2
              {loc_filter}
        """),
        params,
    )).one()

    daily = [
        DailyTotal(
            report_date=r.report_date,
            sum_total=r.sum_total or Decimal("0"),
            sum_paid=r.sum_paid or Decimal("0"),
            sum_unpaid=r.sum_unpaid or Decimal("0"),
            count_total=int(r.count_total or 0),
        )
        for r in daily_rows
    ]

    return LocatiiSummary(
        daily=daily,
        pay_methods=PayMethodBreakdown(
            sum_card=totals_row.sum_card,
            sum_cash=totals_row.sum_cash,
            sum_op=totals_row.sum_op,
            sum_partial=totals_row.sum_partial,
            sum_neplatit=totals_row.sum_neplatit,
            sum_paid=totals_row.sum_paid,
            sum_unpaid=totals_row.sum_unpaid,
        ),
        total=totals_row.total,
        bonuri=int(totals_row.bonuri),
        period_start=date_from,
        period_end=date_to,
    )


class DepartmentTotal(BaseModel):
    department_id: int | None
    department_name: str
    total: Decimal


class CategoryTotal(BaseModel):
    category_id: int | None
    category_name: str
    department_id: int | None
    department_name: str
    total: Decimal


class EmployeeTotal(BaseModel):
    employee_id: int | None
    employee_name: str
    total: Decimal


class ProduseServiciiSummary(BaseModel):
    departments: list[DepartmentTotal]
    categories: list[CategoryTotal]
    employees: list[EmployeeTotal]
    period_start: date
    period_end: date


@router.get("/produse-servicii", response_model=ProduseServiciiSummary)
async def reports_produse_servicii(
    date_from: date | None = None,
    date_to: date | None = None,
    location_id: int | None = None,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    """Date pentru secțiunea Produse/Servicii: agregări pe departament,
    categorie (tip serviciu) și angajat.

    Sursele:
    - departments: report_receipts_breakdown_daily (dimension_type='department')
    - categories: report_receipts_breakdown_daily (dimension_type='category')
      + JOIN cu items/categories/departments pentru a recupera departamentul părinte
    - employees: report_employee_daily (DOAR receipts plătite — pay_method != NEPLATIT)
    """
    if date_from is None or date_to is None:
        d1, d2 = _default_period()
        date_from = date_from or d1
        date_to = date_to or d2

    params = {"acc": account_id, "d1": date_from, "d2": date_to}
    loc_filter = ""
    if location_id is not None:
        params["loc"] = location_id
        loc_filter = "AND location_id = :loc"

    # Departments (incluzând "Introducere Manuala" cu dimension_id NULL)
    dept_rows = (await db.execute(
        text(f"""
            SELECT dimension_id AS department_id,
                   dimension_value AS department_name,
                   SUM(sum_amount) AS total
            FROM report_receipts_breakdown_daily
            WHERE account_id = :acc
              AND dimension_type = 'department'
              AND report_date BETWEEN :d1 AND :d2
              {loc_filter}
            GROUP BY dimension_id, dimension_value
            HAVING SUM(sum_amount) > 0
            ORDER BY total DESC
        """),
        params,
    )).all()

    # Categories cu informația departamentului părinte
    cat_rows = (await db.execute(
        text(f"""
            SELECT b.dimension_id AS category_id,
                   b.dimension_value AS category_name,
                   d.id AS department_id,
                   COALESCE(d.name, 'Introducere Manuala') AS department_name,
                   SUM(b.sum_amount) AS total
            FROM report_receipts_breakdown_daily b
            LEFT JOIN categories c ON c.id = b.dimension_id
            LEFT JOIN departments d ON d.id = c.department_id
            WHERE b.account_id = :acc
              AND b.dimension_type = 'category'
              AND b.report_date BETWEEN :d1 AND :d2
              {loc_filter}
            GROUP BY b.dimension_id, b.dimension_value, d.id, d.name
            HAVING SUM(b.sum_amount) > 0
            ORDER BY total DESC
        """),
        params,
    )).all()

    # Employees (din report_employee_daily — doar plătite)
    emp_rows = (await db.execute(
        text("""
            SELECT r.employee_id,
                   COALESCE(e.name, 'Fără angajat') AS employee_name,
                   SUM(r.sum_amount) AS total
            FROM report_employee_daily r
            LEFT JOIN employees e ON e.id = r.employee_id
            WHERE r.account_id = :acc
              AND r.report_date BETWEEN :d1 AND :d2
            GROUP BY r.employee_id, e.name
            HAVING SUM(r.sum_amount) > 0
            ORDER BY total DESC
        """),
        {"acc": account_id, "d1": date_from, "d2": date_to},
    )).all()

    return ProduseServiciiSummary(
        departments=[
            DepartmentTotal(
                department_id=r.department_id,
                department_name=r.department_name or "Introducere Manuala",
                total=r.total,
            )
            for r in dept_rows
        ],
        categories=[
            CategoryTotal(
                category_id=r.category_id,
                category_name=r.category_name or "Introducere Manuala",
                department_id=r.department_id,
                department_name=r.department_name or "Introducere Manuala",
                total=r.total,
            )
            for r in cat_rows
        ],
        employees=[
            EmployeeTotal(
                employee_id=r.employee_id,
                employee_name=r.employee_name,
                total=r.total,
            )
            for r in emp_rows
        ],
        period_start=date_from,
        period_end=date_to,
    )
