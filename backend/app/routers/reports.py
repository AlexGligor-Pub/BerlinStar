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


class ItemTypeBreakdown(BaseModel):
    produse: Decimal
    servicii: Decimal


class MonthlyTotal(BaseModel):
    month: str  # "YYYY-MM"
    total: Decimal
    delta_pct: float | None


class LocatiiSummary(BaseModel):
    daily: list[DailyTotal]
    pay_methods: PayMethodBreakdown
    item_types: ItemTypeBreakdown
    monthly: list[MonthlyTotal]
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

    # Produse vs Servicii — din breakdown_daily dimension_type='item_type'
    itype_rows = (await db.execute(
        text(f"""
            SELECT dimension_value AS item_type,
                   SUM(sum_amount) AS total
            FROM report_receipts_breakdown_daily
            WHERE account_id = :acc
              AND dimension_type = 'item_type'
              AND report_date BETWEEN :d1 AND :d2
              {loc_filter}
            GROUP BY dimension_value
        """),
        params,
    )).all()
    itype_map = {r.item_type: r.total or Decimal("0") for r in itype_rows}

    # Monthly aggregates cu delta vs luna anterioară
    monthly_rows = (await db.execute(
        text(f"""
            SELECT to_char(date_trunc('month', report_date), 'YYYY-MM') AS month,
                   SUM(sum_total) AS total
            FROM report_receipts_daily
            WHERE account_id = :acc
              AND report_date BETWEEN :d1 AND :d2
              {loc_filter}
            GROUP BY date_trunc('month', report_date)
            ORDER BY date_trunc('month', report_date)
        """),
        params,
    )).all()
    monthly: list[MonthlyTotal] = []
    prev: Decimal | None = None
    for r in monthly_rows:
        cur = r.total or Decimal("0")
        delta: float | None = None
        if prev is not None and prev > 0:
            delta = float((cur - prev) / prev * 100)
        monthly.append(MonthlyTotal(month=r.month, total=cur, delta_pct=delta))
        prev = cur

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
        item_types=ItemTypeBreakdown(
            produse=itype_map.get("PRODUS", Decimal("0")),
            servicii=itype_map.get("SERVICE", Decimal("0")),
        ),
        monthly=monthly,
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


# ───── Per Employee Detail ────────────────────────────────────────────────────

class EmpDaily(BaseModel):
    report_date: date
    total: Decimal


class EmpDeptTotal(BaseModel):
    department_id: int | None
    department_name: str
    total: Decimal


class EmpCategoryTotal(BaseModel):
    category_id: int | None
    category_name: str
    department_name: str
    total: Decimal


class EmpItemTypes(BaseModel):
    produse: Decimal
    servicii: Decimal
    count_produse: int
    count_servicii: int


class EmpDeptByType(BaseModel):
    department_name: str
    produse_sum: Decimal
    servicii_sum: Decimal
    produse_count: int
    servicii_count: int


class EmpMonthly(BaseModel):
    month: str  # "YYYY-MM"
    total: Decimal
    delta_pct: float | None  # None pentru prima lună


class EmployeeInfo(BaseModel):
    id: int
    name: str
    image_path: str | None
    target: Decimal
    current_target_accumulation: Decimal


class EmployeeReportDetail(BaseModel):
    employee: EmployeeInfo
    period_start: date
    period_end: date
    total: Decimal
    daily: list[EmpDaily]
    departments: list[EmpDeptTotal]
    categories: list[EmpCategoryTotal]
    item_types: EmpItemTypes
    departments_by_type: list[EmpDeptByType]
    monthly: list[EmpMonthly]


