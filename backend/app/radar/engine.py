"""Orchestratorul Radar AI: colectare surse -> digest per element -> sinteza raport."""
from __future__ import annotations

import asyncio
import hashlib
import logging
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Any, Callable

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal
from app.models.account import Account
from app.models.company import Company
from app.models.item import Item
from app.models.radar import RadarRun, RadarSettings, RadarSnapshot, RadarSource

from .ai import AIClient, AIError, parse_json
from .types import (
    FEATURE_CONTEXT,
    FEATURE_DIGEST,
    FEATURE_SYNTHESIS,
    BusinessContext,
    CollectorError,
)

log = logging.getLogger("berlinstar.radar.engine")

MAX_ITEMS_IN_CONTEXT = 60
MAX_BILANT_YEARS = 3
BILANT_LOOKBACK_YEARS = 5
DEFAULT_PERIOD_DAYS = 30
COLLECT_CONCURRENCY = 3
NO_KEY_ERROR = "Cheia Anthropic nu este configurată (AdminV2)."

SECTION_BY_KIND = {
    "youtube": "youtube",
    "company": "companies",
    "website": "websites",
    "gbusiness": "reviews",
}

REPORT_DEFAULTS: dict[str, Any] = {
    "version": 1,
    "generated_at": "",
    "period": {},
    "title": "",
    "executive_summary": "",
    "key_signals": [],
    "recommendations": [],
    "decision_frame": {"question": "", "options": [], "recommended": "", "risks": []},
    "sections": {},
    "history_delta": "",
    "data_gaps": [],
}


@dataclass
class Candidate:
    """Un element candidat la snapshot; `dedup_key` prinde continut identic la alta data."""

    external_id: str
    payload: dict
    dedup_key: str | None = None
    prefix: str = ""


@dataclass
class RunCtx:
    account_id: int
    business: BusinessContext
    focus: str
    places_key: str = ""
    ai: AIClient | None = None
    log: list[str] = field(default_factory=list)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _sha1(text: str) -> str:
    return hashlib.sha1(text.encode("utf-8", "replace")).hexdigest()


async def _load_ai_settings(db: AsyncSession):
    from .settings import load_ai_settings

    return await load_ai_settings(db)


def _make_ai(ai_settings) -> AIClient:
    return AIClient(
        api_key=getattr(ai_settings, "api_key", "") or "",
        model=getattr(ai_settings, "model", None),
        price_in=getattr(ai_settings, "price_in", None),
        price_out=getattr(ai_settings, "price_out", None),
    )


# ─── Context de business ──────────────────────────────────────────────────────

async def _account_snapshot(db: AsyncSession, account_id: int) -> tuple[str, list[dict], list[dict]]:
    account = await db.get(Account, account_id)
    account_name = account.name if account else f"Cont {account_id}"

    companies = (await db.execute(
        select(Company).where(Company.account_id == account_id, Company.is_deleted == False)
    )).scalars().all()
    comp_dicts = [
        {
            "cui": c.cui,
            "name": c.name,
            "address": c.address or "",
            "website": c.website or "",
            "description": c.description or "",
        }
        for c in companies
    ]

    items = (await db.execute(
        select(Item)
        .where(Item.account_id == account_id, Item.is_deleted == False)
        .order_by(Item.id)
        .limit(MAX_ITEMS_IN_CONTEXT)
    )).scalars().all()
    item_dicts = [
        {
            "name": i.name,
            "type": i.type.value if hasattr(i.type, "value") else str(i.type),
            "price": float(i.price) if i.price is not None else None,
            "unit": i.unit,
        }
        for i in items
    ]
    return account_name, comp_dicts, item_dicts


async def _build_context(db: AsyncSession, account_id: int, settings: Any) -> BusinessContext:
    name, companies, items = await _account_snapshot(db, account_id)
    return BusinessContext(
        account_name=name,
        companies=companies,
        items=items,
        business_context=(getattr(settings, "business_context", "") or ""),
    )


