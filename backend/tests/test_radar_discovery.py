"""Descoperire concurenti: profil, scor, rulare completa (fara retea), import surse.

Rulabil direct: python -m tests.test_radar_discovery
"""
from __future__ import annotations

import json
import sys
import types
from decimal import Decimal

from cryptography.fernet import Fernet
from sqlalchemy import func, select

from app.efactura.crypto import encrypt, set_fernet_key
from app.models.base import Base
from app.models.company import Company
from app.models.global_settings import GlobalSettings
from app.models.radar import AiUsage, RadarDiscovery, RadarSource
from app.radar import discovery as disc_mod
from app.radar.ai import AIClient
from app.radar.discovery import (
    QUESTION_IDS,
    build_profile_draft,
    merge_answers,
    rank_competitors,
    run_discovery,
)
from app.radar.types import AIResult, CollectorError, CompanyInfo, PlaceHit
from app.routers import radar_discovery
from app.schemas.radar import DiscoveryCreate, ImportIn, ImportItem, PrepareIn
from tests._harness import make_account, make_item, make_session, raises_http, run

TABLE_NAMES = ("radar_sources", "radar_settings", "radar_runs", "radar_snapshots",
               "ai_usage", "radar_discoveries")

ADDRESS_1 = "JUD. TIMIS, MUN. TIMISOARA, STR. GHEORGHE LAZAR NR. 5"
ADDRESS_2 = "Timișoara, jud. Timiș"

SITE_A = """<html><head><title>Vulcanizare A - anvelope</title></head><body>
<p>Servicii complete. CUI 12345678</p>
<a href="https://www.youtube.com/channel/UC12345678901234567890ab">canal</a>
<a href="https://facebook.com/sharer.php?u=x">share</a>
<a href="https://facebook.com/vulcanizarea">pagina</a>
</body></html>"""
SITE_C = """<html><head><title>Service C</title></head><body>
<footer>CIF: 87654321</footer></body></html>"""

AI_ANALYSIS = {
    "competitors": [
        {"index": 0, "positioning": "lider local", "strengths": ["recenzii"],
         "weaknesses": ["preturi"], "threat": "high", "relevance": 90,
         "evidence": ["site"]},
        {"index": 1, "positioning": "mic", "strengths": [], "weaknesses": [],
         "threat": "gigantic", "relevance": 500, "evidence": []},
        {"index": 99, "positioning": "inexistent", "threat": "high"},
    ],
    "market_summary": "**Piata** e aglomerata.",
    "findings": [{"title": "Preturi", "insight": "Sub media", "impact": "high",
                  "source_refs": [0]}],
    "suggested_focus": "Urmarim preturile la anvelope iarna.",
    "data_gaps": ["Fara date financiare"],
}


async def _db():
    """Sesiune de harness + tabelele Radar (nu sunt in subsetul implicit)."""
    db = await make_session()
    tables = [Base.metadata.tables[name] for name in TABLE_NAMES]
    conn = await db.connection()
    await conn.run_sync(lambda c: Base.metadata.create_all(c, tables=tables, checkfirst=True))
    await db.commit()
    return db


async def _company(db, account, address=ADDRESS_1, name="Anvelope Mele SRL"):
    company = Company(account_id=account.id, cui=111222, name=name, address=address,
                      description="Vulcanizare si hotel de anvelope.")
    db.add(company)
    await db.flush()
    return company


class FakeAISettings:
    def __init__(self, api_key="k-test", places_key="p-test"):
        self.api_key = api_key
        self.places_key = places_key
        self.model = "fake-model"
        self.price_in = 3.0
        self.price_out = 15.0


