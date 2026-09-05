"""Teste Radar AI: rulare completa, deduplicare, erori per sursa, parsare JSON, PDF."""
from __future__ import annotations

import json
import sys
import types
from datetime import date

from sqlalchemy import func, select

from app.models.base import Base
from app.models.radar import AiUsage, RadarRun, RadarSettings, RadarSnapshot, RadarSource
from app.radar import engine as engine_mod
from app.radar.ai import AIClient, AIError, parse_json
from app.radar.engine import Candidate, build_business_context, run_radar
from app.radar.types import AIResult, CollectorError

from tests._harness import make_account, make_item, make_session, raises_http  # noqa: F401

RADAR_TABLE_NAMES = (
    "radar_sources", "radar_settings", "radar_runs", "radar_snapshots", "ai_usage",
)


# ─── Infrastructura de test ───────────────────────────────────────────────────

async def _db():
    """Sesiune de harness + tabelele Radar (nu sunt in subsetul implicit)."""
    db = await make_session()
    tables = [Base.metadata.tables[name] for name in RADAR_TABLE_NAMES]
    conn = await db.connection()
    await conn.run_sync(lambda c: Base.metadata.create_all(c, tables=tables, checkfirst=True))
    await db.commit()
    return db


class _SessionFactory:
    """Inlocuieste `AsyncSessionLocal` in engine cu sesiunea de test."""

    def __init__(self, db):
        self.db = db

    def __call__(self):
        return self

    async def __aenter__(self):
        return self.db

    async def __aexit__(self, *exc):
        return False


class FakeAISettings:
    def __init__(self, api_key="k-test", places_key="p-test"):
        self.api_key = api_key
        self.places_key = places_key
        self.model = "fake-model"
        self.price_in = 3.0
        self.price_out = 15.0


DIGESTS = {
    "youtube": {
        "video_title": "Montaj lift nou",
        "url": "https://youtu.be/v1",
        "published_at": "2026-09-01",
        "summary": "Prezinta un lift auto nou.",
        "selling": True,
        "selling_what": "lift auto",
        "call_to_action": "Sună acum",
        "sentiment": "positive",
        "relevance": 80,
    },
    "website": {
        "url": "https://concurent.ro",
        "title": "Concurent",
        "novelties": [{"title": "Aparat nou", "description": "Geometrie 3D",
                       "image_url": "", "link": "", "category": "echipament"}],
        "commentary": "Investesc in echipamente.",
    },
    "company": {
        "cui": 123, "name": "Concurent SRL", "vat_payer": True, "status": "activa",
        "financials": [{"year": 2024, "turnover": 1000.0, "profit": 100.0, "employees": 5}],
        "trend": "up", "commentary": "Crestere.",
    },
    "gbusiness": {
        "name": "Service X", "rating": 4.5, "reviews_count": 30,
        "themes": [{"theme": "promptitudine", "sentiment": "positive", "count": 3,
                    "example": "Rapid"}],
        "praise": ["rapid"], "complaints": [], "commentary": "Bine cotat.",
    },
}

REPORT_JSON = {
    "title": "Radar săptămânal",
    "executive_summary": "**Concurența** investește.\n- lift nou\n- geometrie 3D",
    "key_signals": [{"title": "Echipament nou", "insight": "Lift auto", "impact": "high",
                     "sentiment": "negative", "source_refs": []}],
    "recommendations": [{"title": "Evaluează lift", "rationale": "Cerere", "action": "Ofertare",
                         "priority": 2, "horizon": "30_zile", "confidence": "medium",
                         "source_refs": []},
                        {"title": "Promo geometrie", "rationale": "Diferențiere",
                         "action": "Campanie", "priority": 1, "horizon": "acum",
                         "confidence": "high", "source_refs": []}],
    "decision_frame": {"question": "Investim?", "options": [
        {"option": "Da", "pros": ["capacitate"], "cons": ["cost"], "evidence": []}],
        "recommended": "Da", "risks": ["cash-flow"]},
    "history_delta": "Primul raport.",
    "data_gaps": ["Google dă maxim 5 recenzii."],
}


