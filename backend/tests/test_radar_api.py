"""Radar AI: setari, surse (colectori fake), rulari, consum tokeni, chei de platforma.

Fara retea: colectorii si motorul sunt inlocuiti cu duble. Rulabil direct:
    python -m tests.test_radar_api
"""
from __future__ import annotations

import asyncio
import sys
import types
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from cryptography.fernet import Fernet

from app.efactura.crypto import encrypt, set_fernet_key
from app.models.global_settings import GlobalSettings
from app.models.radar import AiUsage, RadarRun, RadarSnapshot, RadarSource
from app.radar import types as rtypes
from app.routers import admin_ai, radar
from app.schemas.radar import (
    AiSettingsUpdate,
    RadarSettingsUpdate,
    RadarSourceCreate,
    RadarSourceUpdate,
)
from tests._harness import make_account, make_session, raises_http, run


def _fernet_on() -> None:
    set_fernet_key(Fernet.generate_key().decode())


async def _fixture(*, ai_key: str | None = "sk-test", places_key: str | None = None):
    _fernet_on()
    db = await make_session()
    acc = await make_account(db)
    gs = GlobalSettings(
        anthropic_api_key_enc=encrypt(ai_key) if ai_key else None,
        google_places_api_key_enc=encrypt(places_key) if places_key else None,
        ai_model="claude-test",
        ai_price_in_usd_mtok=Decimal("3.0000"),
        ai_price_out_usd_mtok=Decimal("15.0000"),
    )
    db.add(gs)
    await db.commit()
    return db, acc, gs


# ─── Colectori fake ───────────────────────────────────────────────────────────


class _FakeYoutube:
    async def resolve_channel(self, value):
        if "nope" in value:
            raise rtypes.CollectorError("Canalul nu a fost gasit.")
        return rtypes.ChannelInfo(channel_id="UC123", title="Canal Test", url=value)


class _FakeAnaf:
    async def fetch_company(self, cui):
        return rtypes.CompanyInfo(cui=cui, name="Concurent SRL", vat_payer=True, status="activ")


class _FakeWebsite:
    async def fetch_page(self, url):
        return rtypes.PageInfo(url=url, title="Pagina Test", text="x")


class _FakePlaces:
    def __init__(self):
        self.seen_key = None

    async def resolve_place(self, query, api_key):
        self.seen_key = api_key
        return rtypes.PlaceInfo(place_id="pl_1", name="Service Auto", rating=4.5, reviews_count=12)


def _patch_collectors(**modules):
    saved = {k: getattr(radar, k) for k in modules}
    for k, v in modules.items():
        setattr(radar, k, v)
    return saved


def _restore(saved: dict) -> None:
    for k, v in saved.items():
        setattr(radar, k, v)


# ─── Setari ───────────────────────────────────────────────────────────────────


async def test_settings_defaults_then_update():
    db, acc, _gs = await _fixture()
    out = await radar.get_radar_settings(account_id=acc.id, db=db)
    assert (out.focus_prompt, out.business_context, out.schedule) == ("", "", "off")
    assert out.ai_configured is True and out.places_configured is False
    assert out.model == "claude-test"

    out = await radar.update_radar_settings(
        RadarSettingsUpdate(focus_prompt="preturi concurenta", schedule="weekly"),
        account_id=acc.id, db=db,
    )
    assert (out.focus_prompt, out.schedule) == ("preturi concurenta", "weekly")
    # Campurile netrimise raman neatinse.
    out = await radar.update_radar_settings(
        RadarSettingsUpdate(business_context="vulcanizare"), account_id=acc.id, db=db
    )
    assert (out.focus_prompt, out.business_context) == ("preturi concurenta", "vulcanizare")


async def test_settings_without_key_reports_not_configured():
    db, acc, _gs = await _fixture(ai_key=None)
    out = await radar.get_radar_settings(account_id=acc.id, db=db)
    assert out.ai_configured is False


# ─── Surse ────────────────────────────────────────────────────────────────────


