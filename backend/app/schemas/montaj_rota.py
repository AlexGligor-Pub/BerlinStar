from __future__ import annotations
from datetime import datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict


PozitieRoataStr = Literal[
    "dreapta_fata", "stanga_fata", "dreapta_spate", "stanga_spate", "rezerva", "nespecificat"
]
TipAnvelopaStr = Literal["iarna", "vara", "ms", "altele"]


class MontajRotaCreate(BaseModel):
    pozitie: PozitieRoataStr = "nespecificat"
    presiune: float | None = None
    ordine: int | None = None
    marca_id: int | None = None
    dimensiune_id: int | None = None
    profil_id: int | None = None
    tip: TipAnvelopaStr = "vara"
    adancime: float | None = None
    comments: str | None = None


class MontajRotiBulkUpsert(BaseModel):
    receipt_id: int
    items: list[MontajRotaCreate]


class MontajRotaRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    receipt_id: int | None
    pozitie: PozitieRoataStr
    presiune: float | None
    ordine: int | None
    marca_id: int | None
    dimensiune_id: int | None
    profil_id: int | None
    tip: TipAnvelopaStr
    adancime: float | None
    comments: str | None
    # denormalizat
    marca_nume: str | None = None
    dimensiune_valoare: str | None = None
    profil_valoare: str | None = None
    created_at: datetime