class FakeAI(AIClient):
    """Client AI determinist: raspunsuri conservate per feature, fara retea."""

    def __init__(self, fail_marker: str | None = None):
        super().__init__(api_key="test", model="fake-model", price_in=3.0, price_out=15.0)
        self.calls: list[str] = []
        self.fail_marker = fail_marker

    async def complete(self, system, user, max_tokens=4096):
        self.calls.append(user)
        if self.fail_marker and self.fail_marker in user:
            raise AIError("Sinteza a eșuat.")
        if user.startswith("DIGEST:"):
            kind = user.split(":", 1)[1]
            body = dict(DIGESTS[kind])
            body.pop("achievements", None)
            text = "```json\n" + json.dumps(body, ensure_ascii=False) + "\n```"
        elif user.startswith("SYNTH"):
            text = "Iată raportul:\n```json\n" + json.dumps(REPORT_JSON, ensure_ascii=False) + "\n```"
        else:
            text = "Firmă de service auto din Timișoara."
        return AIResult(text=text, tokens_in=100, tokens_out=50,
                        cost_usd=self.cost(100, 50), model=self.model)


def _fake_prompts() -> types.ModuleType:
    module = types.ModuleType("app.radar.prompts")
    module.system_prompt = lambda ctx: "SYS"
    module.context_prompt = lambda companies, items: "CONTEXT"
    module.digest_prompt = lambda kind, ctx, payload, focus: f"DIGEST:{kind}"
    module.synthesis_prompt = lambda ctx, focus, digests, previous, period: "SYNTH"
    module.DIGEST_SCHEMAS = {
        "youtube": {"properties": {"video_title": {"type": "string"},
                                   "summary": {"type": "string"},
                                   "achievements": {"type": "array"},
                                   "relevance": {"type": "integer"}}},
        "website": {"properties": {"url": {"type": "string"},
                                   "novelties": {"type": "array"},
                                   "commentary": {"type": "string"}}},
        "company": {"properties": {"financials": {"type": "array"}}},
        "gbusiness": {"properties": {"themes": {"type": "array"}}},
    }
    module.REPORT_SCHEMA = {}
    return module


class Patch:
    """Inlocuieste temporar prompts + colectorii + sesiunea din engine."""

    def __init__(self, db, ai, collectors: dict, ai_settings=None, real_prompts=False):
        self.real_prompts = real_prompts
        self.db = db
        self.ai = ai
        self.collectors = collectors
        self.ai_settings = ai_settings or FakeAISettings()
        self.saved: dict = {}
        self.saved_module = None
        self.saved_attr = None
        self.package = None

    def __enter__(self):
        # Why: `from . import prompts` citeste atributul pachetului, nu sys.modules,
        # deci trebuie inlocuite amandoua ca fake-ul sa fie vazut de engine.
        import app.radar as radar_pkg

        self.package = radar_pkg
        self.saved_module = sys.modules.get("app.radar.prompts")
        self.saved_attr = getattr(radar_pkg, "prompts", None)
        if not self.real_prompts:
            fake = _fake_prompts()
            sys.modules["app.radar.prompts"] = fake
            radar_pkg.prompts = fake
        for name in ("AsyncSessionLocal", "_make_ai", "_load_ai_settings", "_enrich_youtube",
                     "_collect_youtube", "_collect_company", "_collect_website",
                     "_collect_gbusiness"):
            self.saved[name] = getattr(engine_mod, name)
        engine_mod.AsyncSessionLocal = _SessionFactory(self.db)
        engine_mod._make_ai = lambda settings: self.ai

        async def _settings(db):
            return self.ai_settings

        engine_mod._load_ai_settings = _settings

        async def _enrich(candidate):
            candidate.payload["transcript"] = "transcript fake"

        engine_mod._enrich_youtube = _enrich
        for kind, fn in self.collectors.items():
            setattr(engine_mod, f"_collect_{kind}", fn)
        return self

    def __exit__(self, *exc):
        for name, value in self.saved.items():
            setattr(engine_mod, name, value)
        if self.real_prompts:
            return False
        if self.saved_module is None:
            sys.modules.pop("app.radar.prompts", None)
        else:
            sys.modules["app.radar.prompts"] = self.saved_module
        if self.saved_attr is None:
            if hasattr(self.package, "prompts"):
                delattr(self.package, "prompts")
        else:
            self.package.prompts = self.saved_attr
        return False