async def build_business_context(
    db: AsyncSession, account_id: int, ai: AIClient | None = None
) -> str:
    """Genereaza cu AI descrierea firmei din companiile si produsele contului."""
    from . import prompts

    if ai is None:
        ai = _make_ai(await _load_ai_settings(db))
    name, companies, items = await _account_snapshot(db, account_id)
    ctx = BusinessContext(account_name=name, companies=companies, items=items)
    result = await ai.complete(
        prompts.system_prompt(ctx),
        prompts.context_prompt(companies, items),
        max_tokens=2048,
    )
    await ai.record_usage(db, account_id, FEATURE_CONTEXT, result)
    await db.commit()
    return result.text.strip()


# ─── Colectori (functii de modul, ca sa poata fi inlocuite in teste) ──────────

async def _collect_youtube(source: RadarSource, ctx: RunCtx) -> list[Candidate]:
    from .collectors import youtube

    meta = source.meta or {}
    channel_id = meta.get("channel_id") or source.value
    videos = await youtube.fetch_recent_videos(channel_id, 10)
    out = []
    for video in videos:
        payload = video.to_payload() if hasattr(video, "to_payload") else dict(video)
        out.append(Candidate(external_id=payload.get("video_id") or "", payload=payload))
    return [c for c in out if c.external_id]


async def _enrich_youtube(candidate: Candidate) -> None:
    from .collectors import youtube

    transcript = await youtube.fetch_transcript(candidate.payload.get("video_id"))
    candidate.payload["transcript"] = transcript


async def _collect_company(source: RadarSource, ctx: RunCtx) -> list[Candidate]:
    from .collectors import anaf

    meta = source.meta or {}
    raw_cui = meta.get("cui") or source.value
    cui = int("".join(ch for ch in str(raw_cui) if ch.isdigit()) or 0)
    if not cui:
        raise CollectorError("CUI invalid pentru sursa de tip firmă.")

    company = await anaf.fetch_company(cui)
    company_dict = _as_dict(company)
    today = date.today()

    out: list[Candidate] = [
        Candidate(
            external_id=f"company:{today.isoformat()}",
            payload={"type": "company", "company": company_dict},
            dedup_key=_sha1(_stable(company_dict)),
            prefix="company:",
        )
    ]

    found = 0
    for year in range(today.year - 1, today.year - 1 - BILANT_LOOKBACK_YEARS, -1):
        if found >= MAX_BILANT_YEARS:
            break
        bilant = await anaf.fetch_bilant(cui, year)
        if bilant is None:
            continue
        found += 1
        out.append(
            Candidate(
                external_id=f"bilant:{year}",
                payload={"type": "bilant", "company": company_dict,
                         "bilant": [_as_dict(bilant)]},
            )
        )
    return out


async def _collect_website(source: RadarSource, ctx: RunCtx) -> list[Candidate]:
    from .collectors import website

    page = await website.fetch_page(source.value)
    payload = page.to_payload() if hasattr(page, "to_payload") else dict(page)
    url = payload.get("url") or source.value
    key = _sha1(url)[:12]
    return [
        Candidate(
            external_id=f"page:{key}:{date.today().isoformat()}",
            payload=payload,
            dedup_key=payload.get("content_hash") or _sha1(payload.get("text") or ""),
            prefix=f"page:{key}:",
        )
    ]


async def _collect_gbusiness(source: RadarSource, ctx: RunCtx) -> list[Candidate]:
    from .collectors import gplaces

    meta = source.meta or {}
    place_id = meta.get("place_id") or source.value
    if not ctx.places_key:
        raise CollectorError("Cheia Google Places nu este configurată (AdminV2).")
    reviews = await gplaces.fetch_reviews(place_id, ctx.places_key)
    payload = reviews.to_payload() if hasattr(reviews, "to_payload") else dict(reviews)
    texts = sorted(
        f"{r.get('author', '')}|{r.get('text', '')}" for r in (payload.get("reviews") or [])
    )
    return [
        Candidate(
            external_id=f"place:{place_id}:{date.today().isoformat()}",
            payload=payload,
            dedup_key=_sha1("\n".join(texts)),
            prefix=f"place:{place_id}:",
        )
    ]


def _collectors() -> dict[str, Callable]:
    return {
        "youtube": _collect_youtube,
        "company": _collect_company,
        "website": _collect_website,
        "gbusiness": _collect_gbusiness,
    }


