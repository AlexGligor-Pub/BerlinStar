"""Tipuri partajate intre collectors, prompts, engine. Contract stabil — vezi docs/radar_ai_design.md."""
from __future__ import annotations

from dataclasses import dataclass, field, asdict
from datetime import datetime

KINDS = ("youtube", "company", "website", "gbusiness")
FEATURE_CONTEXT = "radar.context"
FEATURE_DIGEST = "radar.digest"
FEATURE_SYNTHESIS = "radar.synthesis"
DEFAULT_MODEL = "claude-sonnet-5"
DEFAULT_PRICE_IN_USD_MTOK = 3.0
DEFAULT_PRICE_OUT_USD_MTOK = 15.0


class CollectorError(Exception):
    """Sursa nu a putut fi citita; mesajul e afisabil utilizatorului (romana)."""


@dataclass
class BusinessContext:
    account_name: str
    companies: list[dict] = field(default_factory=list)
    items: list[dict] = field(default_factory=list)
    business_context: str = ""

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class ChannelInfo:
    channel_id: str
    title: str
    url: str


@dataclass
class VideoItem:
    video_id: str
    title: str
    url: str
    published_at: datetime
    description: str = ""
    transcript: str | None = None

    def to_payload(self) -> dict:
        d = asdict(self)
        d["published_at"] = self.published_at.isoformat()
        return d


@dataclass
class CompanyInfo:
    cui: int
    name: str
    address: str = ""
    vat_payer: bool | None = None
    status: str = ""
    registration_date: str = ""
    caen: str = ""
    raw: dict = field(default_factory=dict)


@dataclass
class BilantInfo:
    year: int
    turnover: float | None = None
    profit: float | None = None
    employees: int | None = None
    total_assets: float | None = None
    total_debts: float | None = None
    caen: str = ""
    raw: list = field(default_factory=list)


@dataclass
class PageImage:
    src: str
    alt: str = ""


@dataclass
class PageInfo:
    url: str
    title: str
    text: str
    images: list[PageImage] = field(default_factory=list)
    links: list[dict] = field(default_factory=list)
    content_hash: str = ""
    fetched_at: datetime | None = None

    def to_payload(self) -> dict:
        d = asdict(self)
        d["fetched_at"] = self.fetched_at.isoformat() if self.fetched_at else None
        return d


@dataclass
class PlaceInfo:
    place_id: str
    name: str
    address: str = ""
    rating: float | None = None
    reviews_count: int | None = None


@dataclass
class Review:
    author: str
    rating: int | None
    text: str
    time: str = ""
    relative_time: str = ""


@dataclass
class PlaceReviews:
    place_id: str
    name: str
    rating: float | None
    reviews_count: int | None
    reviews: list[Review] = field(default_factory=list)
    fetched_at: datetime | None = None

    def to_payload(self) -> dict:
        d = asdict(self)
        d["fetched_at"] = self.fetched_at.isoformat() if self.fetched_at else None
        return d


@dataclass
class AIResult:
    text: str
    tokens_in: int
    tokens_out: int
    cost_usd: float
    model: str
    stop_reason: str = ""