@router.get("/employees/{employee_id}", response_model=EmployeeReportDetail)
async def reports_employee_detail(
    employee_id: int,
    date_from: date | None = None,
    date_to: date | None = None,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    """Date detaliate per angajat: line chart zilnic, agregări pe departament/
    categorie/item_type, plus serie lunară cu delta vs luna anterioară.

    Sursa: report_employee_daily (doar bonurile plătite, exclude NEPLATIT).
    """
    if date_from is None or date_to is None:
        d1, d2 = _default_period()
        date_from = date_from or d1
        date_to = date_to or d2

    # Employee info — verificăm că aparține contului
    emp_row = (await db.execute(
        text("""
            SELECT id, name, image_path, target, current_target_accumulation
            FROM employees
            WHERE id = :eid AND account_id = :acc AND is_deleted = false
        """),
        {"eid": employee_id, "acc": account_id},
    )).first()
    if emp_row is None:
        from fastapi import HTTPException
        raise HTTPException(404, "Angajatul nu a fost găsit.")

    params = {"acc": account_id, "eid": employee_id, "d1": date_from, "d2": date_to}

    # Daily totals
    daily_rows = (await db.execute(
        text("""
            SELECT report_date, SUM(sum_amount) AS total
            FROM report_employee_daily
            WHERE account_id = :acc AND employee_id = :eid
              AND report_date BETWEEN :d1 AND :d2
            GROUP BY report_date
            ORDER BY report_date
        """),
        params,
    )).all()

    # Departments
    dept_rows = (await db.execute(
        text("""
            SELECT department_id,
                   COALESCE(department_name, 'Introducere Manuala') AS department_name,
                   SUM(sum_amount) AS total
            FROM report_employee_daily
            WHERE account_id = :acc AND employee_id = :eid
              AND report_date BETWEEN :d1 AND :d2
            GROUP BY department_id, department_name
            HAVING SUM(sum_amount) > 0
            ORDER BY total DESC
        """),
        params,
    )).all()

    # Categories (with department name)
    cat_rows = (await db.execute(
        text("""
            SELECT category_id,
                   COALESCE(category_name, 'Introducere Manuala') AS category_name,
                   COALESCE(department_name, 'Introducere Manuala') AS department_name,
                   SUM(sum_amount) AS total
            FROM report_employee_daily
            WHERE account_id = :acc AND employee_id = :eid
              AND report_date BETWEEN :d1 AND :d2
            GROUP BY category_id, category_name, department_name
            HAVING SUM(sum_amount) > 0
            ORDER BY total DESC
        """),
        params,
    )).all()

    # Item types (produse vs servicii)
    itype_rows = (await db.execute(
        text("""
            SELECT item_type,
                   SUM(sum_amount) AS total,
                   SUM(count_items) AS items
            FROM report_employee_daily
            WHERE account_id = :acc AND employee_id = :eid
              AND report_date BETWEEN :d1 AND :d2
            GROUP BY item_type
        """),
        params,
    )).all()
    itype_map = {r.item_type: (r.total or Decimal("0"), int(r.items or 0)) for r in itype_rows}
    produse_sum, count_produse = itype_map.get("PRODUS", (Decimal("0"), 0))
    servicii_sum, count_servicii = itype_map.get("SERVICE", (Decimal("0"), 0))

    # Departments × item_type
    dept_type_rows = (await db.execute(
        text("""
            SELECT COALESCE(department_name, 'Introducere Manuala') AS department_name,
                   item_type,
                   SUM(sum_amount) AS total,
                   SUM(count_items) AS items
            FROM report_employee_daily
            WHERE account_id = :acc AND employee_id = :eid
              AND report_date BETWEEN :d1 AND :d2
            GROUP BY department_name, item_type
        """),
        params,
    )).all()
    dept_type_map: dict[str, dict] = {}
    for r in dept_type_rows:
        d = dept_type_map.setdefault(r.department_name, {
            "produse_sum": Decimal("0"),
            "servicii_sum": Decimal("0"),
            "produse_count": 0,
            "servicii_count": 0,
        })
        if r.item_type == "PRODUS":
            d["produse_sum"] = r.total or Decimal("0")
            d["produse_count"] = int(r.items or 0)
        elif r.item_type == "SERVICE":
            d["servicii_sum"] = r.total or Decimal("0")
            d["servicii_count"] = int(r.items or 0)

    departments_by_type = [
        EmpDeptByType(department_name=name, **vals)
        for name, vals in sorted(
            dept_type_map.items(),
            key=lambda kv: (kv[1]["produse_sum"] + kv[1]["servicii_sum"]),
            reverse=True,
        )
    ]

    # Monthly aggregates cu delta vs luna anterioară
    monthly_rows = (await db.execute(
        text("""
            SELECT to_char(date_trunc('month', report_date), 'YYYY-MM') AS month,
                   SUM(sum_amount) AS total
            FROM report_employee_daily
            WHERE account_id = :acc AND employee_id = :eid
              AND report_date BETWEEN :d1 AND :d2
            GROUP BY date_trunc('month', report_date)
            ORDER BY date_trunc('month', report_date)
        """),
        params,
    )).all()
    monthly: list[EmpMonthly] = []
    prev: Decimal | None = None
    for r in monthly_rows:
        cur = r.total or Decimal("0")
        delta: float | None = None
        if prev is not None and prev > 0:
            delta = float((cur - prev) / prev * 100)
        monthly.append(EmpMonthly(month=r.month, total=cur, delta_pct=delta))
        prev = cur

    total = sum((r.total or Decimal("0") for r in daily_rows), Decimal("0"))

    return EmployeeReportDetail(
        employee=EmployeeInfo(
            id=emp_row.id,
            name=emp_row.name,
            image_path=emp_row.image_path,
            target=emp_row.target,
            current_target_accumulation=emp_row.current_target_accumulation,
        ),
        period_start=date_from,
        period_end=date_to,
        total=total,
        daily=[EmpDaily(report_date=r.report_date, total=r.total or Decimal("0")) for r in daily_rows],
        departments=[
            EmpDeptTotal(
                department_id=r.department_id,
                department_name=r.department_name,
                total=r.total,
            )
            for r in dept_rows
        ],
        categories=[
            EmpCategoryTotal(
                category_id=r.category_id,
                category_name=r.category_name,
                department_name=r.department_name,
                total=r.total,
            )
            for r in cat_rows
        ],
        item_types=EmpItemTypes(
            produse=produse_sum,
            servicii=servicii_sum,
            count_produse=count_produse,
            count_servicii=count_servicii,
        ),
        departments_by_type=departments_by_type,
        monthly=monthly,
    )
