from __future__ import annotations
from datetime import date, datetime, time
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.booking import DEFAULT_SITE_NAME

# ─── API public (/api/public/v1) ──────────────────────────────────────────────


class PublicServiceRead(BaseModel):
    id: int
    name: str
    duration_minutes: int


class PublicConfigRead(BaseModel):
    site_name: str
    location_name: str
    company_name: str | None = None
    address: str | None = None
    phone: str | None = None
    email: str | None = None
    timezone: str
    slot_minutes: int
    horizon_days: int
    cancel_cutoff_minutes: int
    services: list[PublicServiceRead]
    # Serverul MCP al garajului: calea e mereu cunoscuta; URL-ul absolut doar
    # daca Berlin Star isi stie adresa publica (MCP_PUBLIC_BASE_URL).
    mcp_path: str | None = None
    mcp_url: str | None = None


class SlotRead(BaseModel):
    start: datetime
    end: datetime


class BookingCreate(BaseModel):
    start: datetime
    nume: str = Field(..., min_length=2, max_length=100)
    telefon: str = Field(..., min_length=6, max_length=30)
    descriere: str = Field(..., min_length=3, max_length=500)
    service_id: int | None = None
    marca: str | None = Field(None, max_length=60)
    model: str | None = Field(None, max_length=60)
    an: int | None = Field(None, ge=1950, le=date.today().year + 1)
    # Capcana pentru boti: campul e ascuns in formular, un om nu il completeaza.
    website: str | None = None

    @field_validator("marca", "model")
    @classmethod
    def _blank_to_none(cls, v: str | None) -> str | None:
        return v.strip() or None if v else None


class BookingRead(BaseModel):
    """Ce vede clientul despre programarea lui. Fara descriere si fara nume —
    cautarea dupa telefon nu e verificata (vezi specificatia, §7)."""
    ref: str
    start: datetime
    end: datetime
    service: str | None = None
    status: str


class BookingPhone(BaseModel):
    telefon: str = Field(..., min_length=6, max_length=30)


# ─── Configurare interna (Berlin Star) ───────────────────────────────────────


class BookingHoursItem(BaseModel):
    weekday: int = Field(..., ge=0, le=6)
    open_time: time
    close_time: time


class BookingServiceItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int | None = None
    name: str = Field(..., min_length=1, max_length=120)
    duration_minutes: int = Field(..., ge=10, le=600)
    active: bool = True


class BookingSettingsRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    location_id: int
    enabled: bool
    site_name: str
    public_slug: str | None
    # Adresa absoluta a serverului MCP, cand Berlin Star isi stie adresa publica.
    mcp_url: str | None = None
    department_id: int | None
    slot_minutes: int
    capacity: int
    lead_minutes: int
    horizon_days: int
    cancel_cutoff_minutes: int
    closed_on_holidays: bool
    hours: list[BookingHoursItem]
    services: list[BookingServiceItem]


class BookingSettingsWrite(BaseModel):
    enabled: bool = False
    site_name: str = Field(DEFAULT_SITE_NAME, min_length=1, max_length=120)
    # None = pastreaza identificatorul existent (sau genereaza unul din nume).
    public_slug: str | None = Field(None, max_length=60)
    department_id: int | None = None
    slot_minutes: int = Field(60, ge=10, le=480)
    capacity: int = Field(1, ge=1, le=50)
    lead_minutes: int = Field(120, ge=0, le=10_080)
    horizon_days: int = Field(30, ge=1, le=365)
    cancel_cutoff_minutes: int = Field(120, ge=0, le=10_080)
    closed_on_holidays: bool = True
    hours: list[BookingHoursItem] = []
    services: list[BookingServiceItem] = []

    @field_validator("site_name")
    @classmethod
    def _strip(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Numele site-ului nu poate fi gol.")
        return v

    @field_validator("hours")
    @classmethod
    def _check_hours(cls, v: list[BookingHoursItem]) -> list[BookingHoursItem]:
        for h in v:
            if h.close_time <= h.open_time:
                raise ValueError("Ora de închidere trebuie să fie după ora de deschidere.")
        return v


class ApiKeyCreate(BaseModel):
    location_id: int
    name: str = Field(..., min_length=1, max_length=120)


class ApiKeyRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    location_id: int
    name: str
    prefix: str
    created_at: datetime
    last_used_at: datetime | None
    revoked_at: datetime | None


class ApiKeyCreated(ApiKeyRead):
    # Cheia in clar — apare DOAR in raspunsul de creare.
    key: str
