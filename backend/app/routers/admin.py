from __future__ import annotations
import hmac
import logging
import os
from datetime import date, datetime, timedelta, timezone
import jwt
from fastapi import APIRouter, Depends, HTTPException, Path, Query, Request
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import SECRET_KEY, ALGORITHM, TOKEN_EXPIRE_DAYS
from app.database import get_db
from app.dependencies import get_account_id
from app.models.account import Account
from app.models.report_receipts_daily import ReportReceiptsDaily
from app.rate_limit import limiter
from app.services.demo_seeder import (
    DEMO_PASSWORD,
    DEMO_USERNAME,
    delete_demo_account,
    seed_demo_account,
)

log = logging.getLogger("berlinstar")

router = APIRouter()

# Parolele admin se citesc din env vars; fara fallback in productie.
# Pe dev, BERLINSTAR_DEV_SQLITE=1 permite si fallback de dev pentru ele.
_PASSWORD_1 = os.getenv("ADMIN_PASSWORD_1")
_PASSWORD_2 = os.getenv("ADMIN_PASSWORD_2")
if (not _PASSWORD_1 or not _PASSWORD_2):
    if os.getenv("BERLINSTAR_DEV_SQLITE") != "1":
        raise RuntimeError(
            "ADMIN_PASSWORD_1 si ADMIN_PASSWORD_2 sunt obligatorii. "
            "Seteaza-le in .env sau in environment-ul containerului."
        )


class VerifyRequest(BaseModel):
    password1: str
    password2: str


class VerifyResponse(BaseModel):
    ok: bool = True
    access_token: str
    token_type: str = "bearer"
    expires_in: int


def _safe_eq(a: str | None, b: str | None) -> bool:
    if not a or not b:
        return False
    return hmac.compare_digest(a.encode("utf-8"), b.encode("utf-8"))


@router.post("/verify", response_model=VerifyResponse)
@limiter.limit("3/minute")
async def verify_admin(request: Request, body: VerifyRequest, db: AsyncSession = Depends(get_db)):
    ok1 = _safe_eq(body.password1, _PASSWORD_1)
    ok2 = _safe_eq(body.password2, _PASSWORD_2)
    if not (ok1 and ok2):
        raise HTTPException(status_code=401, detail="Parole incorecte.")

    account = (await db.execute(
        select(Account).where(Account.username == "admin", Account.is_deleted == False)
    )).scalar_one_or_none()
    if account is None:
        raise HTTPException(status_code=500, detail="Contul administrator nu este configurat.")

    expire = datetime.now(timezone.utc) + timedelta(days=TOKEN_EXPIRE_DAYS)
    payload = {"sub": str(account.id), "name": account.name, "exp": expire}
    token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
    return VerifyResponse(access_token=token, expires_in=TOKEN_EXPIRE_DAYS * 24 * 3600)


class ImpersonateResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    username: str
    name: str
    is_locked: bool = False
    locked_at: datetime | None = None
    # Token cu scope "reports" emis automat, ca adminul de suport sa vada
    # rapoartele fara sa stie parola de Rapoarte a utilizatorului.
    reports_access_token: str | None = None
    reports_expires_in: int | None = None


# TTL token Rapoarte (identic cu cel din routers/auth.py).
REPORTS_TOKEN_TTL_SECONDS = 3600


async def _require_super_admin(
    account_id: int = Depends(get_account_id),
    db: AsyncSession = Depends(get_db),
) -> Account:
    account = (await db.execute(
        select(Account).where(
            Account.id == account_id,
            Account.is_deleted == False,
            Account.username == "admin",
        )
    )).scalar_one_or_none()
    if account is None:
        raise HTTPException(403, "Acces interzis: este necesar contul administrator.")
    return account


class SeedDemoResponse(BaseModel):
    ok: bool = True
    username: str
    password: str
    duration_seconds: float
    receipts: int
    receipt_items: int
    stock_movements: int
    programari: int
    cazari: int
    clients: int


@router.post("/seed-demo", response_model=SeedDemoResponse)
@limiter.limit("2/hour")
async def seed_demo(
    request: Request,
    admin: Account = Depends(_require_super_admin),
):
    """Creeaza contul demo "ProfessorPrimeDemo" cu ~2 ani de date populate.

    Refuza daca username-ul exista deja (HTTP 409). Operatia dureaza
    cateva minute — clientul trebuie sa astepte raspunsul.
    """
    try:
        summary = await seed_demo_account(force=False)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    except Exception as exc:
        log.exception("Demo seed failed admin_id=%s", admin.id)
        raise HTTPException(status_code=500, detail=f"Seed esuat: {exc}")

    return SeedDemoResponse(
        username=DEMO_USERNAME,
        password=DEMO_PASSWORD,
        duration_seconds=summary["duration_seconds"],
        receipts=summary["receipts"],
        receipt_items=summary["receipt_items"],
        stock_movements=summary["stock_movements"],
        programari=summary["programari"],
        cazari=summary["cazari"],
        clients=summary["clients"],
    )