async def test_sources_crud_resolves_via_collectors():
    db, acc, _gs = await _fixture(places_key="gp-test")
    places = _FakePlaces()
    saved = _patch_collectors(
        youtube=_FakeYoutube(), anaf=_FakeAnaf(), website=_FakeWebsite(), gplaces=places
    )
    try:
        yt = await radar.create_source(
            RadarSourceCreate(kind="youtube", value="https://youtube.com/@test"),
            account_id=acc.id, db=db,
        )
        assert yt.label == "Canal Test" and yt.meta["channel_id"] == "UC123"

        comp = await radar.create_source(
            RadarSourceCreate(kind="company", value="RO 12345678"), account_id=acc.id, db=db
        )
        assert comp.meta == {
            "cui": 12345678, "name": "Concurent SRL", "vat_payer": True,
            "address": "", "status": "activ", "caen": "",
        }

        web = await radar.create_source(
            RadarSourceCreate(kind="website", value="https://x.ro", label="Site X"),
            account_id=acc.id, db=db,
        )
        assert web.label == "Site X" and web.meta["title"] == "Pagina Test"

        biz = await radar.create_source(
            RadarSourceCreate(kind="gbusiness", value="Service Auto Timisoara"),
            account_id=acc.id, db=db,
        )
        assert biz.meta["place_id"] == "pl_1" and places.seen_key == "gp-test"

        rows = await radar.list_sources(account_id=acc.id, db=db)
        assert [r.kind for r in rows] == ["youtube", "company", "website", "gbusiness"]

        upd = await radar.update_source(
            yt.id, RadarSourceUpdate(label="Canalul lui X", enabled=False),
            account_id=acc.id, db=db,
        )
        assert upd.label == "Canalul lui X" and upd.enabled is False

        db.add(RadarSnapshot(
            account_id=acc.id, source_id=yt.id, kind="youtube", external_id="v1",
            collected_at=datetime.now(timezone.utc), payload={"a": 1}, digest={"b": 2},
        ))
        await db.commit()
        snaps = await radar.list_snapshots(yt.id, limit=20, account_id=acc.id, db=db)
        assert [s.external_id for s in snaps] == ["v1"]
        rows = await radar.list_sources(account_id=acc.id, db=db)
        assert {r.id: r.snapshots_count for r in rows}[yt.id] == 1

        await radar.delete_source(yt.id, account_id=acc.id, db=db)
        assert len(await radar.list_sources(account_id=acc.id, db=db)) == 3
        await raises_http(404, radar.delete_source(yt.id, account_id=acc.id, db=db))
    finally:
        _restore(saved)


async def test_source_resolution_errors_are_400():
    db, acc, _gs = await _fixture()
    saved = _patch_collectors(youtube=_FakeYoutube(), gplaces=_FakePlaces())
    try:
        detail = await raises_http(400, radar.create_source(
            RadarSourceCreate(kind="youtube", value="https://youtube.com/@nope"),
            account_id=acc.id, db=db,
        ))
        assert detail == "Canalul nu a fost gasit."
        # Fara cheie Google Places, sursele de tip gbusiness nu se pot rezolva.
        await raises_http(400, radar.create_source(
            RadarSourceCreate(kind="gbusiness", value="ceva"), account_id=acc.id, db=db
        ))
    finally:
        _restore(saved)


async def test_sources_are_isolated_per_account():
    db, acc, _gs = await _fixture()
    other = await make_account(db, username="alta", code="alta")
    saved = _patch_collectors(website=_FakeWebsite())
    try:
        src = await radar.create_source(
            RadarSourceCreate(kind="website", value="https://x.ro"), account_id=acc.id, db=db
        )
        assert await radar.list_sources(account_id=other.id, db=db) == []
        await raises_http(404, radar.update_source(
            src.id, RadarSourceUpdate(label="hop"), account_id=other.id, db=db
        ))
        await raises_http(404, radar.list_snapshots(
            src.id, limit=5, account_id=other.id, db=db
        ))
    finally:
        _restore(saved)


# ─── Rulari ───────────────────────────────────────────────────────────────────


