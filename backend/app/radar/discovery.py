"""Descoperire concurenti: Google Places in zona -> date publice -> analiza AI."""
from __future__ import annotations

import asyncio
import logging
import math
import re
import unicodedata
from datetime import datetime, timezone
from decimal import Decimal
from html import unescape
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal
from app.models.company import Company
from app.models.item import Item
from app.models.radar import RadarDiscovery

from .ai import AIError, parse_json
from .engine import _load_ai_settings, _make_ai
from .types import FEATURE_DISCOVERY, BusinessContext, CollectorError, PlaceHit

log = logging.getLogger("berlinstar.radar.discovery")

DEFAULT_RADIUS_KM = 15
MAX_RADIUS_KM = 100
MAX_KEYWORDS = 6
MAX_COMPETITORS = 15
NEARBY_LIMIT = 20
SITE_CONCURRENCY = 4
SITE_TIMEOUT = 15.0
SITE_TEXT_MAX = 6000
SITE_EXCERPT_MAX = 1500
MAX_ITEMS = 60
DISTANCE_PENALTY = 0.05
MIN_ADDRESS_MATCH = 12

NO_AI_KEY = "Cheia Anthropic nu este configurată (AdminV2)."
NO_PLACES_KEY = "Cheia Google Places nu este configurată (AdminV2)."

QUESTION_IDS = ("location", "radius_km", "services", "keywords", "known_competitors", "exclusions")

_BASE_QUESTIONS: dict[str, dict] = {
    "location": {
        "question": "În ce localitate sau zonă căutăm concurenții?",
        "hint": "Precompletat din adresa firmei; poți scrie altă localitate.",
        "type": "text",
    },
    "radius_km": {
        "question": "Pe ce rază căutăm, în kilometri?",
        "hint": "15 km acoperă un oraș mediu și comunele din jur.",
        "type": "number",
    },
    "services": {
        "question": "Ce servicii sau produse vinde firma?",
        "hint": "Separate prin virgulă; precompletate din catalogul tău.",
        "type": "text",
    },
    "keywords": {
        "question": "Ce termeni ar căuta un client pe Google ca să te găsească?",
        "hint": "Separați prin virgulă, ex.: vulcanizare, service anvelope, hotel anvelope.",
        "type": "text",
    },
    "known_competitors": {
        "question": "Ce concurenți cunoști deja?",
        "hint": "Opțional, separați prin virgulă.",
        "type": "text",
    },
    "exclusions": {
        "question": "Ce vrei să ignorăm din rezultate?",
        "hint": "Opțional, ex.: francize, magazine online, dealeri auto.",
        "type": "text",
    },
}

COMPETITOR_KEYS = (
    "index", "name", "address", "distance_km", "place_id", "rating", "reviews_count",
    "website", "youtube_channel", "facebook", "phone", "cui", "cui_source", "types",
)

_COUNTY_RE = re.compile(r"^(?:jud\.?|judetul|județul)\s*(.+)$", re.IGNORECASE)
_CITY_RE = re.compile(
    r"^(?:mun\.?|municipiul|oras(?:ul)?|oraș(?:ul)?|com\.?|comuna|sat(?:ul)?|loc\.?)\s*(.+)$",
    re.IGNORECASE,
)
_STREET_RE = re.compile(
    r"^(?:str\.?|strada|bd\.?|b-?dul|bulevardul|calea|aleea|nr\.?|sc\.?|ap\.?|et\.?|bl\.?|"
    r"cod|piata|piața|drumul|sos\.?|șos\.?|dn\d|km)\b",
    re.IGNORECASE,
)
_YOUTUBE_RE = re.compile(r"youtube\.com/(@[\w.-]+|channel/UC[\w-]{22}|c/[\w.-]+)", re.IGNORECASE)
_FACEBOOK_RE = re.compile(r"facebook\.com/([\w.-]+)", re.IGNORECASE)
_CUI_RE = re.compile(
    r"(?:CUI|CIF|C\.U\.I\.|Cod fiscal|RO)\D{0,12}(\d{6,10})", re.IGNORECASE
)
_CHANNEL_ID_RE = re.compile(r"channel/(UC[\w-]{22})")
_TITLE_RE = re.compile(r"<title[^>]*>(.*?)</title>", re.IGNORECASE | re.DOTALL)
_DROP_TAG_RE = re.compile(r"<(script|style|noscript)[^>]*>.*?</\1>", re.IGNORECASE | re.DOTALL)
_ANY_TAG_RE = re.compile(r"<[^>]+>")
_FB_JUNK = {"sharer", "sharer.php", "share.php", "plugins", "dialog", "tr", "pages", "profile.php"}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _ro_message(exc: BaseException) -> str:
    return str(exc).strip() or "Eroare necunoscută la descoperirea concurenților."