class FakeAI(AIClient):
    """Client AI determinist pentru descoperire."""

    def __init__(self, reply: str = "auto"):
        super().__init__(api_key="test", model="fake-model", price_in=3.0, price_out=15.0)
        self.calls: list[str] = []
        self.reply = reply

    async def complete(self, system, user, max_tokens=4096):
        self.calls.append(user)
        if self.reply == "analysis" or user.startswith("ANALIZA"):
            text = "```json\n" + json.dumps(AI_ANALYSIS, ensure_ascii=False) + "\n```"
        else:
            text = json.dumps({"questions": [
                {"id": "keywords", "question": "Ce caută clienții?", "hint": "virgule",
                 "type": "text", "suggested": "vulcanizare, jante"}],
                "activity": "Vulcanizare in Timisoara."}, ensure_ascii=False)
        return AIResult(text=text, tokens_in=120, tokens_out=60,
                        cost_usd=self.cost(120, 60), model=self.model)


def _fake_prompts() -> types.ModuleType:
    module = types.ModuleType("app.radar.discovery_prompts")
    module.default_questions = lambda draft, items: [
        {"id": "location", "question": "In ce zona?", "hint": "din adresa", "type": "text",
         "suggested": draft.get("city")},
        {"id": "radius_km", "question": "Ce raza?", "hint": "km", "type": "number",
         "suggested": 15},
    ]
    module.prepare_prompt = lambda draft, items: "PREGATIRE"
    module.analysis_prompt = lambda profile, competitors: "ANALIZA:" + json.dumps(
        competitors, ensure_ascii=False
    )
    module.DISCOVERY_SCHEMA = {}
    return module


class _SessionFactory:
    def __init__(self, db):
        self.db = db

    def __call__(self):
        return self

    async def __aenter__(self):
        return self.db

    async def __aexit__(self, *exc):
        return False


class Patch:
    """Inlocuieste temporar sesiunea, setarile AI, colectorii si prompturile."""

    NAMES = ("AsyncSessionLocal", "_load_ai_settings", "_make_ai", "_places_geocode",
             "_places_search", "_fetch_site", "_anaf_company")

    def __init__(self, db, ai=None, ai_settings=None, geocode=None, search=None,
                 sites=None, anaf=None, real_prompts=False):
        self.db = db
        self.ai = ai
        self.ai_settings = ai_settings or FakeAISettings()
        self.geocode = geocode
        self.search = search
        self.sites = sites or {}
        self.anaf = anaf or {}
        self.real_prompts = real_prompts
        self.saved: dict = {}
        self.saved_module = None
        self.saved_attr = None
        self.package = None

    def __enter__(self):
        import app.radar as radar_pkg

        self.package = radar_pkg
        self.saved_module = sys.modules.get("app.radar.discovery_prompts")
        self.saved_attr = getattr(radar_pkg, "discovery_prompts", None)
        if not self.real_prompts:
            fake = _fake_prompts()
            sys.modules["app.radar.discovery_prompts"] = fake
            radar_pkg.discovery_prompts = fake
        for name in self.NAMES:
            self.saved[name] = getattr(disc_mod, name)
        disc_mod.AsyncSessionLocal = _SessionFactory(self.db)

        async def _settings(db):
            return self.ai_settings

        disc_mod._load_ai_settings = _settings
        if self.ai is not None:
            disc_mod._make_ai = lambda settings: self.ai

        async def _geocode(address, api_key):
            return self.geocode

        async def _search(query, api_key, lat, lng, radius_m, limit=20):
            return list((self.search or {}).get(query, []))

        async def _fetch(url, client):
            html = self.sites.get(url)
            if html is None:
                raise CollectorError("Site-ul nu răspunde.")
            return html

        async def _anaf(cui):
            info = self.anaf.get(int(cui))
            if info is None:
                raise CollectorError("CUI inexistent la ANAF.")
            return info

        disc_mod._places_geocode = _geocode
        disc_mod._places_search = _search
        disc_mod._fetch_site = _fetch
        disc_mod._anaf_company = _anaf
        return self

    def __exit__(self, *exc):
        for name, value in self.saved.items():
            setattr(disc_mod, name, value)
        if self.real_prompts:
            return False
        if self.saved_module is None:
            sys.modules.pop("app.radar.discovery_prompts", None)
        else:
            sys.modules["app.radar.discovery_prompts"] = self.saved_module
        if self.saved_attr is None:
            if hasattr(self.package, "discovery_prompts"):
                delattr(self.package, "discovery_prompts")
        else:
            self.package.discovery_prompts = self.saved_attr
        return False