def _yt_collector(videos=("v1",)):
    async def _collect(source, ctx):
        return [Candidate(external_id=v, payload={"video_id": v, "title": f"Video {v}",
                                                  "url": f"https://youtu.be/{v}"})
                for v in videos]
    return _collect


def _web_collector(content_hash="h1"):
    async def _collect(source, ctx):
        return [Candidate(
            external_id=f"page:abc123456789:{date.today().isoformat()}",
            payload={"url": source.value, "title": "Concurent", "text": "text",
                     "content_hash": content_hash, "images": [], "links": []},
            dedup_key=content_hash,
            prefix="page:abc123456789:",
        )]
    return _collect


def _failing_collector(message="Canalul nu răspunde."):
    async def _collect(source, ctx):
        raise CollectorError(message)
    return _collect


async def _fixture(db, kinds=("youtube", "website")):
    account = await make_account(db, "radarfirma", "radar")
    await make_item(db, account, "Schimb ulei", "150.00")
    account_id = account.id
    db.add(RadarSettings(account_id=account_id, focus_prompt="Focus concurenți",
                         business_context="Service auto", schedule="weekly"))
    for kind in kinds:
        db.add(RadarSource(account_id=account_id, kind=kind, label=f"Sursa {kind}",
                           value=f"https://exemplu.ro/{kind}",
                           meta={"channel_id": "UC1", "place_id": "P1", "cui": "123"},
                           enabled=True))
    run = RadarRun(account_id=account_id, status="queued", trigger="manual")
    db.add(run)
    await db.commit()
    return account_id, run


async def _count(db, model, **filters):
    query = select(func.count()).select_from(model)
    for key, value in filters.items():
        query = query.where(getattr(model, key) == value)
    return (await db.execute(query)).scalar_one()


# ─── Teste ────────────────────────────────────────────────────────────────────

async def test_full_run_produces_report():
    db = await _db()
    account_id, run = await _fixture(db)
    ai = FakeAI()
    with Patch(db, ai, {"youtube": _yt_collector(), "website": _web_collector()}):
        await run_radar(run.id)

    await db.refresh(run)
    assert run.status == "done", f"status={run.status} err={run.error}"
    assert run.error is None
    assert run.report and run.report["version"] == 1
    assert run.title == "Radar săptămânal"
    assert run.period_from is not None and run.period_to is not None
    assert run.tokens_in == 300 and run.tokens_out == 150
    assert float(run.cost_usd) > 0
    assert run.progress["done"] == run.progress["total"]

    sections = run.report["sections"]
    assert len(sections["youtube"]) == 1 and len(sections["websites"]) == 1
    assert sections["youtube"][0]["snapshot_id"] > 0
    assert sections["youtube"][0]["source_label"] == "Sursa youtube"
    assert sections["youtube"][0]["achievements"] == []
    assert set(sections) == {"youtube", "companies", "websites", "reviews"}
    assert run.report["decision_frame"]["recommended"] == "Da"
    assert run.report["period"]["to"] == date.today().isoformat()

    assert await _count(db, RadarSnapshot, account_id=account_id) == 2
    assert await _count(db, AiUsage, feature="radar.digest") == 2
    assert await _count(db, AiUsage, feature="radar.synthesis") == 1
    snapshot = (await db.execute(
        select(RadarSnapshot).where(RadarSnapshot.kind == "youtube")
    )).scalars().one()
    assert snapshot.payload["transcript"] == "transcript fake"
    assert snapshot.digest["video_title"] == "Montaj lift nou"