def _text(value: Any) -> str:
    return str(value).strip() if value is not None else ""


def _no_diacritics(text: str) -> str:
    decomposed = unicodedata.normalize("NFKD", text or "")
    return "".join(ch for ch in decomposed if not unicodedata.combining(ch))


def _norm_text(text: str) -> str:
    plain = _no_diacritics(text).lower()
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9]+", " ", plain)).strip()


def _norm_name(name: str) -> str:
    """Nume comparabil: fara diacritice, minuscule, fara forma juridica."""
    plain = _norm_text(name)
    plain = re.sub(r"\b(srl|s r l|sa|s a|pfa|ii|snc|sca|sr|scs|s c)\b", " ", plain)
    return re.sub(r"\s+", " ", plain).strip()


def _split_list(value: Any, limit: int = 20) -> list[str]:
    if value is None:
        return []
    if isinstance(value, (list, tuple)):
        parts = [_text(v) for v in value]
    else:
        parts = re.split(r"[,;\n]+", _text(value))
    out: list[str] = []
    for part in parts:
        part = part.strip(" -•\t")
        if part and part.lower() not in {p.lower() for p in out}:
            out.append(part)
    return out[:limit]


def _radius_km(value: Any, fallback: Any = None) -> float:
    for candidate in (value, fallback):
        try:
            number = float(str(candidate).replace(",", ".").strip())
        except (TypeError, ValueError):
            continue
        if number > 0:
            return float(min(number, MAX_RADIUS_KM))
    return float(DEFAULT_RADIUS_KM)