def _as_dict(obj: Any) -> dict:
    if isinstance(obj, dict):
        return obj
    from dataclasses import asdict, is_dataclass

    if is_dataclass(obj):
        return asdict(obj)
    return {k: v for k, v in vars(obj).items() if not k.startswith("_")}


def _stable(data: Any) -> str:
    import json

    return json.dumps(data, sort_keys=True, ensure_ascii=False, default=str)


# ─── Rulare ───────────────────────────────────────────────────────────────────

async def run_radar(run_id: int) -> None:
    """Ruleaza complet un run Radar. Nu ridica niciodata — erorile ajung in `run.error`."""
    async with AsyncSessionLocal() as db:
        run = await db.get(RadarRun, run_id)
        if run is None:
            log.warning("Run Radar %s inexistent.", run_id)
            return
        try:
            await _execute(db, run)
        except Exception as exc:  # noqa: BLE001
            log.exception("Run Radar %s a esuat.", run_id)
            try:
                await db.rollback()
                run = await db.get(RadarRun, run_id)
                if run is not None:
                    run.status = "error"
                    run.error = _ro_message(exc)
                    run.finished_at = _now()
                await db.commit()
            except Exception:  # noqa: BLE001
                log.exception("Nu am putut salva eroarea pentru run-ul %s.", run_id)


def _ro_message(exc: BaseException) -> str:
    text = str(exc).strip()
    return text or "Eroare necunoscută la generarea raportului Radar."


async def _execute(db: AsyncSession, run: RadarRun) -> None:
    run.status = "running"
    run.error = None
    run.progress = {"step": "Pornire", "done": 0, "total": 1, "log": []}
    await db.commit()

    ai_settings = await _load_ai_settings(db)
    if not (getattr(ai_settings, "api_key", "") or ""):
        raise AIError(NO_KEY_ERROR)
    ai = _make_ai(ai_settings)

    settings = await db.get(RadarSettings, run.account_id)
    sources = (await db.execute(
        select(RadarSource)
        .where(RadarSource.account_id == run.account_id, RadarSource.enabled == True)
        .order_by(RadarSource.id)
    )).scalars().all()

    business = await _build_context(db, run.account_id, settings)
    ctx = RunCtx(
        account_id=run.account_id,
        business=business,
        focus=(getattr(settings, "focus_prompt", "") or ""),
        places_key=(getattr(ai_settings, "places_key", "") or ""),
        ai=ai,
    )

    total = len(sources) + 1
    _progress(run, "Colectez sursele", 0, total, None)
    await db.commit()

    collected = await _collect_all(sources, ctx)

    # Why: un rollback pe mijloc expira toate obiectele sesiunii, asa ca reincarcam
    # sursa la fiecare pas in loc sa tinem instantele din lista initiala.
    for index, source_id in enumerate([s.id for s in sources], start=1):
        source = await db.get(RadarSource, source_id)
        if source is None:
            continue
        result = collected.get(source_id)
        label = source.label or source.value
        if isinstance(result, BaseException):
            source.last_error = _ro_message(result)
            _progress(run, f"Sursa {label}", index, total, f"{label}: {source.last_error}")
            await db.commit()
            continue
        try:
            new_count = await _process_source(db, run, source, ctx, result or [], ai)
            source.last_error = None
            source.last_collected_at = _now()
            _progress(
                run, f"Sursa {label}", index, total,
                f"{label}: {new_count} element(e) noi",
            )
        except Exception as exc:  # noqa: BLE001
            log.exception("Sursa Radar %s a esuat.", source.id)
            await db.rollback()
            source = await db.get(RadarSource, source.id)
            run = await db.get(RadarRun, run.id)
            if source is not None:
                source.last_error = _ro_message(exc)
            _progress(run, f"Sursa {label}", index, total, f"{label}: {_ro_message(exc)}")
        await db.commit()

    _progress(run, "Sinteza raportului", total - 1, total, None)
    await db.commit()

    await _synthesize(db, run, ctx, ai)
    run.status = "done"
    run.finished_at = _now()
    _progress(run, "Gata", total, total, "Raport generat.")
    await db.commit()