async def test_second_run_deduplicates():
    db = await _db()
    account_id, run = await _fixture(db)
    collectors = {"youtube": _yt_collector(), "website": _web_collector()}
    ai = FakeAI()
    with Patch(db, ai, collectors):
        await run_radar(run.id)
        run2 = RadarRun(account_id=account_id, status="queued", trigger="manual")
        db.add(run2)
        await db.commit()
        await run_radar(run2.id)

    await db.refresh(run2)
    assert run2.status == "done", run2.error
    assert await _count(db, RadarSnapshot, account_id=account_id) == 2
    assert await _count(db, AiUsage, feature="radar.digest") == 2
    assert await _count(db, AiUsage, feature="radar.synthesis") == 2
    assert run2.tokens_in == 100


async def test_website_same_hash_new_day_is_skipped():
    db = await _db()
    account_id, run = await _fixture(db, kinds=("website",))
    ai = FakeAI()
    with Patch(db, ai, {"website": _web_collector()}):
        await run_radar(run.id)

        async def _tomorrow(source, ctx):
            return [Candidate(external_id="page:abc123456789:2999-01-01",
                              payload={"url": source.value, "content_hash": "h1", "text": "text"},
                              dedup_key="h1", prefix="page:abc123456789:")]

        engine_mod._collect_website = _tomorrow
        run2 = RadarRun(account_id=account_id, status="queued", trigger="manual")
        db.add(run2)
        await db.commit()
        await run_radar(run2.id)

    assert await _count(db, RadarSnapshot, account_id=account_id) == 1
    assert await _count(db, AiUsage, feature="radar.digest") == 1


async def test_source_error_does_not_fail_run():
    db = await _db()
    account_id, run = await _fixture(db)
    ai = FakeAI()
    with Patch(db, ai, {"youtube": _failing_collector(), "website": _web_collector()}):
        await run_radar(run.id)

    await db.refresh(run)
    assert run.status == "done", run.error
    sources = (await db.execute(
        select(RadarSource).where(RadarSource.account_id == account_id)
        .order_by(RadarSource.id)
    )).scalars().all()
    broken = next(s for s in sources if s.kind == "youtube")
    healthy = next(s for s in sources if s.kind == "website")
    assert broken.last_error == "Canalul nu răspunde."
    assert broken.last_collected_at is None
    assert healthy.last_error is None and healthy.last_collected_at is not None
    assert any("Canalul nu răspunde." in line for line in run.progress["log"])
    assert await _count(db, RadarSnapshot, account_id=account_id) == 1


async def test_digest_failure_after_flush_isolates_source():
    db = await _db()
    account_id, run = await _fixture(db)
    ai = FakeAI(fail_marker="DIGEST:youtube")
    with Patch(db, ai, {"youtube": _yt_collector(), "website": _web_collector()}):
        await run_radar(run.id)

    await db.refresh(run)
    assert run.status == "done", run.error
    sources = (await db.execute(
        select(RadarSource).where(RadarSource.account_id == account_id)
    )).scalars().all()
    broken = next(s for s in sources if s.kind == "youtube")
    assert broken.last_error == "Sinteza a eșuat."
    assert "greenlet" not in (run.error or "")
    assert await _count(db, RadarSnapshot, account_id=account_id) == 1


async def test_synthesis_failure_marks_run_error():
    db = await _db()
    account_id, run = await _fixture(db)
    ai = FakeAI(fail_marker="SYNTH")
    with Patch(db, ai, {"youtube": _yt_collector(), "website": _web_collector()}):
        await run_radar(run.id)

    await db.refresh(run)
    assert run.status == "error"
    assert run.error == "Sinteza a eșuat."
    assert run.finished_at is not None
    assert run.report is None
    assert await _count(db, RadarSnapshot, account_id=account_id) == 2


