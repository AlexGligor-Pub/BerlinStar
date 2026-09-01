from __future__ import annotations
import re
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field, model_validator

# Persoanele fizice nu au CUI: coloana `cui` tine CNP-ul, iar e-Factura B2C cere
# 13 cifre in PartyLegalEntity/CompanyID. Placeholder-ul e doar pentru randurile
# vechi normalizate de migratia cnp01 — la scriere CNP-ul e obligatoriu.
CNP_PLACEHOLDER = "0000000000000"


class ClientCreate(BaseModel):
    tip: str = Field(default="fizic", pattern="^(fizic|juridic)$")
    nume: str = Field(..., max_length=200)
    description: str | None = None
    cui: str | None = Field(default=None, max_length=50)
    reprezentant: str | None = Field(default=None, max_length=200)
    telefon: str | None = Field(default=None, max_length=50)
    email: str | None = Field(default=None, max_length=255)
    adresa: str | None = None
    numar_masina: str | None = Field(default=None, max_length=50)
    comments: str | None = None

    @model_validator(mode="after")
    def _normalize_cnp(self):
        if self.tip != "fizic":
            return self
        cnp = re.sub(r"[\s.\-]", "", self.cui or "")
        if not re.fullmatch(r"\d{13}", cnp):
            raise ValueError("CNP invalid: trebuie sa aiba exact 13 cifre.")
        self.cui = cnp
        return self


class ClientRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    account_id: int
    tip: str
    nume: str
    description: str | None
    cui: str | None
    reprezentant: str | None
    telefon: str | None
    email: str | None
    adresa: str | None
    numar_masina: str | None
    comments: str | None
    created_at: datetime
    updated_at: datetime | None
    is_deleted: bool
