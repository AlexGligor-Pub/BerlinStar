"""Scheme AdminV2 pentru cheile AI si consumul pe cont."""
from __future__ import annotations

from pydantic import BaseModel, Field


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