async def test_missing_api_key_is_reported_in_romanian():
    db = await _db()
    account_id, run = await _fixture(db)
    ai = FakeAI()
    with Patch(db, ai, {"youtube": _yt_collector(), "website": _web_collector()},
               ai_settings=FakeAISettings(api_key="")):
        await run_radar(run.id)

    await db.refresh(run)
    assert run.status == "error"
    assert run.error == "Cheia Anthropic nu este configurată (AdminV2)."


async def test_build_business_context_records_usage():
    db = await _db()
    account = await make_account(db, "ctxfirma", "ctx")
    await make_item(db, account, "Vulcanizare", "80.00")
    await db.commit()
    ai = FakeAI()
    with Patch(db, ai, {}):
        text = await build_business_context(db, account.id, ai)

    assert text == "Firmă de service auto din Timișoara."
    usage = (await db.execute(
        select(AiUsage).where(AiUsage.feature == "radar.context")
    )).scalars().all()
    assert len(usage) == 1
    assert usage[0].tokens_in == 100 and usage[0].model == "fake-model"
    assert float(usage[0].cost_usd) > 0


def test_parse_json_edge_cases():
    assert parse_json('{"a": 1}') == {"a": 1}
    assert parse_json('```json\n{"a": 1}\n```') == {"a": 1}
    assert parse_json('```\n{"a": 1}\n```') == {"a": 1}
    assert parse_json('Iată rezultatul:\n{"a": {"b": [1, 2]}}\nSper că ajută.') == {
        "a": {"b": [1, 2]}
    }
    assert parse_json('{"t": "acolada } in text"} coada') == {"t": "acolada } in text"}
    for bad in ("", "   ", "fara json aici", "[1, 2]", "{nu e json}"):
        try:
            parse_json(bad)
        except ValueError:
            continue
        raise AssertionError(f"astept ValueError pentru {bad!r}")


def test_cost_and_token_accounting():
    client = AIClient(api_key="k", model="m", price_in=3.0, price_out=15.0)
    assert abs(client.cost(1_000_000, 1_000_000) - 18.0) < 1e-9

    class _Usage:
        input_tokens = 10
        cache_read_input_tokens = 5
        cache_creation_input_tokens = 2
        output_tokens = 7

    class _Msg:
        usage = _Usage()

    from app.radar.ai import _tokens_in

    assert _tokens_in(_Msg()) == 17
    try:
        AIClient(api_key="")
    except AIError as exc:
        assert "Anthropic" in str(exc)
    else:
        raise AssertionError("astept AIError fara cheie")


def test_scheduler_due_rules():
    from app.radar.scheduler import _is_due

    assert _is_due("weekly", date(2026, 9, 14))
    assert _is_due("monthly", date(2026, 9, 7))
    assert not _is_due("monthly", date(2026, 9, 14))
    assert not _is_due("off", date(2026, 9, 7))


def test_pdf_is_generated():
    from app.radar.pdf import build_report_pdf

    class _Run:
        tokens_in = 300
        tokens_out = 150
        report = dict(REPORT_JSON)

    _Run.report.update({
        "version": 1,
        "generated_at": "2026-09-05T10:00:00+00:00",
        "period": {"from": "2026-08-06", "to": "2026-09-05"},
        "sections": {
            "youtube": [dict(DIGESTS["youtube"], snapshot_id=1, source_label="Canal",
                             achievements=["premiu"])],
            "companies": [dict(DIGESTS["company"], snapshot_id=2, source_label="CUI 123")],
            "websites": [dict(DIGESTS["website"], snapshot_id=3, source_label="Site")],
            "reviews": [dict(DIGESTS["gbusiness"], snapshot_id=4, source_label="Google")],
        },
    })
    data = build_report_pdf(_Run(), "Service Măgureanu")
    assert data.startswith(b"%PDF"), "PDF invalid"
    assert len(data) > 3000