# ─── Profil si raspunsuri ─────────────────────────────────────────────────────

async def test_profile_draft_parses_both_address_formats():
    db = await _db()
    account = await make_account(db, "descoperire", "desc")
    await make_item(db, account, "Vulcanizare", "50.00")
    await db.commit()

    company = await _company(db, account, ADDRESS_1)
    draft = await build_profile_draft(db, company)
    assert (draft["city"], draft["county"]) == ("Timisoara", "Timis")
    assert draft["services"] == ["Vulcanizare"]
    assert draft["keywords"] == ["vulcanizare"]
    assert draft["radius_km"] == 15
    assert draft["activity"].startswith("Vulcanizare si hotel")
    assert (draft["company_id"], draft["cui"]) == (company.id, 111222)
    assert draft["lat"] is None and draft["lng"] is None

    company.address = ADDRESS_2
    await db.flush()
    draft = await build_profile_draft(db, company)
    assert (draft["city"], draft["county"]) == ("Timișoara", "Timiș")


def test_merge_answers_normalises_lists_and_radius():
    draft = {"name": "Firma", "city": "Timisoara", "county": "Timis", "services": ["Ulei"],
             "activity": "service auto", "radius_km": 15, "keywords": ["ulei"]}
    profile = merge_answers(draft, {
        "location": "Lugoj, jud. Timiș",
        "radius_km": "25,5",
        "services": " Vulcanizare , Hotel anvelope ,, ",
        "keywords": "Vulcanizare, service anvelope\nhotel anvelope",
        "known_competitors": "Alfa SRL, Beta",
        "exclusions": "francize",
    })
    assert (profile["city"], profile["county"]) == ("Lugoj", "Timiș")
    assert profile["radius_km"] == 25.5
    assert profile["services"] == ["Vulcanizare", "Hotel anvelope"]
    assert profile["keywords"] == ["vulcanizare", "service anvelope", "hotel anvelope"]
    assert profile["known_competitors"] == ["Alfa SRL", "Beta"]
    assert profile["exclusions"] == ["francize"]

    # Raspunsuri lipsa: raza revine la 15, cuvintele-cheie se deduc din servicii.
    fallback = merge_answers(draft, {"radius_km": "aiurea"})
    assert fallback["radius_km"] == 15.0
    assert fallback["keywords"] == ["ulei"]


def test_scoring_drops_own_company_and_keeps_top_15():
    profile = {"name": "Anvelope Mele SRL", "address": "Str. Gheorghe Lazar 5, Timisoara",
               "exclusions": ["dealer"]}
    hits = [
        PlaceHit(place_id="own", name="Anvelope Mele S.R.L.", address="Alta adresa",
                 lat=45.75, lng=21.22, rating=4.9, reviews_count=100),
        PlaceHit(place_id="addr", name="Alt Nume", address="Str. Gheorghe Lazar 5, Timisoara",
                 lat=45.75, lng=21.22, rating=5.0, reviews_count=200),
        PlaceHit(place_id="excl", name="Dealer Oficial", address="Calea Aradului 100", lat=45.75, lng=21.22,
                 rating=5.0, reviews_count=300),
        PlaceHit(place_id="near", name="Vulcanizare Aproape", address="Str. Aproape 1", lat=45.75,
                 lng=21.22, rating=4.0, reviews_count=50),
        PlaceHit(place_id="far", name="Vulcanizare Departe", address="Str. Departe 2", lat=46.20,
                 lng=21.22, rating=4.0, reviews_count=50),
    ]
    hits += [PlaceHit(place_id=f"x{i}", name=f"Service {i}", address=f"Str. Service {i}", lat=45.75,
                      lng=21.22, rating=3.0, reviews_count=5) for i in range(20)]

    ranked = rank_competitors(hits, profile, 45.75, 21.22)
    ids = [c["place_id"] for c in ranked]
    assert "own" not in ids and "addr" not in ids and "excl" not in ids
    assert len(ranked) == 15
    assert ids[0] == "near" and ids[1] == "far"
    assert [c["index"] for c in ranked] == list(range(15))
    assert ranked[0]["distance_km"] == 0.0 and ranked[1]["distance_km"] > 40
    assert ranked[0]["cui"] is None and ranked[0]["cui_source"] is None


