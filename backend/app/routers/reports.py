"""Rapoarte vizibile per utilizator (autentificare JWT user, nu admin).

Citesc datele agregate din tabelele report_* care sunt populate de worker-ul
programat (vezi app/services/reports/).
"""
from __future__ import annotations
from calendar import monthrange
from datetime import date, datetime, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo
from fastapi import APIRouter, Depends, Query
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
    location_ids: list[int] | None = Query(None),
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    """Date pentru secțiunea Locații: line chart cu sum_total zilnic +
    donut cu defalcarea pe pay_method.

    Parametri:
    - date_from / date_to: filtre opționale (Europe/Bucharest). Default = luna curentă.
    - location_ids: listă de id-uri (`?location_ids=1&location_ids=2`).
      Lipsa = toate locațiile. `location_id` (singular) este păstrat pentru compat.
    """
    if date_from is None or date_to is None:
        d1, d2 = _default_period()
        date_from = date_from or d1
        date_to = date_to or d2

    # Unim location_id (singular, compat) + location_ids (multi)
    loc_list: list[int] = list(location_ids) if location_ids else []
    if location_id is not None and location_id not in loc_list:
        loc_list.append(location_id)

    params: dict = {"acc": account_id, "d1": date_from, "d2": date_to}
    loc_filter = ""
    if loc_list:
        params["loc_ids"] = loc_list
        loc_filter = "AND location_id = ANY(:loc_ids)"

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


class EmployeeMonthContribution(BaseModel):
    employee_id: int | None
    employee_name: str
    image_path: str | None
    target: Decimal
    sum_amount: Decimal
    count_items: int
    contribution_pct: float
    target_progress_pct: float


class MonthContribution(BaseModel):
    month: str  # "YYYY-MM"
    period_start: date
    period_end: date
    total: Decimal
    employees: list[EmployeeMonthContribution]