def _progress(run: RadarRun, step: str, done: int, total: int, message: str | None) -> None:
    current = dict(run.progress or {})
    entries = list(current.get("log") or [])
    if message:
        entries.append(message)
    run.progress = {"step": step, "done": done, "total": total, "log": entries[-60:]}


async def _collect_all(sources: list[RadarSource], ctx: RunCtx) -> dict[int, Any]:
    """Doar partea de retea ruleaza in paralel (max 3); DB si AI raman secventiale."""
    if not sources:
        return {}
    semaphore = asyncio.Semaphore(COLLECT_CONCURRENCY)
    collectors = _collectors()

    async def _one(source: RadarSource):
        fn = collectors.get(source.kind)
        if fn is None:
            raise CollectorError(f"Tip de sursă necunoscut: {source.kind}")
        async with semaphore:
            return await fn(source, ctx)

    results = await asyncio.gather(*(_one(s) for s in sources), return_exceptions=True)
    return {source.id: result for source, result in zip(sources, results)}


async def _process_source(
    db: AsyncSession,
    run: RadarRun,
    source: RadarSource,
    ctx: RunCtx,
    candidates: list[Candidate],
    ai: AIClient,
) -> int:
    existing = set((await db.execute(
        select(RadarSnapshot.external_id).where(RadarSnapshot.source_id == source.id)
    )).scalars().all())

    created = 0
    for candidate in candidates:
        if candidate.external_id in existing:
            continue
        if candidate.dedup_key and await _same_as_last(db, source.id, candidate):
            continue
        if source.kind == "youtube":
            await _enrich_youtube(candidate)

        snapshot = RadarSnapshot(
            account_id=source.account_id,
            source_id=source.id,
            run_id=run.id,
            kind=source.kind,
            external_id=candidate.external_id,
            collected_at=_now(),
            payload=candidate.payload,
        )
        db.add(snapshot)
        await db.flush()
        existing.add(candidate.external_id)

        digest, result = await _digest(ctx, ai, source.kind, candidate.payload)
        snapshot.digest = digest
        await ai.record_usage(
            db, source.account_id, FEATURE_DIGEST, result, run.id,
            {"snapshot_id": snapshot.id, "external_id": candidate.external_id},
        )
        _add_tokens(run, result)
        created += 1
    return created


async def _same_as_last(db: AsyncSession, source_id: int, candidate: Candidate) -> bool:
    query = select(RadarSnapshot).where(RadarSnapshot.source_id == source_id)
    if candidate.prefix:
        query = query.where(RadarSnapshot.external_id.like(f"{candidate.prefix}%"))
    last = (await db.execute(
        query.order_by(RadarSnapshot.id.desc()).limit(1)
    )).scalars().first()
    if last is None:
        return False
    return _dedup_key_of(last) == candidate.dedup_key


def _dedup_key_of(snapshot: RadarSnapshot) -> str | None:
    payload = snapshot.payload or {}
    if snapshot.kind == "website":
        return payload.get("content_hash") or _sha1(payload.get("text") or "")
    if snapshot.kind == "gbusiness":
        texts = sorted(
            f"{r.get('author', '')}|{r.get('text', '')}" for r in (payload.get("reviews") or [])
        )
        return _sha1("\n".join(texts))
    if snapshot.kind == "company":
        return _sha1(_stable(payload.get("company") or {}))
    return None


async def _digest(ctx: RunCtx, ai: AIClient, kind: str, payload: dict):
    from . import prompts

    result = await ai.complete(
        prompts.system_prompt(ctx.business),
        prompts.digest_prompt(kind, ctx.business, payload, ctx.focus),
    )
    data = parse_json(result.text)
    return _fill_schema(getattr(prompts, "DIGEST_SCHEMAS", {}).get(kind), data), result


def _fill_schema(schema: dict | None, data: dict) -> dict:
    if not schema:
        return data
    props = schema.get("properties") or {}
    out = dict(data)
    for key, spec in props.items():
        if out.get(key) is None:
            out[key] = _default_for(spec)
    return out


