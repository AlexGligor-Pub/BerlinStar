"""Orchestrare run / trigger / cooldown pentru rapoarte."""
from __future__ import annotations
import asyncio
import logging
import time
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from typing import Literal
from zoneinfo import ZoneInfo
from sqlalchemy import or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal
from app.models.cazare_anvelope import CazareAnvelope
from app.models.programare import Programare
from app.models.receipt import Receipt
from app.models.report_run import ReportRun
from .builder import BUILDERS, BUCHAREST_TZ

log = logging.getLogger("berlinstar.reports")

COOLDOWN_SECONDS = 300  # 5 minute
# Daca un raport e marcat 'running' dar nu s-a mai atins de mai mult de atat,
# il consideram stale (workerul a fost ucis mid-run) si permitem o noua rulare.
STALE_RUNNING_SECONDS = 1800  # 30 minute
SUPPORTED_REPORTS = (
    "receipts_daily",
    "employee_daily",
    "cazari_daily",
    "clients_daily",
    "programari_daily",
    "stock_movements_daily",
)
RunMode = Literal["incremental", "weekly_refresh"]

# „Vindecarea" zilelor vechi: la fiecare rulare reconstruim si zilele din afara
# perioadei care au randuri-sursa modificate de la ultima rulare reusita (bon
# incasat, editat sau sters tarziu). Fara asta, o zi mai veche decat prima zi a
# lunii precedente nu mai era reconstruita niciodata.
#
# `last_run_at` se scrie la SFARSITUL rularii; ne uitam cu o ora mai in urma ca
# sa prindem si modificarile facute in timpul rularii precedente. Suprapunerea
# costa doar o reconstruire in plus (builderii sunt idempotenti).
HEAL_OVERLAP = timedelta(hours=1)
# Plafon pe rulare. Peste el (ex. o actualizare in masa) raman cele mai recente
# zile, iar restul se semnaleaza in log pentru un rebuild pe interval din admin.
MAX_HEAL_DAYS = 62
# Plafon pe randurile-sursa citite la cautarea zilelor modificate.
HEAL_SCAN_ROWS = 20000

_BUCHAREST = ZoneInfo(BUCHAREST_TZ)


@dataclass
class ReportStatus:
    report_type: str
    status: str
    last_run_at: datetime | None
    last_period_start: date | None
    last_period_end: date | None
    last_triggered_at: datetime | None
    last_error: str | None
    last_duration_ms: int | None
    cooldown_remaining_s: int


def _bucharest_today() -> date:
    return datetime.now(_BUCHAREST).date()


def _compute_period(
    mode: RunMode,
    last_period_end: date | None,
    oldest_source_date: date | None,
) -> tuple[date, date] | None:
    """Returnează (period_start, period_end) sau None dacă nu e nimic de procesat.

    Incremental include ziua curentă: cron-ul ruleaza la 08:00, 10:00, ..., 20:00
    si la fiecare slot reconstruieste ziua de azi cu datele acumulate pana atunci.
    Builderii sunt idempotenti (DELETE + INSERT pe perioada), deci rebuildul
    zilei curente nu duplica date.
    """
    today_buc = _bucharest_today()

    if mode == "weekly_refresh":
        first_of_this_month = today_buc.replace(day=1)
        last_of_prev_month = first_of_this_month - timedelta(days=1)
        first_of_prev_month = last_of_prev_month.replace(day=1)
        return first_of_prev_month, today_buc

    # incremental
    if last_period_end is None:
        if oldest_source_date is None:
            return None
        return oldest_source_date, today_buc

    # Catch-up daca exista gap (last < azi-1), altfel doar reprocesam azi.
    start = min(last_period_end + timedelta(days=1), today_buc)
    return start, today_buc


def _bucharest_date(ts: datetime) -> date:
    """Ziua locala in care builderii pun un timestamp (`AT TIME ZONE` in SQL)."""
    if ts.tzinfo is None:
        # timestamptz vine mereu cu fus din Postgres; fara fus doar pe SQLite (teste).
        ts = ts.replace(tzinfo=timezone.utc)
    return ts.astimezone(_BUCHAREST).date()