class DeleteDemoResponse(BaseModel):
    ok: bool = True
    existed: bool
    account_id: int | None = None
    counts: dict[str, int]


@router.delete("/seed-demo", response_model=DeleteDemoResponse)
@limiter.limit("5/hour")
async def delete_demo(
    request: Request,
    admin: Account = Depends(_require_super_admin),
):
    """Hard-delete pentru contul "ProfessorPrimeDemo" si toate datele asociate.

    Util pentru cleanup dupa un seed esuat partial sau pentru a regenera datele.
    Daca contul nu exista, intoarce existed=False fara modificari.
    """
    try:
        result = await delete_demo_account()
    except Exception as exc:
        log.exception("Demo delete failed admin_id=%s", admin.id)
        raise HTTPException(status_code=500, detail=f"Stergere esuata: {exc}")

    return DeleteDemoResponse(
        existed=result["existed"],
        account_id=result.get("account_id"),
        counts=result["counts"],
    )


@router.post("/accounts/{account_id}/impersonate", response_model=ImpersonateResponse)
@limiter.limit("10/minute")
async def impersonate_account(
    request: Request,
    account_id: int = Path(..., gt=0),
    admin: Account = Depends(_require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    if account_id == admin.id:
        raise HTTPException(400, "Esti deja logat ca admin.")

    target = (await db.execute(
        select(Account).where(Account.id == account_id, Account.is_deleted == False)
    )).scalar_one_or_none()
    if target is None:
        raise HTTPException(404, "Contul nu exista.")

    now = datetime.now(timezone.utc)
    expire = now + timedelta(days=TOKEN_EXPIRE_DAYS)
    payload = {"sub": str(target.id), "name": target.name, "exp": expire}
    token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

    # Token Rapoarte emis automat (scope "reports"), ca suportul sa vada
    # rapoartele in contul impersonat fara parola dedicata.
    reports_expire = now + timedelta(seconds=REPORTS_TOKEN_TTL_SECONDS)
    reports_payload = {"sub": str(target.id), "name": target.name, "scope": "reports", "exp": reports_expire}
    reports_token = jwt.encode(reports_payload, SECRET_KEY, algorithm=ALGORITHM)

    log.warning(
        "Admin impersonation: admin_id=%s target_id=%s username=%s",
        admin.id, target.id, target.username,
    )
    return ImpersonateResponse(
        access_token=token,
        expires_in=TOKEN_EXPIRE_DAYS * 24 * 3600,
        username=target.username,
        name=target.name,
        is_locked=target.is_locked,
        locked_at=target.locked_at,
        reports_access_token=reports_token,
        reports_expires_in=REPORTS_TOKEN_TTL_SECONDS,
    )


class ReceiptsDailyPoint(BaseModel):
    date: date
    count: int


class ReceiptsDailyResponse(BaseModel):
    account_id: int
    days: int
    total: int
    points: list[ReceiptsDailyPoint]


@router.get("/accounts/{account_id}/receipts-daily", response_model=ReceiptsDailyResponse)
async def receipts_daily_for_account(
    account_id: int = Path(..., gt=0),
    days: int = Query(30, ge=1, le=365),
    admin: Account = Depends(_require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    """Count-uri zilnice de bonuri pentru un cont, in ultimele `days` zile.

    Foloseste agregatul pre-calculat `report_receipts_daily`. Daca o zi nu are
    rand in tabel, intoarce count=0 pentru ea (interval continuu).
    """
    end_d = datetime.now(timezone.utc).date()
    start_d = end_d - timedelta(days=days - 1)

    rows = (await db.execute(
        select(
            ReportReceiptsDaily.report_date,
            func.coalesce(func.sum(ReportReceiptsDaily.count_total), 0).label("cnt"),
        )
        .where(
            ReportReceiptsDaily.account_id == account_id,
            ReportReceiptsDaily.report_date >= start_d,
            ReportReceiptsDaily.report_date <= end_d,
        )
        .group_by(ReportReceiptsDaily.report_date)
    )).all()

    by_date: dict[date, int] = {r.report_date: int(r.cnt) for r in rows}
    points: list[ReceiptsDailyPoint] = []
    for i in range(days):
        d = start_d + timedelta(days=i)
        points.append(ReceiptsDailyPoint(date=d, count=by_date.get(d, 0)))
    total = sum(p.count for p in points)
    return ReceiptsDailyResponse(account_id=account_id, days=days, total=total, points=points)