def _default_for(spec: dict) -> Any:
    kind = spec.get("type")
    if isinstance(kind, list):
        kind = next((k for k in kind if k != "null"), None)
    if kind == "array":
        return []
    if kind == "object":
        return {}
    return None


def _add_tokens(run: RadarRun, result) -> None:
    run.tokens_in = (run.tokens_in or 0) + result.tokens_in
    run.tokens_out = (run.tokens_out or 0) + result.tokens_out
    run.cost_usd = (run.cost_usd or Decimal("0")) + Decimal(str(round(result.cost_usd, 6)))


# ─── Sinteza ──────────────────────────────────────────────────────────────────

async def _previous_run(db: AsyncSession, run: RadarRun) -> RadarRun | None:
    return (await db.execute(
        select(RadarRun)
        .where(
            RadarRun.account_id == run.account_id,
            RadarRun.status == "done",
            RadarRun.id != run.id,
        )
        .order_by(RadarRun.id.desc())
        .limit(1)
    )).scalars().first()


async def _synthesize(db: AsyncSession, run: RadarRun, ctx: RunCtx, ai: AIClient) -> None:
    from . import prompts

    previous = await _previous_run(db, run)
    period_to = date.today()
    period_from = period_to - timedelta(days=DEFAULT_PERIOD_DAYS)
    if previous is not None and previous.finished_at is not None:
        period_from = previous.finished_at.date()
    since = datetime.combine(period_from, datetime.min.time(), tzinfo=timezone.utc)

    rows = (await db.execute(
        select(RadarSnapshot, RadarSource.label, RadarSource.value)
        .join(RadarSource, RadarSource.id == RadarSnapshot.source_id)
        .where(
            RadarSnapshot.account_id == run.account_id,
            RadarSnapshot.collected_at >= since,
            RadarSnapshot.digest.isnot(None),
        )
        .order_by(RadarSnapshot.id)
    )).all()

    digests: list[dict] = []
    sections: dict[str, list[dict]] = {v: [] for v in SECTION_BY_KIND.values()}
    for snapshot, label, value in rows:
        entry = dict(snapshot.digest or {})
        entry["snapshot_id"] = snapshot.id
        entry["source_label"] = label or value
        digests.append({"kind": snapshot.kind, **entry})
        sections[SECTION_BY_KIND.get(snapshot.kind, "youtube")].append(entry)

    result = await ai.complete(
        prompts.system_prompt(ctx.business),
        prompts.synthesis_prompt(
            ctx.business, ctx.focus, digests,
            (previous.report if previous is not None else None),
            (period_from, period_to),
        ),
        max_tokens=8192,
    )
    data = parse_json(result.text)
    await ai.record_usage(
        db, run.account_id, FEATURE_SYNTHESIS, result, run.id, {"digests": len(digests)}
    )
    _add_tokens(run, result)

    report = _assemble_report(data, sections, period_from, period_to, previous is None)
    run.report = report
    run.title = (report.get("title") or "")[:300] or f"Radar {period_to.isoformat()}"
    run.period_from = period_from
    run.period_to = period_to


def _assemble_report(
    data: dict,
    sections: dict[str, list[dict]],
    period_from: date,
    period_to: date,
    first_report: bool,
) -> dict:
    report = dict(REPORT_DEFAULTS)
    report["decision_frame"] = dict(REPORT_DEFAULTS["decision_frame"])
    for key, value in (data or {}).items():
        if value is not None:
            report[key] = value
    report["version"] = 1
    report["generated_at"] = _now().isoformat()
    report["period"] = {"from": period_from.isoformat(), "to": period_to.isoformat()}
    report["sections"] = {key: list(value) for key, value in sections.items()}
    frame = report.get("decision_frame")
    if not isinstance(frame, dict):
        frame = {}
    for key, default in REPORT_DEFAULTS["decision_frame"].items():
        frame.setdefault(key, default if not isinstance(default, list) else [])
    report["decision_frame"] = frame
    for key in ("key_signals", "recommendations", "data_gaps"):
        if not isinstance(report.get(key), list):
            report[key] = []
    if not report.get("history_delta"):
        report["history_delta"] = "Primul raport." if first_report else ""
    if not isinstance(report.get("executive_summary"), str):
        report["executive_summary"] = ""
    return report