async def _find_dirty_days(db: AsyncSession, report_type: str, since: datetime) -> set[date]:
    """Zilele de raport ale randurilor-sursa modificate sau sterse dupa `since`.

    `updated_at` e scris la editare, incasare si alocare de numar, iar stergerea
    scrie doar `deleted_at` — de aceea le verificam pe amandoua. Miscarile de stoc
    nu se modifica dupa creare, deci raportul lor nu are ce vindeca.
    """
    if report_type in ("receipts_daily", "employee_daily", "clients_daily"):
        model, day_cols, is_ts = Receipt, (Receipt.created_at,), True
    elif report_type == "cazari_daily":
        model, day_cols, is_ts = CazareAnvelope, (CazareAnvelope.data_checkin, CazareAnvelope.data_checkout), False
    elif report_type == "programari_daily":
        model, day_cols, is_ts = Programare, (Programare.start_time,), True
    else:
        return set()

    rows = (await db.execute(
        select(*day_cols)
        .where(or_(model.updated_at >= since, model.deleted_at >= since))
        .order_by(day_cols[0].desc())
        .limit(HEAL_SCAN_ROWS)
    )).all()
    if len(rows) >= HEAL_SCAN_ROWS:
        log.warning(
            "Raport %s: peste %d randuri-sursa modificate de la ultima rulare; zilele mai vechi "
            "decat cele citite NU se reconstruiesc automat. Ruleaza un rebuild pe interval din admin.",
            report_type, HEAL_SCAN_ROWS,
        )
    days: set[date] = set()
    for row in rows:
        for value in row:
            if value is not None:
                days.add(_bucharest_date(value) if is_ts else value)
    return days


def _heal_ranges(
    dirty_days: set[date],
    period_start: date,
    period_end: date,
    today: date,
    max_days: int = MAX_HEAL_DAYS,
) -> tuple[list[tuple[date, date]], list[date]]:
    """Alege zilele de reconstruit in afara perioadei si le grupeaza in intervale.

    Intoarce (intervale consecutive [start, end], zile ramase peste plafon).
    Zilele din perioada se reconstruiesc oricum; cele viitoare (programari) intra
    in raport abia cand le vine ziua.
    """
    outside = sorted(
        (d for d in dirty_days if d <= today and not (period_start <= d <= period_end)),
        reverse=True,
    )
    chosen, skipped = sorted(outside[:max_days]), outside[max_days:]
    ranges: list[tuple[date, date]] = []
    for d in chosen:
        if ranges and d - ranges[-1][1] == timedelta(days=1):
            ranges[-1] = (ranges[-1][0], d)
        else:
            ranges.append((d, d))
    return ranges, skipped


async def _plan_heal(
    report_type: str, prev_run_at: datetime | None, period_start: date, period_end: date,
) -> list[tuple[date, date]]:
    """Intervalele vechi de reconstruit la aceasta rulare (lista goala = nimic)."""
    if prev_run_at is None:
        # Prima rulare porneste de la cea mai veche zi: nu exista zile ramase in urma.
        return []
    try:
        # Sesiune separata: o eroare aici nu are voie sa strice tranzactia
        # builderului si nici sa opreasca raportul obisnuit.
        async with AsyncSessionLocal() as scan_db:
            dirty = await _find_dirty_days(scan_db, report_type, prev_run_at - HEAL_OVERLAP)
    except Exception:
        log.exception("Cautarea zilelor modificate a esuat pentru %s; continuam fara ele.", report_type)
        return []
    ranges, skipped = _heal_ranges(dirty, period_start, period_end, _bucharest_today())
    if skipped:
        log.warning(
            "Raport %s: %d zile vechi modificate depasesc plafonul de %d pe rulare si NU au fost "
            "reconstruite (%s..%s). Ruleaza un rebuild pe interval din admin.",
            report_type, len(skipped), MAX_HEAL_DAYS, skipped[-1], skipped[0],
        )
    return ranges


async def _get_oldest_source_date(db: AsyncSession, report_type: str) -> date | None:
    """Cea mai veche dată de sursă pentru un report_type — folosită doar la
    primul run (când last_period_end e NULL) pentru a determina de unde
    începe backfill-ul.
    """
    if report_type in ("receipts_daily", "employee_daily", "clients_daily"):
        query = text(
            f"SELECT MIN((created_at AT TIME ZONE '{BUCHAREST_TZ}')::date) FROM receipts"
        )
    elif report_type == "cazari_daily":
        # Cea mai veche zi de eveniment (check-in sau check-out). data_checkin
        # e Date deja, fără timezone — nu necesită conversie.
        query = text(
            "SELECT LEAST(MIN(data_checkin), MIN(data_checkout)) FROM cazari_anvelope "
            "WHERE is_deleted = false"
        )
    elif report_type == "programari_daily":
        query = text(
            f"SELECT MIN((start_time AT TIME ZONE '{BUCHAREST_TZ}')::date) FROM programari "
            "WHERE is_deleted = false"
        )
    elif report_type == "stock_movements_daily":
        query = text(
            f"SELECT MIN((created_at AT TIME ZONE '{BUCHAREST_TZ}')::date) FROM stock_movements"
        )
    else:
        return None
    return (await db.execute(query)).scalar_one_or_none()