# ─── Rulare completa ──────────────────────────────────────────────────────────

async def _run_fixture(db):
    account = await make_account(db, "descoperire", "desc")
    await make_item(db, account, "Vulcanizare", "50.00")
    company = await _company(db, account)
    await db.commit()
    profile = merge_answers(await build_profile_draft(db, company),
                            {"keywords": "vulcanizare", "radius_km": "10"})
    discovery = RadarDiscovery(account_id=account.id, company_id=company.id, status="queued",
                               answers={"keywords": "vulcanizare"}, profile=profile,
                               progress={"step": "in asteptare", "done": 0, "total": 0, "log": []})
    db.add(discovery)
    await db.commit()
    return account, company, discovery


async def test_full_run_produces_result_and_usage():
    db = await _db()
    account, _company_row, discovery = await _run_fixture(db)
    hits = [
        PlaceHit(place_id="own", name="Anvelope Mele SRL", address=ADDRESS_1, lat=45.75,
                 lng=21.22, rating=4.8, reviews_count=90),
        PlaceHit(place_id="p1", name="Vulcanizare A", address="Str. A 1", lat=45.75, lng=21.22,
                 rating=4.7, reviews_count=120, website="https://a.ro", phone="0700",
                 primary_type="tire_shop", types=["tire_shop"]),
        PlaceHit(place_id="p2", name="Vulcanizare B", address="Str. B 2", lat=45.76, lng=21.23,
                 rating=4.5, reviews_count=60, website="https://b.ro"),
        PlaceHit(place_id="p3", name="Service C", address="Str. C 3", lat=45.77, lng=21.24,
                 rating=4.0, reviews_count=20, website="https://c.ro"),
    ]
    ai = FakeAI()
    patch = Patch(
        db, ai=ai, geocode=(45.75, 21.22), search={"vulcanizare": hits},
        sites={"https://a.ro": SITE_A, "https://c.ro": SITE_C},
        anaf={12345678: CompanyInfo(cui=12345678, name="VULCANIZARE A SRL"),
              87654321: CompanyInfo(cui=87654321, name="Web Design Total SRL")},
    )
    with patch:
        await run_discovery(discovery.id)

    await db.refresh(discovery)
    assert discovery.status == "done", f"status={discovery.status} err={discovery.error}"
    assert discovery.error is None
    result = discovery.result
    assert result["version"] == 1 and result["profile"]["lat"] == 45.75
    assert result["market_summary"] == "**Piata** e aglomerata."
    assert result["suggested_focus"].startswith("Urmarim")
    assert result["findings"][0]["impact"] == "high"
    assert result["data_gaps"] == ["Fara date financiare"]

    competitors = result["competitors"]
    assert [c["name"] for c in competitors] == ["Vulcanizare A", "Vulcanizare B", "Service C"]
    assert [c["index"] for c in competitors] == [0, 1, 2]
    assert set(competitors[0]) == {
        "index", "name", "address", "distance_km", "place_id", "rating", "reviews_count",
        "website", "youtube_channel", "facebook", "phone", "cui", "cui_source", "types",
        "positioning", "strengths", "weaknesses", "threat", "relevance", "evidence",
    }
    # Site-ul concurentului 0: canal YouTube, pagina Facebook (nu sharer.php) si CUI confirmat.
    assert competitors[0]["youtube_channel"] == (
        "https://www.youtube.com/channel/UC12345678901234567890ab"
    )
    assert competitors[0]["facebook"] == "https://www.facebook.com/vulcanizarea"
    assert (competitors[0]["cui"], competitors[0]["cui_source"]) == (12345678, "anaf")
    assert (competitors[0]["threat"], competitors[0]["relevance"]) == ("high", 90)
    # Valori AI invalide sau lipsa cad pe implicite.
    assert (competitors[1]["threat"], competitors[1]["relevance"]) == ("medium", 100)
    assert (competitors[2]["threat"], competitors[2]["relevance"]) == ("medium", 0)
    # ANAF nu confirma numele -> CUI-ul rămâne „de pe site".
    assert (competitors[2]["cui"], competitors[2]["cui_source"]) == (87654321, "site")
    assert competitors[1]["cui"] is None

    # Site-ul lui B nu răspunde: doar o linie de log, nu o eroare fatala.
    assert any("Vulcanizare B" in line for line in discovery.progress["log"])
    assert discovery.progress["done"] == discovery.progress["total"]
    assert (discovery.tokens_in, discovery.tokens_out) == (120, 60)
    assert float(discovery.cost_usd) > 0

    usage = (await db.execute(select(AiUsage).where(AiUsage.account_id == account.id))).scalars().all()
    assert [u.feature for u in usage] == ["radar.discovery"]
    assert usage[0].meta["discovery_id"] == discovery.id
    assert ai.calls and ai.calls[0].startswith("ANALIZA")


