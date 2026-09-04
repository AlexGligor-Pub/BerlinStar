"""Schemele Pydantic pentru /api/radar/* si /api/admin/ai-* (vezi docs/radar_ai_design.md)."""
from __future__ import annotations

from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

RadarKind = Literal["youtube", "company", "website", "gbusiness"]
RadarSchedule = Literal["off", "weekly", "monthly"]


class RadarSettingsOut(BaseModel):
    focus_prompt: str
    business_context: str
    schedule: RadarSchedule
    ai_configured: bool
    places_configured: bool
    model: str


class RadarSettingsUpdate(BaseModel):
    focus_prompt: str | None = None
    business_context: str | None = None
    schedule: RadarSchedule | None = None


class SuggestContextOut(BaseModel):
    business_context: str


class RadarSourceCreate(BaseModel):
    kind: RadarKind
    value: str = Field(min_length=1, max_length=500)
    label: str | None = Field(None, max_length=200)


class RadarSourceUpdate(BaseModel):
    label: str | None = Field(None, max_length=200)
    enabled: bool | None = None


class RadarSourceOut(BaseModel):
    id: int
    kind: str
    label: str
    value: str
    meta: dict[str, Any] | None
    enabled: bool
    created_at: datetime
    last_collected_at: datetime | None
    last_error: str | None
    snapshots_count: int


class RadarSnapshotOut(BaseModel):
    id: int
    external_id: str
    collected_at: datetime
    payload: dict[str, Any] | None
    digest: dict[str, Any] | None


class RadarRunOut(BaseModel):
    id: int
    status: str
    trigger: str
    started_at: datetime
    finished_at: datetime | None
    error: str | None
    progress: dict[str, Any] | None
    tokens_in: int
    tokens_out: int
    cost_usd: float
    title: str | None
    period_from: date | None
    period_to: date | None
    report: dict[str, Any] | None = None


class UsageBucket(BaseModel):
    month: str
    tokens_in: int
    tokens_out: int
    cost_usd: float


class UsageFeatureBucket(BaseModel):
    feature: str
    tokens_in: int
    tokens_out: int
    cost_usd: float


class UsageOut(BaseModel):
    total_in: int
    total_out: int
    total_cost_usd: float
    by_month: list[UsageBucket]
    by_feature: list[UsageFeatureBucket]


class AiSettingsOut(BaseModel):
    anthropic_api_key_set: bool
    google_places_api_key_set: bool
    ai_model: str
    ai_price_in_usd_mtok: float
    ai_price_out_usd_mtok: float


class AiSettingsUpdate(BaseModel):
    anthropic_api_key: str | None = None
    google_places_api_key: str | None = None
    ai_model: str | None = Field(None, max_length=80)
    ai_price_in_usd_mtok: float | None = Field(None, ge=0)
    ai_price_out_usd_mtok: float | None = Field(None, ge=0)


class AccountUsageOut(BaseModel):
    account_id: int
    account_name: str
    tokens_in: int
    tokens_out: int
    cost_usd: float
    runs: int