async def list_reports(db: AsyncSession) -> list[ReportStatus]:
    rows = (await db.execute(select(ReportRun).order_by(ReportRun.report_type))).scalars().all()
    now = datetime.now(timezone.utc)
    out: list[ReportStatus] = []
    for r in rows:
        cooldown = 0
        if r.last_triggered_at:
            delta = (now - r.last_triggered_at).total_seconds()
            if delta < COOLDOWN_SECONDS:
                cooldown = int(COOLDOWN_SECONDS - delta)
        out.append(ReportStatus(
            report_type=r.report_type,
            status=r.status,
            last_run_at=r.last_run_at,
            last_period_start=r.last_period_start,
            last_period_end=r.last_period_end,
            last_triggered_at=r.last_triggered_at,
            last_error=r.last_error,
            last_duration_ms=r.last_duration_ms,
            cooldown_remaining_s=cooldown,
        ))
    return out


async def can_trigger(db: AsyncSession, report_type: str) -> tuple[bool, int]:
    """Returnează (poate_rula, secunde_ramase_cooldown)."""
    if report_type not in SUPPORTED_REPORTS:
        return False, 0
    r = (await db.execute(
        select(ReportRun).where(ReportRun.report_type == report_type)
    )).scalar_one_or_none()
    if r is None:
        return True, 0
    if r.last_triggered_at is None:
        return True, 0
    delta = (datetime.now(timezone.utc) - r.last_triggered_at).total_seconds()
    if delta >= COOLDOWN_SECONDS:
        return True, 0
    return False, int(COOLDOWN_SECONDS - delta)


async def mark_triggered(db: AsyncSession, report_type: str) -> None:
    """Setează last_triggered_at=NOW() pentru a porni cooldown-ul imediat."""
    await db.execute(
        text(
            "UPDATE report_runs SET last_triggered_at = NOW(), updated_at = NOW() "
            "WHERE report_type = :rt"
        ),
        {"rt": report_type},
    )
    await db.commit()