class ContributiiAngajatiSummary(BaseModel):
    months: list[MonthContribution]  # [0]=curent, [1]=-1, [2]=-2


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
    location_ids: list[int] | None = Query(None),
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

    Notă: filtrul `location_ids` se aplică doar la departments + categories
    (tabela report_employee_daily nu are coloana location_id).
    """
    if date_from is None or date_to is None:
        d1, d2 = _default_period()
        date_from = date_from or d1
        date_to = date_to or d2

    loc_list: list[int] = list(location_ids) if location_ids else []
    if location_id is not None and location_id not in loc_list:
        loc_list.append(location_id)

    params: dict = {"acc": account_id, "d1": date_from, "d2": date_to}
    loc_filter = ""
    if loc_list:
        params["loc_ids"] = loc_list
        loc_filter = "AND location_id = ANY(:loc_ids)"

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

    # Employees (din report_employee_daily — doar plătite). Filtrul de locații
    # se aplică acum și aici, după migrarea care adaugă location_id pe tabel.
    emp_params: dict = {"acc": account_id, "d1": date_from, "d2": date_to}
    emp_loc_filter = ""
    if loc_list:
        emp_params["loc_ids"] = loc_list
        emp_loc_filter = "AND r.location_id = ANY(:loc_ids)"
    emp_rows = (await db.execute(
        text(f"""
            SELECT r.employee_id,
                   COALESCE(e.name, 'Fără angajat') AS employee_name,
                   SUM(r.sum_amount) AS total
            FROM report_employee_daily r
            LEFT JOIN employees e ON e.id = r.employee_id
            WHERE r.account_id = :acc
              AND r.report_date BETWEEN :d1 AND :d2
              {emp_loc_filter}
            GROUP BY r.employee_id, e.name
            HAVING SUM(r.sum_amount) > 0
            ORDER BY total DESC
        """),
        emp_params,
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


class EmpLocationTotal(BaseModel):
    location_id: int | None
    location_name: str
    total: Decimal


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
    locations: list[EmpLocationTotal]


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

    # Per locație (donut contribuție). Datele rămân NULL pentru rândurile vechi
    # până la weekly_refresh al raportului employee_daily.
    loc_rows = (await db.execute(
        text("""
            SELECT r.location_id,
                   COALESCE(l.name, 'Fără locație') AS location_name,
                   SUM(r.sum_amount) AS total
            FROM report_employee_daily r
            LEFT JOIN locations l ON l.id = r.location_id
            WHERE r.account_id = :acc AND r.employee_id = :eid
              AND r.report_date BETWEEN :d1 AND :d2
            GROUP BY r.location_id, l.name
            HAVING SUM(r.sum_amount) > 0
            ORDER BY total DESC
        """),
        params,
    )).all()
    locations = [
        EmpLocationTotal(
            location_id=r.location_id,
            location_name=r.location_name,
            total=r.total or Decimal("0"),
        )
        for r in loc_rows
    ]

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
        locations=locations,
    )


# ───── Contribuție angajați (ultimele 3 luni) ────────────────────────────────

def _last_three_months_bucharest() -> list[tuple[str, date, date]]:
    """Întoarce [(month_label, period_start, period_end), ...] pentru luna
    curentă, luna trecută și acum 2 luni, în Europe/Bucharest.

    month_label e "YYYY-MM"; period_start = ziua 1, period_end = ultima zi.
    """
    today = datetime.now(ZoneInfo("Europe/Bucharest")).date()
    months: list[tuple[str, date, date]] = []
    y, m = today.year, today.month
    for _ in range(3):
        start = date(y, m, 1)
        end = date(y, m, monthrange(y, m)[1])
        months.append((f"{y:04d}-{m:02d}", start, end))
        m -= 1
        if m == 0:
            m = 12
            y -= 1
    return months


@router.get("/contributii-angajati", response_model=ContributiiAngajatiSummary)
async def reports_contributii_angajati(
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    """Contribuția per angajat pe ultimele 3 luni (curentă, -1, -2) în
    Europe/Bucharest.

    Sursa: report_employee_daily — exclude receipts NEPLATIT (vezi builder).
    Targetul afișat este valoarea curentă din employees.target (nu istoric).
    Angajații fără activitate într-o lună nu apar pentru acea lună.
    """
    months_def = _last_three_months_bucharest()
    overall_start = months_def[-1][1]
    overall_end = months_def[0][2]

    rows = (await db.execute(
        text("""
            SELECT to_char(date_trunc('month', r.report_date), 'YYYY-MM') AS month,
                   r.employee_id AS employee_id,
                   COALESCE(e.name, 'Fără angajat') AS employee_name,
                   e.image_path AS image_path,
                   COALESCE(e.target, 0) AS target,
                   SUM(r.sum_amount) AS sum_amount,
                   SUM(r.count_items) AS count_items
            FROM report_employee_daily r
            LEFT JOIN employees e ON e.id = r.employee_id
            WHERE r.account_id = :acc
              AND r.report_date BETWEEN :d1 AND :d2
            GROUP BY 1, r.employee_id, e.name, e.image_path, e.target
        """),
        {"acc": account_id, "d1": overall_start, "d2": overall_end},
    )).all()

    by_month: dict[str, list] = {label: [] for label, _, _ in months_def}
    for r in rows:
        if r.month in by_month:
            by_month[r.month].append(r)

    months_out: list[MonthContribution] = []
    for label, start, end in months_def:
        rs = by_month.get(label, [])
        total = sum((r.sum_amount or Decimal("0") for r in rs), Decimal("0"))
        emps: list[EmployeeMonthContribution] = []
        for r in rs:
            amt = r.sum_amount or Decimal("0")
            tgt = r.target or Decimal("0")
            contribution_pct = float(amt / total * 100) if total > 0 else 0.0
            target_progress_pct = float(amt / tgt * 100) if tgt > 0 else 0.0
            emps.append(EmployeeMonthContribution(
                employee_id=r.employee_id,
                employee_name=r.employee_name,
                image_path=r.image_path,
                target=tgt,
                sum_amount=amt,
                count_items=int(r.count_items or 0),
                contribution_pct=contribution_pct,
                target_progress_pct=target_progress_pct,
            ))
        emps.sort(key=lambda x: x.sum_amount, reverse=True)
        months_out.append(MonthContribution(
            month=label,
            period_start=start,
            period_end=end,
            total=total,
            employees=emps,
        ))

    return ContributiiAngajatiSummary(months=months_out)


# ───── Hotel Anvelope ─────────────────────────────────────────────────────────

class AnvelopeLocationActive(BaseModel):
    location_id: int | None
    location_name: str
    cazari_active: int
    anvelope_depozitate: int


class AnvelopeLocCazareActive(BaseModel):
    location_id: int | None
    location_name: str
    loc_cazare_id: int | None
    loc_cazare_nume: str
    cazari_active: int
    anvelope_depozitate: int


class AnvelopeMonthly(BaseModel):
    month: str  # "YYYY-MM"
    checkins: int
    checkouts: int
    checkouts_montate: int
    anvelope_in: int
    anvelope_out: int


class AnvelopeEmployeeTotal(BaseModel):
    employee_id: int | None
    employee_name: str
    image_path: str | None
    count_checkins: int
    count_checkouts: int


class AnvelopeEmployeeLocation(BaseModel):
    employee_id: int | None
    employee_name: str
    location_id: int | None
    location_name: str
    count_checkouts: int


class AnvelopeKpi(BaseModel):
    cazari_active_total: int
    anvelope_depozitate_total: int
    intrari_perioada: int
    iesiri_perioada: int
    iesiri_montate_perioada: int


class HotelAnvelopeSummary(BaseModel):
    kpi: AnvelopeKpi
    active_per_location: list[AnvelopeLocationActive]
    active_per_loc_cazare: list[AnvelopeLocCazareActive]
    monthly: list[AnvelopeMonthly]
    per_employee: list[AnvelopeEmployeeTotal]
    per_employee_location: list[AnvelopeEmployeeLocation]
    period_start: date
    period_end: date


@router.get("/hotel-anvelope", response_model=HotelAnvelopeSummary)
async def reports_hotel_anvelope(
    date_from: date | None = None,
    date_to: date | None = None,
    location_ids: list[int] | None = Query(None),
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    """Date pentru secțiunea „Hotel Anvelope":
    - snapshot live (cazări active acum + anvelope depozitate) per locație
    - serii lunare cu intrări/ieșiri/anvelope-montate (din report_cazari_daily)
    - top angajați după nr. cazări procesate
    - matrice angajat × locație pentru scoateri (din report_cazari_daily)

    Filtrul `location_ids` se aplică atât snapshot-ului cât și seriilor.
    """
    if date_from is None or date_to is None:
        d1, d2 = _default_period()
        date_from = date_from or d1
        date_to = date_to or d2

    loc_list: list[int] = list(location_ids) if location_ids else []
    params: dict = {"acc": account_id, "d1": date_from, "d2": date_to}
    # Filtre prefixate explicit ca să evităm ambiguitatea coloanei `location_id`
    # în query-urile cu JOIN-uri (cazari_anvelope vs. report_cazari_daily).
    loc_filter_c = ""  # alias `c` (cazari_anvelope)
    loc_filter_r = ""  # alias `r` (report_cazari_daily)
    if loc_list:
        params["loc_ids"] = loc_list
        loc_filter_c = "AND c.location_id = ANY(:loc_ids)"
        loc_filter_r = "AND r.location_id = ANY(:loc_ids)"

    # Snapshot live: cazări active acum + nr anvelope depozitate per locație
    active_rows = (await db.execute(
        text(f"""
            SELECT c.location_id,
                   COALESCE(l.name, 'Fără locație') AS location_name,
                   COUNT(*) AS cazari_active,
                   COALESCE(SUM(items.nr), 0) AS anvelope_depozitate
            FROM cazari_anvelope c
            LEFT JOIN locations l ON l.id = c.location_id
            LEFT JOIN (
                SELECT cazare_id, COUNT(*) AS nr
                FROM cazare_anvelope_items
                GROUP BY cazare_id
            ) items ON items.cazare_id = c.id
            WHERE c.account_id = :acc
              AND c.is_deleted = false
              AND c.data_checkout IS NULL
              {loc_filter_c}
            GROUP BY c.location_id, l.name
            ORDER BY cazari_active DESC, location_name
        """),
        params,
    )).all()

    active_per_location = [
        AnvelopeLocationActive(
            location_id=r.location_id,
            location_name=r.location_name,
            cazari_active=int(r.cazari_active or 0),
            anvelope_depozitate=int(r.anvelope_depozitate or 0),
        )
        for r in active_rows
    ]
    cazari_active_total = sum(r.cazari_active for r in active_per_location)
    anvelope_depozitate_total = sum(r.anvelope_depozitate for r in active_per_location)

    # Snapshot live per (location, loc_cazare): câte cazări active + câte anvelope
    loc_cazare_rows = (await db.execute(
        text(f"""
            SELECT c.location_id,
                   COALESCE(l.name, 'Fără locație') AS location_name,
                   c.loc_cazare_id,
                   COALESCE(lc.nume, 'Fără loc de depozitare') AS loc_cazare_nume,
                   COUNT(*) AS cazari_active,
                   COALESCE(SUM(items.nr), 0) AS anvelope_depozitate
            FROM cazari_anvelope c
            LEFT JOIN locations l ON l.id = c.location_id
            LEFT JOIN locuri_cazare lc ON lc.id = c.loc_cazare_id
            LEFT JOIN (
                SELECT cazare_id, COUNT(*) AS nr
                FROM cazare_anvelope_items
                GROUP BY cazare_id
            ) items ON items.cazare_id = c.id
            WHERE c.account_id = :acc
              AND c.is_deleted = false
              AND c.data_checkout IS NULL
              {loc_filter_c}
            GROUP BY c.location_id, l.name, c.loc_cazare_id, lc.nume
            ORDER BY location_name, cazari_active DESC, loc_cazare_nume
        """),
        params,
    )).all()

    active_per_loc_cazare = [
        AnvelopeLocCazareActive(
            location_id=r.location_id,
            location_name=r.location_name,
            loc_cazare_id=r.loc_cazare_id,
            loc_cazare_nume=r.loc_cazare_nume,
            cazari_active=int(r.cazari_active or 0),
            anvelope_depozitate=int(r.anvelope_depozitate or 0),
        )
        for r in loc_cazare_rows
    ]

    # Serii lunare din agregatul precalculat
    monthly_rows = (await db.execute(
        text(f"""
            SELECT to_char(date_trunc('month', r.report_date), 'YYYY-MM') AS month,
                   COALESCE(SUM(r.count_checkins), 0)          AS checkins,
                   COALESCE(SUM(r.count_checkouts), 0)         AS checkouts,
                   COALESCE(SUM(r.count_checkouts_montate), 0) AS checkouts_montate,
                   COALESCE(SUM(r.count_anvelope_in), 0)       AS anvelope_in,
                   COALESCE(SUM(r.count_anvelope_out), 0)      AS anvelope_out
            FROM report_cazari_daily r
            WHERE r.account_id = :acc
              AND r.report_date BETWEEN :d1 AND :d2
              {loc_filter_r}
            GROUP BY date_trunc('month', r.report_date)
            ORDER BY date_trunc('month', r.report_date)
        """),
        params,
    )).all()
    monthly = [
        AnvelopeMonthly(
            month=r.month,
            checkins=int(r.checkins),
            checkouts=int(r.checkouts),
            checkouts_montate=int(r.checkouts_montate),
            anvelope_in=int(r.anvelope_in),
            anvelope_out=int(r.anvelope_out),
        )
        for r in monthly_rows
    ]
    intrari_perioada = sum(m.checkins for m in monthly)
    iesiri_perioada = sum(m.checkouts for m in monthly)
    iesiri_montate_perioada = sum(m.checkouts_montate for m in monthly)

    # Cazări per angajat (perioadă)
    emp_rows = (await db.execute(
        text(f"""
            SELECT r.employee_id,
                   COALESCE(e.name, 'Fără angajat') AS employee_name,
                   e.image_path AS image_path,
                   COALESCE(SUM(r.count_checkins), 0)  AS count_checkins,
                   COALESCE(SUM(r.count_checkouts), 0) AS count_checkouts
            FROM report_cazari_daily r
            LEFT JOIN employees e ON e.id = r.employee_id
            WHERE r.account_id = :acc
              AND r.report_date BETWEEN :d1 AND :d2
              {loc_filter_r}
            GROUP BY r.employee_id, e.name, e.image_path
            HAVING COALESCE(SUM(r.count_checkins), 0) > 0
                OR COALESCE(SUM(r.count_checkouts), 0) > 0
            ORDER BY count_checkins DESC, count_checkouts DESC
        """),
        params,
    )).all()
    per_employee = [
        AnvelopeEmployeeTotal(
            employee_id=r.employee_id,
            employee_name=r.employee_name,
            image_path=r.image_path,
            count_checkins=int(r.count_checkins),
            count_checkouts=int(r.count_checkouts),
        )
        for r in emp_rows
    ]

    # Matrice angajat × locație — scoateri
    emp_loc_rows = (await db.execute(
        text(f"""
            SELECT r.employee_id,
                   COALESCE(e.name, 'Fără angajat') AS employee_name,
                   r.location_id,
                   COALESCE(l.name, 'Fără locație') AS location_name,
                   COALESCE(SUM(r.count_checkouts), 0) AS count_checkouts
            FROM report_cazari_daily r
            LEFT JOIN employees e ON e.id = r.employee_id
            LEFT JOIN locations l ON l.id = r.location_id
            WHERE r.account_id = :acc
              AND r.report_date BETWEEN :d1 AND :d2
              {loc_filter_r}
            GROUP BY r.employee_id, e.name, r.location_id, l.name
            HAVING COALESCE(SUM(r.count_checkouts), 0) > 0
            ORDER BY count_checkouts DESC, employee_name, location_name
        """),
        params,
    )).all()
    per_employee_location = [
        AnvelopeEmployeeLocation(
            employee_id=r.employee_id,
            employee_name=r.employee_name,
            location_id=r.location_id,
            location_name=r.location_name,
            count_checkouts=int(r.count_checkouts),
        )
        for r in emp_loc_rows
    ]

    return HotelAnvelopeSummary(
        kpi=AnvelopeKpi(
            cazari_active_total=cazari_active_total,
            anvelope_depozitate_total=anvelope_depozitate_total,
            intrari_perioada=intrari_perioada,
            iesiri_perioada=iesiri_perioada,
            iesiri_montate_perioada=iesiri_montate_perioada,
        ),
        active_per_location=active_per_location,
        active_per_loc_cazare=active_per_loc_cazare,
        monthly=monthly,
        per_employee=per_employee,
        per_employee_location=per_employee_location,
        period_start=date_from,
        period_end=date_to,
    )


# ───── CLIENȚI (CRM) ──────────────────────────────────────────────────────────
# Bucket-uri pentru profil cheltuieli (RON, suma plătită de client în perioada
# selectată). Definite ca tuple constant pentru a putea fi ajustate ulterior.
# Fiecare tuple: (low_inclusive, high_exclusive_or_None, label).
CLIENT_SPENDING_BUCKETS: list[tuple[float, float | None, str]] = [
    (0,    200,   "< 200 RON"),
    (200,  500,   "200 – 500"),
    (500,  1000,  "500 – 1.000"),
    (1000, 2000,  "1.000 – 2.000"),
    (2000, 4000,  "2.000 – 4.000"),
    (4000, None,  "4.000+"),
]
VISIT_FREQ_BUCKETS: list[tuple[int, int | None, str]] = [
    (1, 2,    "1 vizită"),
    (2, 4,    "2 – 3 vizite"),
    (4, 7,    "4 – 6 vizite"),
    (7, None, "7+ vizite"),
]


class ClientiKpi(BaseModel):
    clienti_unici: int
    clienti_noi: int
    clienti_recurenti: int
    sum_paid_total: Decimal
    ltv_mediu: Decimal  # sum_paid_total / clienti_unici (în perioadă)


class ClientiBucket(BaseModel):
    label: str
    count_clients: int
    sum_paid: Decimal
    pct: float  # procent din total clienți (pentru donut)


class ClientiTop(BaseModel):
    client_id: int
    nume: str
    telefon: str | None
    numar_masina: str | None
    sum_paid: Decimal
    count_receipts: int


class ClientiNewVsReturning(BaseModel):
    month: str
    count_new: int
    count_returning: int


class ClientiInactiv(BaseModel):
    client_id: int
    nume: str
    telefon: str | None
    numar_masina: str | None
    last_visit: date
    sum_paid_total: Decimal  # cumulat istoric, nu doar perioada
    count_receipts_total: int


class ClientiSummary(BaseModel):
    kpi: ClientiKpi
    spending_buckets: list[ClientiBucket]
    visit_freq_buckets: list[ClientiBucket]
    top_clients: list[ClientiTop]
    new_vs_returning: list[ClientiNewVsReturning]
    inactivi: list[ClientiInactiv]
    period_start: date
    period_end: date


@router.get("/clienti", response_model=ClientiSummary)
async def reports_clienti(
    date_from: date | None = None,
    date_to: date | None = None,
    location_ids: list[int] | None = Query(None),
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    """Date pentru secțiunea „Clienți" (CRM):
    - KPI: clienți unici, noi, recurenți, LTV mediu pe perioadă
    - Buckete cheltuieli (donut): cât plătește fiecare client în perioadă
      grupat pe intervale (CLIENT_SPENDING_BUCKETS)
    - Buckete frecvență vizite (donut): câte bonuri are clientul în perioadă
    - Top 20 clienți după sum_paid în perioadă
    - New vs Returning per lună
    - Top 50 clienți inactivi (>12 luni fără vizită vs date_to, calculați din
      `receipts` direct — istoric complet)

    Filtrul `location_ids` se aplică pe agregat (un client poate apărea în
    mai multe locații; aici contorizăm aparițiile lui în locațiile alese).
    """
    if date_from is None or date_to is None:
        d1, d2 = _default_period()
        date_from = date_from or d1
        date_to = date_to or d2

    loc_list: list[int] = list(location_ids) if location_ids else []
    params: dict = {"acc": account_id, "d1": date_from, "d2": date_to}
    loc_filter = ""
    if loc_list:
        params["loc_ids"] = loc_list
        loc_filter = "AND location_id = ANY(:loc_ids)"

    # Agregat per client în perioadă (ignorăm walk-in-urile fără client_id pentru
    # rapoartele de client). Walk-in-urile rămân în sum_paid_total al KPI prin
    # alt query separat.
    per_client_rows = (await db.execute(
        text(f"""
            SELECT client_id,
                   SUM(sum_paid)        AS sum_paid,
                   SUM(count_receipts)  AS count_receipts,
                   BOOL_OR(is_first_visit) AS has_first_visit
            FROM report_clients_daily
            WHERE account_id = :acc
              AND report_date BETWEEN :d1 AND :d2
              AND client_id IS NOT NULL
              {loc_filter}
            GROUP BY client_id
        """),
        params,
    )).all()

    clienti_unici = len(per_client_rows)
    clienti_noi = sum(1 for r in per_client_rows if r.has_first_visit)
    clienti_recurenti = clienti_unici - clienti_noi
    sum_paid_total = sum((Decimal(r.sum_paid or 0) for r in per_client_rows), Decimal(0))
    ltv_mediu = (sum_paid_total / clienti_unici) if clienti_unici > 0 else Decimal(0)

    # Buckete cheltuieli
    spending_buckets: list[ClientiBucket] = []
    for low, high, label in CLIENT_SPENDING_BUCKETS:
        bucket_clients = [
            r for r in per_client_rows
            if Decimal(r.sum_paid or 0) >= Decimal(str(low))
            and (high is None or Decimal(r.sum_paid or 0) < Decimal(str(high)))
        ]
        cnt = len(bucket_clients)
        bucket_sum = sum((Decimal(r.sum_paid or 0) for r in bucket_clients), Decimal(0))
        pct = (cnt / clienti_unici * 100.0) if clienti_unici > 0 else 0.0
        spending_buckets.append(ClientiBucket(
            label=label,
            count_clients=cnt,
            sum_paid=bucket_sum,
            pct=round(pct, 2),
        ))

    # Buckete frecvență vizite
    visit_freq_buckets: list[ClientiBucket] = []
    for low, high, label in VISIT_FREQ_BUCKETS:
        bucket_clients = [
            r for r in per_client_rows
            if int(r.count_receipts or 0) >= low
            and (high is None or int(r.count_receipts or 0) < high)
        ]
        cnt = len(bucket_clients)
        bucket_sum = sum((Decimal(r.sum_paid or 0) for r in bucket_clients), Decimal(0))
        pct = (cnt / clienti_unici * 100.0) if clienti_unici > 0 else 0.0
        visit_freq_buckets.append(ClientiBucket(
            label=label,
            count_clients=cnt,
            sum_paid=bucket_sum,
            pct=round(pct, 2),
        ))

    # Top 20 clienți după sum_paid în perioadă
    top_rows = (await db.execute(
        text(f"""
            SELECT rcd.client_id,
                   c.nume,
                   c.telefon,
                   c.numar_masina,
                   SUM(rcd.sum_paid)       AS sum_paid,
                   SUM(rcd.count_receipts) AS count_receipts
            FROM report_clients_daily rcd
            JOIN clienti c ON c.id = rcd.client_id AND c.is_deleted = false
            WHERE rcd.account_id = :acc
              AND rcd.report_date BETWEEN :d1 AND :d2
              AND rcd.client_id IS NOT NULL
              {loc_filter.replace('location_id', 'rcd.location_id')}
            GROUP BY rcd.client_id, c.nume, c.telefon, c.numar_masina
            HAVING SUM(rcd.sum_paid) > 0
            ORDER BY sum_paid DESC
            LIMIT 20
        """),
        params,
    )).all()
    top_clients = [
        ClientiTop(
            client_id=r.client_id,
            nume=r.nume,
            telefon=r.telefon,
            numar_masina=r.numar_masina,
            sum_paid=Decimal(r.sum_paid or 0),
            count_receipts=int(r.count_receipts or 0),
        )
        for r in top_rows
    ]

    # New vs Returning per lună
    nvr_rows = (await db.execute(
        text(f"""
            SELECT to_char(date_trunc('month', report_date), 'YYYY-MM') AS month,
                   COUNT(DISTINCT CASE WHEN is_first_visit THEN client_id END)        AS count_new,
                   COUNT(DISTINCT CASE WHEN NOT is_first_visit THEN client_id END)    AS count_returning
            FROM report_clients_daily
            WHERE account_id = :acc
              AND report_date BETWEEN :d1 AND :d2
              AND client_id IS NOT NULL
              {loc_filter}
            GROUP BY date_trunc('month', report_date)
            ORDER BY date_trunc('month', report_date)
        """),
        params,
    )).all()
    new_vs_returning = [
        ClientiNewVsReturning(
            month=r.month,
            count_new=int(r.count_new or 0),
            count_returning=int(r.count_returning or 0),
        )
        for r in nvr_rows
    ]

    # Clienți inactivi: ultima vizită < date_to - 12 luni. Calculat direct din
    # receipts (istoric complet, nu doar perioadă). Ignorăm filtrul de locație
    # aici intenționat — inactivii contează la nivel de cont.
    inactivi_threshold = date_to - timedelta(days=365)
    inactivi_rows = (await db.execute(
        text(f"""
            SELECT c.id AS client_id,
                   c.nume, c.telefon, c.numar_masina,
                   MAX((r.created_at AT TIME ZONE 'Europe/Bucharest')::date) AS last_visit,
                   COALESCE(SUM(
                       CASE
                           WHEN r.pay_method::text = 'PARTIAL' THEN COALESCE(r.partial_pay, 0)
                           WHEN r.pay_method::text IN ('CARD', 'CASH', 'OP') THEN r.total
                           ELSE 0
                       END
                   ), 0) AS sum_paid_total,
                   COUNT(*) AS count_receipts_total
            FROM clienti c
            JOIN receipts r ON r.client_id = c.id AND r.is_deleted = false
            WHERE c.account_id = :acc AND c.is_deleted = false
            GROUP BY c.id, c.nume, c.telefon, c.numar_masina
            HAVING MAX((r.created_at AT TIME ZONE 'Europe/Bucharest')::date) < :threshold
            ORDER BY sum_paid_total DESC
            LIMIT 50
        """),
        {"acc": account_id, "threshold": inactivi_threshold},
    )).all()
    inactivi = [
        ClientiInactiv(
            client_id=r.client_id,
            nume=r.nume,
            telefon=r.telefon,
            numar_masina=r.numar_masina,
            last_visit=r.last_visit,
            sum_paid_total=Decimal(r.sum_paid_total or 0),
            count_receipts_total=int(r.count_receipts_total or 0),
        )
        for r in inactivi_rows
    ]

    return ClientiSummary(
        kpi=ClientiKpi(
            clienti_unici=clienti_unici,
            clienti_noi=clienti_noi,
            clienti_recurenti=clienti_recurenti,
            sum_paid_total=sum_paid_total,
            ltv_mediu=ltv_mediu,
        ),
        spending_buckets=spending_buckets,
        visit_freq_buckets=visit_freq_buckets,
        top_clients=top_clients,
        new_vs_returning=new_vs_returning,
        inactivi=inactivi,
        period_start=date_from,
        period_end=date_to,
    )


# ───── PROGRAMĂRI (Ops) ───────────────────────────────────────────────────────


class ProgramariKpi(BaseModel):
    total_programari: int
    count_programat: int
    count_in_lucru: int
    count_executat: int
    count_anulat: int
    count_with_receipt: int
    rata_anulare_pct: float
    conversie_executat_to_bon_pct: float
    lead_time_mediu_zile: float


class ProgramariHeatmapCell(BaseModel):
    day_of_week: int  # 0 = Duminică (Postgres DOW), 1 = Luni, ..., 6 = Sâmbătă
    hour: int
    count: int


class ProgramariMonthly(BaseModel):
    month: str
    count_total: int
    count_executat: int
    count_anulat: int


class ProgramariPeakSlot(BaseModel):
    day_of_week: int
    hour: int
    count: int


class ProgramariFunnel(BaseModel):
    status: str
    count: int
    pct: float


class ProgramariSummary(BaseModel):
    kpi: ProgramariKpi
    heatmap: list[ProgramariHeatmapCell]
    monthly: list[ProgramariMonthly]
    funnel: list[ProgramariFunnel]
    peak_slots: list[ProgramariPeakSlot]
    period_start: date
    period_end: date


@router.get("/programari", response_model=ProgramariSummary)
async def reports_programari(
    date_from: date | None = None,
    date_to: date | None = None,
    location_ids: list[int] | None = Query(None),
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    """Date pentru secțiunea „Programări" (Ops):
    - KPI: total, executate, anulate, rata anulare, conversie la bon, lead time mediu
    - Heatmap zi×oră (din report_programari_daily)
    - Trend lunar (total/executat/anulat)
    - Funnel donut pe status
    - Top 5 sloturi peak (zi×oră)
    """
    if date_from is None or date_to is None:
        d1, d2 = _default_period()
        date_from = date_from or d1
        date_to = date_to or d2

    loc_list: list[int] = list(location_ids) if location_ids else []
    params: dict = {"acc": account_id, "d1": date_from, "d2": date_to}
    loc_filter = ""
    if loc_list:
        params["loc_ids"] = loc_list
        loc_filter = "AND location_id = ANY(:loc_ids)"

    # KPI: agregat total pe perioadă
    kpi_row = (await db.execute(
        text(f"""
            SELECT COALESCE(SUM(count_total), 0)        AS total_programari,
                   COALESCE(SUM(count_programat), 0)    AS count_programat,
                   COALESCE(SUM(count_in_lucru), 0)     AS count_in_lucru,
                   COALESCE(SUM(count_executat), 0)     AS count_executat,
                   COALESCE(SUM(count_anulat), 0)       AS count_anulat,
                   COALESCE(SUM(count_with_receipt), 0) AS count_with_receipt,
                   COALESCE(SUM(sum_lead_time_days), 0) AS sum_lead_time_days
            FROM report_programari_daily
            WHERE account_id = :acc
              AND report_date BETWEEN :d1 AND :d2
              {loc_filter}
        """),
        params,
    )).one()

    total_programari = int(kpi_row.total_programari)
    count_executat = int(kpi_row.count_executat)
    count_anulat = int(kpi_row.count_anulat)
    count_with_receipt = int(kpi_row.count_with_receipt)
    rata_anulare = (count_anulat / total_programari * 100.0) if total_programari > 0 else 0.0
    conversie_bon = (count_with_receipt / count_executat * 100.0) if count_executat > 0 else 0.0
    lead_time_mediu = (
        float(kpi_row.sum_lead_time_days) / total_programari if total_programari > 0 else 0.0
    )

    # Heatmap zi×oră (DOW Postgres: 0=Duminică, 6=Sâmbătă)
    heatmap_rows = (await db.execute(
        text(f"""
            SELECT EXTRACT(DOW FROM report_date)::int AS day_of_week,
                   hour_slot AS hour,
                   COALESCE(SUM(count_total), 0)::int AS count
            FROM report_programari_daily
            WHERE account_id = :acc
              AND report_date BETWEEN :d1 AND :d2
              {loc_filter}
            GROUP BY 1, 2
            HAVING SUM(count_total) > 0
            ORDER BY 1, 2
        """),
        params,
    )).all()
    heatmap = [
        ProgramariHeatmapCell(
            day_of_week=int(r.day_of_week),
            hour=int(r.hour),
            count=int(r.count),
        )
        for r in heatmap_rows
    ]

    # Top 5 sloturi peak
    peak_rows = sorted(heatmap, key=lambda c: c.count, reverse=True)[:5]
    peak_slots = [
        ProgramariPeakSlot(day_of_week=c.day_of_week, hour=c.hour, count=c.count)
        for c in peak_rows
    ]

    # Trend lunar
    monthly_rows = (await db.execute(
        text(f"""
            SELECT to_char(date_trunc('month', report_date), 'YYYY-MM') AS month,
                   COALESCE(SUM(count_total), 0)    AS count_total,
                   COALESCE(SUM(count_executat), 0) AS count_executat,
                   COALESCE(SUM(count_anulat), 0)   AS count_anulat
            FROM report_programari_daily
            WHERE account_id = :acc
              AND report_date BETWEEN :d1 AND :d2
              {loc_filter}
            GROUP BY date_trunc('month', report_date)
            ORDER BY date_trunc('month', report_date)
        """),
        params,
    )).all()
    monthly = [
        ProgramariMonthly(
            month=r.month,
            count_total=int(r.count_total or 0),
            count_executat=int(r.count_executat or 0),
            count_anulat=int(r.count_anulat or 0),
        )
        for r in monthly_rows
    ]

    # Funnel donut pe status
    funnel_counts = [
        ("Programat", int(kpi_row.count_programat)),
        ("In lucru",  int(kpi_row.count_in_lucru)),
        ("Executat",  count_executat),
        ("Anulat",    count_anulat),
    ]
    funnel = [
        ProgramariFunnel(
            status=label,
            count=cnt,
            pct=round((cnt / total_programari * 100.0) if total_programari > 0 else 0.0, 2),
        )
        for label, cnt in funnel_counts
    ]

    return ProgramariSummary(
        kpi=ProgramariKpi(
            total_programari=total_programari,
            count_programat=int(kpi_row.count_programat),
            count_in_lucru=int(kpi_row.count_in_lucru),
            count_executat=count_executat,
            count_anulat=count_anulat,
            count_with_receipt=count_with_receipt,
            rata_anulare_pct=round(rata_anulare, 2),
            conversie_executat_to_bon_pct=round(conversie_bon, 2),
            lead_time_mediu_zile=round(lead_time_mediu, 2),
        ),
        heatmap=heatmap,
        monthly=monthly,
        funnel=funnel,
        peak_slots=peak_slots,
        period_start=date_from,
        period_end=date_to,
    )