def test_real_modules_integration():
    """Verifica modulele scrise de celelalte agenti (prompts, settings, collectors)."""
    missing = []
    checks = {
        "app.radar.prompts": ("system_prompt", "context_prompt", "digest_prompt",
                              "synthesis_prompt", "DIGEST_SCHEMAS", "REPORT_SCHEMA"),
        "app.radar.settings": ("load_ai_settings",),
        "app.radar.collectors.youtube": ("resolve_channel", "fetch_recent_videos",
                                         "fetch_transcript"),
        "app.radar.collectors.anaf": ("fetch_company", "fetch_bilant"),
        "app.radar.collectors.website": ("fetch_page",),
        "app.radar.collectors.gplaces": ("resolve_place", "fetch_reviews"),
    }
    import importlib

    for name, attrs in checks.items():
        try:
            module = importlib.import_module(name)
        except ImportError:
            missing.append(name)
            continue
        for attr in attrs:
            assert hasattr(module, attr), f"{name}.{attr} lipseste"
    if missing:
        print(f"  (integrare partiala — module inca nescrise: {', '.join(missing)})")
    else:
        from app.radar import prompts

        assert set(prompts.DIGEST_SCHEMAS) >= {"youtube", "company", "website", "gbusiness"}


class RealPromptAI(FakeAI):
    """Ca FakeAI, dar recunoaste feature-ul din promptul real (nu din marcaje de test)."""

    async def complete(self, system, user, max_tokens=4096):
        from app.radar import prompts

        self.real_calls = getattr(self, "real_calls", [])
        self.real_calls.append(user)
        marker = "CONTEXT"
        if "raportul Radar pentru perioada" in user:
            marker = "SYNTH"
        else:
            for kind, schema in prompts.DIGEST_SCHEMAS.items():
                if schema.get("description") and schema["description"] in user:
                    marker = f"DIGEST:{kind}"
                    break
        return await FakeAI.complete(self, system, marker, max_tokens)


async def test_integration_with_real_prompts():
    """Rulare completa peste modulul real `prompts` (fara retea, AI simulat)."""
    try:
        from app.radar import prompts, settings as radar_settings  # noqa: F401
    except ImportError as exc:
        print(f"  (sarit — modulele reale lipsesc: {exc})")
        return

    db = await _db()
    account_id, run = await _fixture(db, kinds=("youtube", "website", "company", "gbusiness"))

    async def _company(source, ctx):
        return [Candidate(external_id="bilant:2024",
                          payload={"type": "bilant",
                                   "company": {"cui": 123, "name": "Concurent SRL", "raw": {}},
                                   "bilant": [{"year": 2024, "turnover": 1000.0, "raw": []}]})]

    async def _reviews(source, ctx):
        return [Candidate(
            external_id="place:P1:2026-01-01",
            payload={"place_id": "P1", "name": "Service X", "rating": 4.5,
                     "reviews_count": 30,
                     "reviews": [{"author": "Ion", "rating": 5, "text": "Rapid"}]},
            dedup_key="r1", prefix="place:P1:")]

    ai = RealPromptAI()
    collectors = {"youtube": _yt_collector(), "website": _web_collector(),
                  "company": _company, "gbusiness": _reviews}
    with Patch(db, ai, collectors, real_prompts=True):
        await run_radar(run.id)

    await db.refresh(run)
    assert run.status == "done", f"status={run.status} err={run.error}"
    assert await _count(db, RadarSnapshot, account_id=account_id) == 4
    assert await _count(db, AiUsage, feature="radar.digest") == 4
    assert all(len(call) > 200 for call in ai.real_calls), "prompturile reale par goale"
    sections = run.report["sections"]
    assert [len(sections[k]) for k in ("youtube", "companies", "websites", "reviews")] == [1, 1, 1, 1]
    youtube_props = set(prompts.DIGEST_SCHEMAS["youtube"]["properties"])
    assert youtube_props <= set(sections["youtube"][0]), "digest-ul nu acopera schema reala"

    fresh = await radar_settings.load_ai_settings(db)
    assert fresh.model and fresh.price_in > 0