async def test_run_without_places_key_ends_in_error():
    db = await _db()
    _account, _company_row, discovery = await _run_fixture(db)
    with Patch(db, ai=FakeAI(), ai_settings=FakeAISettings(places_key=None)):
        await run_discovery(discovery.id)
    await db.refresh(discovery)
    assert discovery.status == "error"
    assert "Google Places" in discovery.error
    assert discovery.finished_at is not None


async def test_run_without_results_ends_in_error():
    db = await _db()
    _account, _company_row, discovery = await _run_fixture(db)
    with Patch(db, ai=FakeAI(), geocode=(45.75, 21.22), search={}):
        await run_discovery(discovery.id)
    await db.refresh(discovery)
    assert discovery.status == "error" and "concurenți" in discovery.error


# ─── API ──────────────────────────────────────────────────────────────────────

async def _api_fixture(*, ai_key="sk-test", places_key="gp-test"):
    set_fernet_key(Fernet.generate_key().decode())
    db = await _db()
    account = await make_account(db, "descoperire", "desc")
    await make_item(db, account, "Vulcanizare", "50.00")
    company = await _company(db, account)
    db.add(GlobalSettings(
        anthropic_api_key_enc=encrypt(ai_key) if ai_key else None,
        google_places_api_key_enc=encrypt(places_key) if places_key else None,
        ai_model="claude-test",
        ai_price_in_usd_mtok=Decimal("3.0000"),
        ai_price_out_usd_mtok=Decimal("15.0000"),
    ))
    await db.commit()
    return db, account, company