def _haversine(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Distanta in km intre doua puncte."""
    radius = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2
    )
    return 2 * radius * math.asin(min(1.0, math.sqrt(a)))


def parse_address(address: str) -> tuple[str, str]:
    """(localitate, judet) din adrese romanesti („JUD. TIMIS, MUN. TIMISOARA, STR...")."""
    city = county = ""
    candidates: list[str] = []
    for raw in re.split(r"[,\n]+", _text(address)):
        part = raw.strip(" .")
        if not part:
            continue
        match = _COUNTY_RE.match(part)
        if match:
            county = county or match.group(1).strip()
            continue
        match = _CITY_RE.match(part)
        if match:
            city = city or match.group(1).strip()
            continue
        if not _STREET_RE.match(part) and not any(ch.isdigit() for ch in part):
            candidates.append(part)
    if not city and candidates:
        city = candidates[0]
    return _pretty(city), _pretty(county)


def _pretty(value: str) -> str:
    value = _text(value)
    if not value:
        return ""
    return value.title() if value.isupper() or value.islower() else value


def _keywords_from(services: list[str], activity: str) -> list[str]:
    words = [s for s in services if 2 < len(s) <= 60]
    if not words and activity:
        words = [w for w in re.split(r"[,.;\n]+", activity) if 2 < len(w.strip()) <= 60][:3]
    out: list[str] = []
    for word in words:
        word = word.strip().lower()
        if word and word not in out:
            out.append(word)
    return out[:MAX_KEYWORDS]


async def _account_items(db: AsyncSession, account_id: int) -> list[dict]:
    rows = (await db.execute(
        select(Item)
        .where(Item.account_id == account_id, Item.is_deleted == False)  # noqa: E712
        .order_by(Item.id)
        .limit(MAX_ITEMS)
    )).scalars().all()
    return [
        {
            "name": item.name,
            "type": item.type.value if hasattr(item.type, "value") else str(item.type),
            "price": float(item.price) if item.price is not None else None,
            "unit": item.unit,
        }
        for item in rows
    ]


async def build_profile_draft(db: AsyncSession, company: Company) -> dict:
    """Draft de profil pentru firma aleasa: zona, activitate, servicii, cuvinte-cheie."""
    address = _text(company.address) or " ".join(
        p for p in (_text(company.street), _text(company.city)) if p
    )
    city, county = parse_address(address)
    city = city or _text(company.city)
    county = county or _text(company.county_code)
    items = await _account_items(db, company.account_id)
    services = _split_list([i["name"] for i in items])
    activity = re.sub(r"\s+", " ", _text(company.description))[:600]
    return {
        "company_id": company.id,
        "name": _text(company.name),
        "cui": company.cui,
        "address": address,
        "city": city,
        "county": county,
        "lat": None,
        "lng": None,
        "activity": activity,
        "services": services,
        "keywords": _keywords_from(services, activity),
        "radius_km": DEFAULT_RADIUS_KM,
        "known_competitors": [],
        "exclusions": [],
    }


def merge_answers(profile_draft: dict, answers: dict | None) -> dict:
    """Profilul final de căutare: raspunsurile utilizatorului peste draft."""
    profile = dict(profile_draft or {})
    answers = answers or {}

    location = _text(answers.get("location"))
    if location:
        city, county = parse_address(location)
        profile["city"] = city or location
        if county:
            profile["county"] = county

    services = _split_list(answers.get("services")) or list(profile.get("services") or [])
    keywords = _split_list(answers.get("keywords")) or _keywords_from(
        services, _text(profile.get("activity"))
    )
    profile["services"] = services
    profile["keywords"] = [k.lower() for k in keywords][:12]
    profile["radius_km"] = _radius_km(answers.get("radius_km"), profile.get("radius_km"))
    profile["known_competitors"] = _split_list(answers.get("known_competitors"))
    profile["exclusions"] = _split_list(answers.get("exclusions"))
    profile.setdefault("lat", None)
    profile.setdefault("lng", None)
    return profile


# ─── Intrebari-prerechizite ───────────────────────────────────────────────────

def _prompts():
    from . import discovery_prompts

    return discovery_prompts


def _system(profile: dict, items: list[dict]) -> str:
    from . import prompts

    ctx = BusinessContext(
        account_name=_text(profile.get("name")),
        companies=[{
            "cui": profile.get("cui"),
            "name": _text(profile.get("name")),
            "address": _text(profile.get("address")),
            "website": "",
            "description": _text(profile.get("activity")),
        }],
        items=items,
        business_context=_text(profile.get("activity")),
    )
    return prompts.system_prompt(ctx)


def _suggested(question_id: str, draft: dict) -> Any:
    if question_id == "location":
        parts = [p for p in (_text(draft.get("city")), _text(draft.get("county"))) if p]
        return ", ".join(parts)
    if question_id == "radius_km":
        return draft.get("radius_km") or DEFAULT_RADIUS_KM
    if question_id == "services":
        return ", ".join(draft.get("services") or [])
    if question_id == "keywords":
        return ", ".join(draft.get("keywords") or [])
    return ""


def _merge_questions(draft: dict, items: list[dict], ai_questions: dict[str, dict]) -> list[dict]:
    defaults: dict[str, dict] = {}
    try:
        for question in _prompts().default_questions(draft, items) or []:
            if isinstance(question, dict) and question.get("id"):
                defaults[str(question["id"])] = question
    except Exception as exc:  # noqa: BLE001
        log.warning("Descoperire: default_questions a esuat: %s", exc)

    out: list[dict] = []
    for question_id in QUESTION_IDS:
        base = dict(_BASE_QUESTIONS[question_id])
        base["suggested"] = _suggested(question_id, draft)
        for source in (defaults.get(question_id), ai_questions.get(question_id)):
            for key in ("question", "hint", "type", "suggested"):
                value = (source or {}).get(key)
                if value not in (None, "", []):
                    base[key] = value
        if base.get("type") not in ("text", "number"):
            base["type"] = _BASE_QUESTIONS[question_id]["type"]
        out.append({
            "id": question_id,
            "question": _text(base.get("question")),
            "hint": _text(base.get("hint")),
            "type": base["type"],
            "suggested": base.get("suggested"),
        })
    return out


async def prepare(db: AsyncSession, account_id: int, company: Company) -> dict:
    """Intrebarile-prerechizite + draftul de profil (AI daca exista cheie Anthropic)."""
    draft = await build_profile_draft(db, company)
    items = await _account_items(db, account_id)
    ai_questions: dict[str, dict] = {}
    ai_used = False

    settings = await _load_ai_settings(db)
    if getattr(settings, "api_key", None):
        try:
            ai = _make_ai(settings)
            result = await ai.complete(
                _system(draft, items), _prompts().prepare_prompt(draft, items), max_tokens=2048
            )
            data = parse_json(result.text)
            await ai.record_usage(
                db, account_id, FEATURE_DISCOVERY, result, None, {"step": "prepare"}
            )
            await db.commit()
            for question in data.get("questions") or []:
                if isinstance(question, dict) and question.get("id"):
                    ai_questions[str(question["id"])] = question
            activity = _text(data.get("activity"))
            if activity:
                draft["activity"] = activity
            ai_used = True
        except Exception as exc:  # noqa: BLE001
            log.warning("Descoperire: pregatirea cu AI a esuat: %s", exc)
            await db.rollback()

    if ai_questions.get("keywords", {}).get("suggested"):
        draft["keywords"] = _split_list(ai_questions["keywords"]["suggested"], MAX_KEYWORDS)
    return {
        "questions": _merge_questions(draft, items, ai_questions),
        "profile_draft": draft,
        "ai_used": ai_used,
    }


# ─── Colectare (indirectata, ca sa poata fi inlocuita in teste) ───────────────

async def _places_geocode(address: str, api_key: str):
    from .collectors import gplaces

    return await gplaces.geocode(address, api_key)


async def _places_search(
    query: str, api_key: str, lat: float, lng: float, radius_m: float, limit: int = NEARBY_LIMIT
) -> list[PlaceHit]:
    from .collectors import gplaces

    return await gplaces.search_nearby(query, api_key, lat, lng, radius_m, limit)


async def _fetch_site(url: str, client: httpx.AsyncClient) -> str:
    """HTML-ul paginii de start; linkurile externe (YouTube/Facebook) si CUI-ul se caută în el."""
    from .collectors.website import BROWSER_UA, normalize_url

    resp = await client.get(
        normalize_url(url), headers={"User-Agent": BROWSER_UA, "Accept-Language": "ro,en;q=0.8"}
    )
    if resp.status_code >= 400:
        raise CollectorError(f"Site-ul a răspuns cu eroare ({resp.status_code}).")
    return resp.text


async def _anaf_company(cui: int):
    from .collectors import anaf

    return await anaf.fetch_company(cui)


# ─── Rulare ───────────────────────────────────────────────────────────────────

async def run_discovery(discovery_id: int) -> None:
    """Ruleaza o descoperire de concurenti. Nu ridica — erorile ajung in `error`."""
    async with AsyncSessionLocal() as db:
        discovery = await db.get(RadarDiscovery, discovery_id)
        if discovery is None:
            log.warning("Descoperirea %s nu exista.", discovery_id)
            return
        try:
            await _execute(db, discovery)
        except Exception as exc:  # noqa: BLE001
            log.exception("Descoperirea %s a esuat.", discovery_id)
            try:
                await db.rollback()
                discovery = await db.get(RadarDiscovery, discovery_id)
                if discovery is not None:
                    discovery.status = "error"
                    discovery.error = _ro_message(exc)
                    discovery.finished_at = _now()
                await db.commit()
            except Exception:  # noqa: BLE001
                log.exception("Nu am putut salva eroarea descoperirii %s.", discovery_id)


def _progress(
    discovery: RadarDiscovery, step: str, done: int, total: int, message: str | None
) -> None:
    current = dict(discovery.progress or {})
    entries = list(current.get("log") or [])
    if message:
        entries.append(message)
    discovery.progress = {"step": step, "done": done, "total": total, "log": entries[-60:]}


async def _execute(db: AsyncSession, discovery: RadarDiscovery) -> None:
    total = 5
    discovery.status = "running"
    discovery.error = None
    _progress(discovery, "Pornire", 0, total, None)
    await db.commit()

    settings = await _load_ai_settings(db)
    if not (getattr(settings, "api_key", "") or ""):
        raise AIError(NO_AI_KEY)
    places_key = getattr(settings, "places_key", "") or ""
    if not places_key:
        raise CollectorError(NO_PLACES_KEY)
    ai = _make_ai(settings)

    company = await db.get(Company, discovery.company_id)
    if company is None:
        raise CollectorError("Firma selectată nu mai există.")
    profile = dict(discovery.profile or {})
    if not profile:
        profile = merge_answers(
            await build_profile_draft(db, company), discovery.answers or {}
        )

    _progress(discovery, "Localizez firma", 1, total, None)
    await db.commit()
    lat, lng = profile.get("lat"), profile.get("lng")
    if lat is None or lng is None:
        query = _text(profile.get("address")) or " ".join(
            p for p in (_text(profile.get("name")), _text(profile.get("city"))) if p
        )
        coords = await _places_geocode(query, places_key)
        if not coords:
            raise CollectorError(
                "Nu am putut localiza adresa firmei pe hartă. Verifică adresa din Firme."
            )
        lat, lng = coords
    profile["lat"], profile["lng"] = float(lat), float(lng)
    discovery.profile = profile
    await db.commit()

    radius_km = _radius_km(profile.get("radius_km"))
    keywords = [k for k in (profile.get("keywords") or []) if _text(k)][:MAX_KEYWORDS]
    if not keywords:
        keywords = _keywords_from(
            list(profile.get("services") or []), _text(profile.get("activity"))
        ) or [_text(profile.get("activity"))[:60] or _text(profile.get("name"))]

    _progress(discovery, "Caut concurenți în zonă", 2, total, None)
    await db.commit()
    hits: dict[str, PlaceHit] = {}
    for keyword in keywords:
        try:
            found = await _places_search(
                keyword, places_key, lat, lng, radius_km * 1000, NEARBY_LIMIT
            )
        except Exception as exc:  # noqa: BLE001
            log.warning("Descoperire: căutarea „%s” a eșuat: %s", keyword, exc)
            _progress(
                discovery, "Caut concurenți în zonă", 2, total,
                f"Căutarea „{keyword}” a eșuat: {_ro_message(exc)}",
            )
            await db.commit()
            continue
        for hit in found:
            hits.setdefault(hit.place_id, hit)
        _progress(
            discovery, "Caut concurenți în zonă", 2, total,
            f"„{keyword}”: {len(found)} rezultate",
        )
        await db.commit()

    competitors = rank_competitors(list(hits.values()), profile, lat, lng)
    if not competitors:
        raise CollectorError(
            "Nu am găsit concurenți pentru termenii și zona indicate. Încearcă alți termeni sau o rază mai mare."
        )

    _progress(
        discovery, "Culeg date publice", 3, total,
        f"{len(competitors)} concurenți selectați din {len(hits)} rezultate.",
    )
    await db.commit()
    for message in await _enrich_all(competitors):
        _progress(discovery, "Culeg date publice", 3, total, message)
    await db.commit()

    _progress(discovery, "Analiză AI", 4, total, None)
    await db.commit()
    discovery.result = await _analyze(db, discovery, ai, profile, competitors)
    discovery.status = "done"
    discovery.finished_at = _now()
    _progress(discovery, "Gata", total, total, f"{len(competitors)} concurenți analizați.")
    await db.commit()


def rank_competitors(
    hits: list[PlaceHit], profile: dict, lat: float, lng: float
) -> list[dict]:
    """Exclude firma proprie si excluderile; scor rating*ln(1+recenzii) - 0.05*km, top 15."""
    own_name = _norm_name(profile.get("name") or "")
    own_address = _norm_text(profile.get("address") or "")
    exclusions = [_norm_text(e) for e in (profile.get("exclusions") or []) if _text(e)]

    scored: list[tuple[float, dict]] = []
    for hit in hits:
        name = _norm_name(getattr(hit, "name", "") or "")
        if not name:
            continue
        if own_name and (name == own_name or (len(name) > 4 and (name in own_name or own_name in name))):
            continue
        address = _norm_text(getattr(hit, "address", "") or "")
        if _same_address(address, own_address):
            continue
        types = list(getattr(hit, "types", None) or [])
        haystack = " ".join([name, address, _norm_text(" ".join(types))])
        if any(term and term in haystack for term in exclusions):
            continue

        distance = None
        if getattr(hit, "lat", None) is not None and getattr(hit, "lng", None) is not None:
            distance = _haversine(lat, lng, float(hit.lat), float(hit.lng))
        rating = float(hit.rating or 0)
        reviews = int(hit.reviews_count or 0)
        score = rating * math.log(1 + reviews) - DISTANCE_PENALTY * (distance or 0)
        scored.append((score, {
            "index": 0,
            "name": getattr(hit, "name", "") or "",
            "address": getattr(hit, "address", "") or "",
            "distance_km": round(distance, 2) if distance is not None else None,
            "place_id": getattr(hit, "place_id", "") or "",
            "rating": hit.rating,
            "reviews_count": hit.reviews_count,
            "website": getattr(hit, "website", "") or "",
            "youtube_channel": "",
            "facebook": "",
            "phone": getattr(hit, "phone", "") or "",
            "cui": None,
            "cui_source": None,
            "types": types,
            "site_title": "",
            "site_excerpt": "",
            "anaf_name": "",
        }))

    scored.sort(key=lambda row: row[0], reverse=True)
    out = []
    for index, (_score, competitor) in enumerate(scored[:MAX_COMPETITORS]):
        competitor["index"] = index
        out.append(competitor)
    return out


# ─── Imbogatire per concurent ─────────────────────────────────────────────────

def _site_text(html: str) -> tuple[str, str]:
    title = ""
    match = _TITLE_RE.search(html or "")
    if match:
        title = re.sub(r"\s+", " ", unescape(match.group(1))).strip()[:200]
    body = _ANY_TAG_RE.sub(" ", _DROP_TAG_RE.sub(" ", html or ""))
    text = re.sub(r"\s+", " ", unescape(body)).strip()[:SITE_TEXT_MAX]
    return title, text


def _find_youtube(html: str) -> str:
    match = _YOUTUBE_RE.search(html or "")
    return f"https://www.youtube.com/{match.group(1)}" if match else ""


def _find_facebook(html: str) -> str:
    for match in _FACEBOOK_RE.finditer(html or ""):
        slug = match.group(1)
        if len(slug) > 2 and slug.lower() not in _FB_JUNK and not slug.lower().endswith(".php"):
            return f"https://www.facebook.com/{slug}"
    return ""


def _find_cui(text: str) -> int | None:
    for match in _CUI_RE.finditer(text or ""):
        digits = match.group(1)
        if len(set(digits)) > 1:
            return int(digits)
    return None


def _same_address(address: str, own_address: str) -> bool:
    if len(address) < MIN_ADDRESS_MATCH or len(own_address) < MIN_ADDRESS_MATCH:
        return False
    return address in own_address or own_address in address


def _names_match(first: str, second: str) -> bool:
    a, b = _norm_name(first), _norm_name(second)
    if not a or not b:
        return False
    if a == b or a in b or b in a:
        return True
    tokens_a = {t for t in a.split() if len(t) >= 4}
    tokens_b = {t for t in b.split() if len(t) >= 4}
    return bool(tokens_a & tokens_b)


async def _enrich_one(competitor: dict, client: httpx.AsyncClient) -> None:
    url = _text(competitor.get("website"))
    if url:
        html = await _fetch_site(url, client)
        title, text = _site_text(html)
        competitor["site_title"] = title
        competitor["site_excerpt"] = text[:SITE_EXCERPT_MAX]
        competitor["youtube_channel"] = _find_youtube(html)
        competitor["facebook"] = _find_facebook(html)
        cui = _find_cui(text) or _find_cui(html)
        if cui:
            competitor["cui"] = cui
            competitor["cui_source"] = "site"
    if not competitor.get("cui"):
        return
    try:
        info = await _anaf_company(int(competitor["cui"]))
    except Exception as exc:  # noqa: BLE001
        log.info("Descoperire: ANAF nu a confirmat CUI %s: %s", competitor.get("cui"), exc)
        return
    anaf_name = _text(getattr(info, "name", "") or "")
    competitor["anaf_name"] = anaf_name
    if _names_match(anaf_name, competitor.get("name") or ""):
        competitor["cui"] = int(getattr(info, "cui", competitor["cui"]) or competitor["cui"])
        competitor["cui_source"] = "anaf"


async def _enrich_all(competitors: list[dict]) -> list[str]:
    """Site + YouTube + Facebook + CUI/ANAF, max 4 in paralel; esecurile doar se noteaza."""
    if not competitors:
        return []
    semaphore = asyncio.Semaphore(SITE_CONCURRENCY)

    async def _one(competitor: dict):
        async with semaphore:
            return await _enrich_one(competitor, client)

    async with httpx.AsyncClient(timeout=SITE_TIMEOUT, follow_redirects=True) as client:
        results = await asyncio.gather(
            *(_one(c) for c in competitors), return_exceptions=True
        )
    messages = []
    for competitor, result in zip(competitors, results):
        if isinstance(result, BaseException):
            log.info("Descoperire: %s nu a putut fi îmbogățit: %s", competitor.get("name"), result)
            messages.append(f"{competitor.get('name')}: {_ro_message(result)}")
    return messages


# ─── Analiza AI ───────────────────────────────────────────────────────────────

def _compact(competitor: dict) -> dict:
    return {
        "index": competitor.get("index"),
        "name": competitor.get("name"),
        "address": competitor.get("address"),
        "distance_km": competitor.get("distance_km"),
        "rating": competitor.get("rating"),
        "reviews_count": competitor.get("reviews_count"),
        "types": competitor.get("types") or [],
        "website": competitor.get("website"),
        "site_title": competitor.get("site_title"),
        "site_excerpt": (competitor.get("site_excerpt") or "")[:SITE_EXCERPT_MAX],
        "youtube_channel": competitor.get("youtube_channel"),
        "cui": competitor.get("cui"),
        "anaf_name": competitor.get("anaf_name"),
    }


def _str_list(value: Any, limit: int = 12) -> list[str]:
    if not isinstance(value, (list, tuple)):
        return []
    return [_text(v) for v in value if _text(v)][:limit]


def _clamp_int(value: Any, low: int, high: int, default: int) -> int:
    try:
        return max(low, min(high, int(float(value))))
    except (TypeError, ValueError):
        return default


def _findings(value: Any) -> list[dict]:
    out = []
    for entry in value or []:
        if not isinstance(entry, dict):
            continue
        refs = [r for r in (entry.get("source_refs") or []) if isinstance(r, int)]
        impact = entry.get("impact")
        out.append({
            "title": _text(entry.get("title")),
            "insight": _text(entry.get("insight")),
            "impact": impact if impact in ("high", "medium", "low") else "medium",
            "source_refs": refs,
        })
    return out


def assemble_result(data: dict, profile: dict, competitors: list[dict]) -> dict:
    """DiscoveryResult v1: campurile determinist + imbogatirea AI pe `index`."""
    by_index: dict[int, dict] = {}
    for entry in (data or {}).get("competitors") or []:
        if isinstance(entry, dict) and isinstance(entry.get("index"), int):
            by_index[entry["index"]] = entry

    out_competitors = []
    for competitor in competitors:
        merged = {key: competitor.get(key) for key in COMPETITOR_KEYS}
        merged["types"] = list(competitor.get("types") or [])
        enrichment = by_index.get(competitor.get("index")) or {}
        threat = enrichment.get("threat")
        merged["positioning"] = _text(enrichment.get("positioning"))
        merged["strengths"] = _str_list(enrichment.get("strengths"))
        merged["weaknesses"] = _str_list(enrichment.get("weaknesses"))
        merged["threat"] = threat if threat in ("high", "medium", "low") else "medium"
        merged["relevance"] = _clamp_int(enrichment.get("relevance"), 0, 100, 0)
        merged["evidence"] = _str_list(enrichment.get("evidence"))
        out_competitors.append(merged)

    return {
        "version": 1,
        "generated_at": _now().isoformat(),
        "profile": dict(profile),
        "competitors": out_competitors,
        "market_summary": _text((data or {}).get("market_summary")),
        "findings": _findings((data or {}).get("findings")),
        "suggested_focus": _text((data or {}).get("suggested_focus")),
        "data_gaps": _str_list((data or {}).get("data_gaps"), 20),
    }


async def _analyze(
    db: AsyncSession, discovery: RadarDiscovery, ai, profile: dict, competitors: list[dict]
) -> dict:
    items = [{"name": s} for s in (profile.get("services") or [])]
    result = await ai.complete(
        _system(profile, items),
        _prompts().analysis_prompt(profile, [_compact(c) for c in competitors]),
        max_tokens=8192,
    )
    if result.stop_reason == "max_tokens":
        raise AIError("Răspunsul AI a fost trunchiat; încearcă o rază mai mică.")
    data = parse_json(result.text)
    await ai.record_usage(
        db, discovery.account_id, FEATURE_DISCOVERY, result, None,
        {"discovery_id": discovery.id, "competitors": len(competitors)},
    )
    discovery.tokens_in = (discovery.tokens_in or 0) + result.tokens_in
    discovery.tokens_out = (discovery.tokens_out or 0) + result.tokens_out
    discovery.cost_usd = (discovery.cost_usd or Decimal("0")) + Decimal(
        str(round(result.cost_usd, 6))
    )
    return assemble_result(data, profile, competitors)