def _install_fake_engine() -> list[int]:
    """Inlocuieste app.radar.engine cu un dublu; intoarce lista id-urilor pornite."""
    started: list[int] = []

    async def run_radar(run_id: int) -> None:
        started.append(run_id)

    async def build_business_context(db, account_id: int) -> str:
        return f"Context generat pentru {account_id}."

    module = types.ModuleType("app.radar.engine")
    module.run_radar = run_radar
    module.build_business_context = build_business_context
    sys.modules["app.radar.engine"] = module
    return started


async def test_run_needs_key_and_sources_then_rejects_duplicates():
    db, acc, gs = await _fixture(ai_key=None)
    await raises_http(400, radar.create_run(account_id=acc.id, db=db))

    gs.anthropic_api_key_enc = encrypt("sk-test")
    await db.commit()
    detail = await raises_http(400, radar.create_run(account_id=acc.id, db=db))
    assert "sursa" in detail

    db.add(RadarSource(account_id=acc.id, kind="website", value="https://x.ro", label="X"))
    await db.commit()

    started = _install_fake_engine()
    try:
        run_out = await radar.create_run(account_id=acc.id, db=db)
        assert run_out.status == "queued" and run_out.trigger == "manual"
        await asyncio.sleep(0)
        assert started == [run_out.id]

        await raises_http(409, radar.create_run(account_id=acc.id, db=db))

        listed = await radar.list_runs(limit=20, account_id=acc.id, db=db)
        assert [r.id for r in listed] == [run_out.id] and listed[0].report is None
        await raises_http(409, radar.delete_run(run_out.id, account_id=acc.id, db=db))

        stored = await db.get(RadarRun, run_out.id)
        stored.status = "done"
        stored.report = {"version": 1, "title": "Raport"}
        await db.commit()
        full = await radar.get_run(run_out.id, account_id=acc.id, db=db)
        assert full.report["title"] == "Raport"

        other = await make_account(db, username="alta", code="alta")
        await raises_http(404, radar.get_run(run_out.id, account_id=other.id, db=db))

        await radar.delete_run(run_out.id, account_id=acc.id, db=db)
        assert await radar.list_runs(limit=20, account_id=acc.id, db=db) == []
    finally:
        sys.modules.pop("app.radar.engine", None)


async def test_suggest_context_saves_generated_text():
    db, acc, _gs = await _fixture()
    _install_fake_engine()
    try:
        out = await radar.suggest_business_context(account_id=acc.id, db=db)
        assert out.business_context == f"Context generat pentru {acc.id}."
        settings = await radar.get_radar_settings(account_id=acc.id, db=db)
        assert settings.business_context == out.business_context
    finally:
        sys.modules.pop("app.radar.engine", None)


# ─── Consum ───────────────────────────────────────────────────────────────────


async def test_usage_aggregates_by_month_and_feature():
    db, acc, _gs = await _fixture()
    other = await make_account(db, username="alta", code="alta")
    now = datetime.now(timezone.utc).replace(day=15, hour=12, minute=0, second=0, microsecond=0)
    prev = (now.replace(day=1) - timedelta(days=1)).replace(day=10)
    for account_id, when, feature, tin, tout, cost in (
        (acc.id, now, rtypes.FEATURE_DIGEST, 1000, 200, "0.005000"),
        (acc.id, now, rtypes.FEATURE_SYNTHESIS, 2000, 500, "0.013500"),
        (acc.id, prev, rtypes.FEATURE_DIGEST, 500, 100, "0.003000"),
        (other.id, now, rtypes.FEATURE_DIGEST, 9999, 9999, "9.000000"),
    ):
        db.add(AiUsage(
            account_id=account_id, created_at=when, feature=feature, model="claude-test",
            tokens_in=tin, tokens_out=tout, cost_usd=Decimal(cost),
        ))
    await db.commit()

    out = await radar.get_usage(months=6, account_id=acc.id, db=db)
    assert (out.total_in, out.total_out) == (3500, 800)
    assert round(out.total_cost_usd, 6) == 0.0215
    assert len(out.by_month) == 6
    assert out.by_month[-1].month == f"{now.year:04d}-{now.month:02d}"
    assert (out.by_month[-1].tokens_in, out.by_month[-2].tokens_in) == (3000, 500)
    assert {f.feature: f.tokens_in for f in out.by_feature} == {
        rtypes.FEATURE_DIGEST: 1500, rtypes.FEATURE_SYNTHESIS: 2000
    }