async def test_prepare_without_ai_key_uses_default_questions():
    db, account, company = await _api_fixture(ai_key=None)
    with Patch(db, ai_settings=FakeAISettings(api_key=None)):
        out = await radar_discovery.prepare_discovery(
            PrepareIn(company_id=company.id), account_id=account.id, db=db
        )
    assert out.ai_used is False
    assert [q.id for q in out.questions] == [
        "location", "radius_km", "services", "keywords", "known_competitors", "exclusions"
    ]
    by_id = {q.id: q for q in out.questions}
    assert by_id["location"].question == "In ce zona?"
    assert by_id["location"].suggested == "Timisoara"
    assert by_id["radius_km"].type == "number" and by_id["radius_km"].suggested == 15
    assert by_id["services"].suggested == "Vulcanizare"
    assert by_id["keywords"].question and by_id["keywords"].hint
    assert out.profile_draft["city"] == "Timisoara"

    other = await make_account(db, "alta", "alta")
    await raises_http(404, radar_discovery.prepare_discovery(
        PrepareIn(company_id=company.id), account_id=other.id, db=db
    ))


async def test_prepare_with_ai_fills_suggestions_and_records_usage():
    db, account, company = await _api_fixture()
    ai = FakeAI()
    with Patch(db, ai=ai):
        out = await radar_discovery.prepare_discovery(
            PrepareIn(company_id=company.id), account_id=account.id, db=db
        )
    assert out.ai_used is True
    by_id = {q.id: q for q in out.questions}
    assert by_id["keywords"].suggested == "vulcanizare, jante"
    assert out.profile_draft["activity"] == "Vulcanizare in Timisoara."
    usage = (await db.execute(select(func.count()).select_from(AiUsage))).scalar_one()
    assert usage == 1


async def test_create_requires_places_key_and_rejects_parallel_runs():
    db, account, company = await _api_fixture(places_key=None)
    detail = await raises_http(400, radar_discovery.create_discovery(
        DiscoveryCreate(company_id=company.id, answers={}), account_id=account.id, db=db
    ))
    assert "Google Places" in detail

    db2, account2, company2 = await _api_fixture()
    db2.add(RadarDiscovery(account_id=account2.id, company_id=company2.id, status="running"))
    await db2.commit()
    await raises_http(409, radar_discovery.create_discovery(
        DiscoveryCreate(company_id=company2.id, answers={}), account_id=account2.id, db=db2
    ))


async def test_import_creates_sources_and_skips_duplicates():
    db, account, company = await _api_fixture()
    competitors = [
        {"index": 0, "name": "Vulcanizare A", "place_id": "p1", "address": "Str. A 1",
         "rating": 4.7, "website": "https://a.ro", "site_title": "Vulcanizare A",
         "youtube_channel": "https://www.youtube.com/channel/UC12345678901234567890ab",
         "cui": 12345678},
        {"index": 1, "name": "Vulcanizare B", "place_id": "p2", "website": "",
         "youtube_channel": "", "cui": None},
    ]
    discovery = RadarDiscovery(
        account_id=account.id, company_id=company.id, status="done",
        result={"version": 1, "competitors": competitors,
                "suggested_focus": "Urmarim preturile."},
    )
    db.add(discovery)
    db.add(RadarSource(account_id=account.id, kind="website", value="https://a.ro", label="A"))
    await db.commit()

    out = await radar_discovery.import_discovery(
        discovery.id,
        ImportIn(items=[
            ImportItem(index=0, kinds=["gbusiness", "website", "youtube", "company"]),
            ImportItem(index=1, kinds=["gbusiness", "website"]),
            ImportItem(index=7, kinds=["gbusiness"]),
        ]),
        account_id=account.id, db=db,
    )
    assert (out.created, out.skipped) == (4, 3)

    rows = (await db.execute(
        select(RadarSource).where(RadarSource.account_id == account.id).order_by(RadarSource.id)
    )).scalars().all()
    by_kind = {r.kind: r for r in rows if r.label == "Vulcanizare A"}
    assert [r.value for r in rows if r.label == "Vulcanizare B"] == ["place:p2"]
    assert by_kind["gbusiness"].value == "place:p1"
    assert by_kind["gbusiness"].meta == {
        "place_id": "p1", "name": "Vulcanizare A", "address": "Str. A 1", "rating": 4.7,
    }
    assert by_kind["youtube"].meta["channel_id"] == "UC12345678901234567890ab"
    assert by_kind["company"].value == "12345678" and by_kind["company"].meta["cui"] == 12345678
    assert by_kind["gbusiness"].label == "Vulcanizare A"

    # A doua rulare nu mai creeaza nimic.
    again = await radar_discovery.import_discovery(
        discovery.id, ImportIn(items=[ImportItem(index=0, kinds=["gbusiness", "company"])]),
        account_id=account.id, db=db,
    )
    assert (again.created, again.skipped) == (0, 2)

    settings = await radar_discovery.use_suggested_focus(
        discovery.id, account_id=account.id, db=db
    )
    assert settings.focus_prompt == "Urmarim preturile."
    settings = await radar_discovery.use_suggested_focus(
        discovery.id, account_id=account.id, db=db
    )
    assert settings.focus_prompt == "Urmarim preturile.\n\nUrmarim preturile."

    other = await make_account(db, "alta", "alta")
    await raises_http(404, radar_discovery.get_discovery(
        discovery.id, account_id=other.id, db=db
    ))
    listed = await radar_discovery.list_discoveries(limit=20, account_id=account.id, db=db)
    assert [d.id for d in listed] == [discovery.id] and listed[0].result is None
    assert listed[0].company_name == company.name
    full = await radar_discovery.get_discovery(discovery.id, account_id=account.id, db=db)
    assert full.result["version"] == 1

    await radar_discovery.delete_discovery(discovery.id, account_id=account.id, db=db)
    assert await radar_discovery.list_discoveries(limit=20, account_id=account.id, db=db) == []