async def run_report(
    report_type: str,
    mode: RunMode = "incremental",
    period_override: tuple[date, date] | None = None,
) -> dict:
    """Rulează un raport într-o sesiune nouă. Folosit din scheduler și ca task din endpoint.

    Dacă `period_override` este setat, se ignoră `mode` și se folosește perioada explicită
    (folosit de "run avansat" din admin pentru rebuild pe interval custom).
    """
    if report_type not in BUILDERS:
        raise ValueError(f"Raport necunoscut: {report_type}")

    start_ts = time.monotonic()
    async with AsyncSessionLocal() as db:
        # Lock advisory pe rândul din report_runs — previne rulări concurente
        run = (await db.execute(
            select(ReportRun).where(ReportRun.report_type == report_type).with_for_update()
        )).scalar_one_or_none()
        if run is None:
            run = ReportRun(report_type=report_type, status="idle", updated_at=datetime.now(timezone.utc))
            db.add(run)
            await db.flush()

        if run.status == "running":
            # Detectie stale: daca last_triggered_at e foarte vechi, workerul
            # a fost ucis mid-run (max-requests / SIGTERM) si statusul a ramas
            # blocat. Marcam ca failed si continuam cu o noua rulare.
            triggered = run.last_triggered_at
            now_utc = datetime.now(timezone.utc)
            stale = (
                triggered is None
                or (now_utc - triggered).total_seconds() > STALE_RUNNING_SECONDS
            )
            if stale:
                log.warning(
                    "Raportul %s era marcat 'running' dar last_triggered_at=%s "
                    "este stale (> %ds). Tratam ca esec si reluam.",
                    report_type, triggered, STALE_RUNNING_SECONDS,
                )
                run.status = "failed"
                run.last_error = "stale_running_recovered"
                run.updated_at = now_utc
                await db.commit()
                # Re-citim randul dupa commit pentru a continua cu logica normala.
                run = (await db.execute(
                    select(ReportRun).where(ReportRun.report_type == report_type).with_for_update()
                )).scalar_one()
            else:
                log.warning("Raportul %s e deja în rulare — skip.", report_type)
                return {"skipped": True, "reason": "already_running"}

        if period_override is not None:
            period: tuple[date, date] | None = period_override
        else:
            oldest = await _get_oldest_source_date(db, report_type)
            period = _compute_period(mode, run.last_period_end, oldest)
        if period is None:
            log.info("Raportul %s nu are perioadă de procesat (mode=%s).", report_type, mode)
            run.status = "idle"
            run.updated_at = datetime.now(timezone.utc)
            await db.commit()
            return {"skipped": True, "reason": "nothing_to_do"}

        period_start, period_end = period
        # Citit inainte de commit: reperul „de la ultima rulare reusita".
        prev_run_at = run.last_run_at

        run.status = "running"
        run.last_period_start = period_start
        run.last_triggered_at = datetime.now(timezone.utc)
        run.last_error = None
        run.updated_at = datetime.now(timezone.utc)
        await db.commit()

    # Rulează builder-ul într-o sesiune separată (commit explicit la sfârșit)
    try:
        heal_ranges = await _plan_heal(report_type, prev_run_at, period_start, period_end)
        async with AsyncSessionLocal() as build_db:
            inserted = await BUILDERS[report_type](build_db, period_start, period_end)
            # In aceeasi tranzactie: daca o zi veche nu se poate reconstrui, rularea
            # esueaza intreaga si `last_run_at` nu avanseaza, deci se reia data viitoare.
            for heal_start, heal_end in heal_ranges:
                inserted += await BUILDERS[report_type](build_db, heal_start, heal_end)
            await build_db.commit()

        duration_ms = int((time.monotonic() - start_ts) * 1000)
        async with AsyncSessionLocal() as upd:
            # GREATEST: la run cu period_override pe interval mai vechi, nu regresam cursorul incremental.
            await upd.execute(
                text(
                    "UPDATE report_runs SET status = 'idle', last_run_at = NOW(), "
                    "last_period_end = GREATEST(COALESCE(last_period_end, :pe), :pe), "
                    "last_duration_ms = :dur, last_error = NULL, updated_at = NOW() "
                    "WHERE report_type = :rt"
                ),
                {"pe": period_end, "dur": duration_ms, "rt": report_type},
            )
            await upd.commit()

        log.info(
            "Raport %s finalizat în %dms (%s..%s, %d rânduri).",
            report_type, duration_ms, period_start, period_end, inserted,
        )
        if heal_ranges:
            log.info(
                "Raport %s: reconstruite si zilele vechi modificate: %s.",
                report_type, ", ".join(f"{s}..{e}" for s, e in heal_ranges),
            )
        return {
            "ok": True,
            "report_type": report_type,
            "period_start": period_start.isoformat(),
            "period_end": period_end.isoformat(),
            "rows": inserted,
            "duration_ms": duration_ms,
        }
    except (asyncio.CancelledError, Exception) as exc:
        # CancelledError apare cand workerul gunicorn e reciclat (max-requests,
        # SIGTERM, deploy). Trebuie sa scoatem statusul din 'running' inainte
        # de a re-arunca, altfel raportul ramane blocat si va fi sarit la
        # urmatoarea rulare.
        is_cancel = isinstance(exc, asyncio.CancelledError)
        if is_cancel:
            log.warning("Raport %s anulat (worker shutdown / cancel).", report_type)
        else:
            log.exception("Eroare la rularea raportului %s", report_type)
        duration_ms = int((time.monotonic() - start_ts) * 1000)
        err_msg = "cancelled_worker_shutdown" if is_cancel else str(exc)[:2000]
        try:
            async with AsyncSessionLocal() as upd:
                await upd.execute(
                    text(
                        "UPDATE report_runs SET status = 'failed', last_error = :err, "
                        "last_duration_ms = :dur, updated_at = NOW() "
                        "WHERE report_type = :rt"
                    ),
                    {"err": err_msg, "dur": duration_ms, "rt": report_type},
                )
                await upd.commit()
        except Exception:
            log.exception("Nu am putut actualiza statusul report_runs după eșec.")
        raise


async def run_all(
    mode: RunMode = "incremental",
    stagger_seconds: int = 0,
    period_override: tuple[date, date] | None = None,
) -> None:
    """Rulează toate rapoartele suportate, secvențial.

    Dacă `stagger_seconds > 0`, așteaptă atâtea secunde între rapoarte (nu și după
    ultimul). Util pentru a evita spike-uri de încărcare pe DB când scheduler-ul
    rulează toate rapoartele odată.

    Dacă `period_override` este setat, toate rapoartele rulează pe acel interval
    (rebuild custom din admin).
    """
    import asyncio
    reports = list(SUPPORTED_REPORTS)
    for idx, rt in enumerate(reports):
        try:
            await run_report(rt, mode, period_override=period_override)
        except Exception:
            log.exception("Raportul %s a eșuat, continuăm cu următorul.", rt)
        if stagger_seconds > 0 and idx < len(reports) - 1:
            await asyncio.sleep(stagger_seconds)