def test_usage_window_start_walks_back_over_year_boundary():
    from datetime import date
    assert radar.window_start(6, date(2026, 3, 15)) == date(2025, 10, 1)
    assert radar.window_start(1, date(2026, 1, 31)) == date(2026, 1, 1)


# ─── Admin: chei si consum pe conturi ─────────────────────────────────────────


async def test_admin_ai_settings_write_only_keys():
    db, acc, _gs = await _fixture(ai_key=None)
    out = await admin_ai.get_ai_settings(_admin=acc, db=db)
    assert out.anthropic_api_key_set is False and out.google_places_api_key_set is False

    out = await admin_ai.update_ai_settings(
        AiSettingsUpdate(
            anthropic_api_key="sk-secret", google_places_api_key="gp-secret",
            ai_model="claude-x", ai_price_in_usd_mtok=4.5, ai_price_out_usd_mtok=20.0,
        ),
        _admin=acc, db=db,
    )
    assert out.anthropic_api_key_set is True and out.google_places_api_key_set is True
    assert (out.ai_model, out.ai_price_in_usd_mtok, out.ai_price_out_usd_mtok) == ("claude-x", 4.5, 20.0)
    assert "sk-secret" not in out.model_dump_json()

    ai = await radar.load_ai_settings(db)
    assert (ai.api_key, ai.places_key, ai.model) == ("sk-secret", "gp-secret", "claude-x")

    # Sir gol = stergere explicita; campul lipsa = nemodificat.
    out = await admin_ai.update_ai_settings(AiSettingsUpdate(anthropic_api_key=""), _admin=acc, db=db)
    assert out.anthropic_api_key_set is False and out.google_places_api_key_set is True
    assert out.ai_model == "claude-x"


async def test_admin_ai_usage_per_account():
    db, acc, _gs = await _fixture()
    other = await make_account(db, username="alta", code="alta")
    now = datetime.now(timezone.utc)
    db.add_all([
        AiUsage(account_id=acc.id, created_at=now, feature=rtypes.FEATURE_DIGEST,
                model="m", tokens_in=100, tokens_out=10, cost_usd=Decimal("0.100000")),
        AiUsage(account_id=other.id, created_at=now, feature=rtypes.FEATURE_SYNTHESIS,
                model="m", tokens_in=300, tokens_out=30, cost_usd=Decimal("0.500000")),
        RadarRun(account_id=other.id, status="done", trigger="scheduled", started_at=now),
    ])
    await db.commit()

    rows = await admin_ai.get_ai_usage(months=6, _admin=acc, db=db)
    by_id = {r.account_id: r for r in rows}
    assert rows[0].account_id == other.id
    assert (by_id[other.id].cost_usd, by_id[other.id].runs) == (0.5, 1)
    assert (by_id[acc.id].tokens_in, by_id[acc.id].runs) == (100, 0)
    assert by_id[acc.id].account_name == acc.name


def main() -> None:
    run(test_settings_defaults_then_update())
    run(test_settings_without_key_reports_not_configured())
    run(test_sources_crud_resolves_via_collectors())
    run(test_source_resolution_errors_are_400())
    run(test_sources_are_isolated_per_account())
    run(test_run_needs_key_and_sources_then_rejects_duplicates())
    run(test_suggest_context_saves_generated_text())
    run(test_usage_aggregates_by_month_and_feature())
    test_usage_window_start_walks_back_over_year_boundary()
    run(test_admin_ai_settings_write_only_keys())
    run(test_admin_ai_usage_per_account())
    print("OK test_radar_api")


if __name__ == "__main__":
    main()