async def test_full_run_with_real_prompts():
    db = await _db()
    _account, _company_row, discovery = await _run_fixture(db)
    hits = [PlaceHit(place_id="p1", name="Vulcanizare A", address="Str. A 1", lat=45.75,
                     lng=21.22, rating=4.7, reviews_count=120, website="https://a.ro",
                     types=["tire_shop"])]
    ai = FakeAI("analysis")
    with Patch(db, ai=ai, geocode=(45.75, 21.22), search={"vulcanizare": hits},
               sites={"https://a.ro": SITE_A},
               anaf={12345678: CompanyInfo(cui=12345678, name="VULCANIZARE A SRL")},
               real_prompts=True):
        await run_discovery(discovery.id)
    await db.refresh(discovery)
    assert discovery.status == "done", f"status={discovery.status} err={discovery.error}"
    assert discovery.result["competitors"][0]["threat"] == "high"
    assert "Vulcanizare A" in ai.calls[0] and "12345678" in ai.calls[0]


async def test_prepare_with_real_prompts_returns_all_questions():
    db, account, company = await _api_fixture(ai_key=None)
    with Patch(db, ai_settings=FakeAISettings(api_key=None), real_prompts=True):
        out = await radar_discovery.prepare_discovery(
            PrepareIn(company_id=company.id), account_id=account.id, db=db
        )
    assert [q.id for q in out.questions] == list(QUESTION_IDS)
    assert all(q.question and q.hint for q in out.questions)
    assert out.ai_used is False


def main() -> None:
    run(test_profile_draft_parses_both_address_formats())
    test_merge_answers_normalises_lists_and_radius()
    test_scoring_drops_own_company_and_keeps_top_15()
    run(test_full_run_produces_result_and_usage())
    run(test_run_without_places_key_ends_in_error())
    run(test_run_without_results_ends_in_error())
    run(test_prepare_without_ai_key_uses_default_questions())
    run(test_prepare_with_ai_fills_suggestions_and_records_usage())
    run(test_create_requires_places_key_and_rejects_parallel_runs())
    run(test_import_creates_sources_and_skips_duplicates())
    run(test_full_run_with_real_prompts())
    run(test_prepare_with_real_prompts_returns_all_questions())
    print("OK test_radar_discovery")


if __name__ == "__main__":
    main()
