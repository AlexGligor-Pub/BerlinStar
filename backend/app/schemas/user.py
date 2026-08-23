from __future__ import annotations
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.models.user import UserRole

# Parola minima 10 caractere, la fel ca la login/register — utilizatorii au
# acces la date operationale, nu slabim cerinta pentru conturile create de admin.
PASSWORD_MIN = 10


class SessionRead(BaseModel):
    """Un dispozitiv/browser pe care userul e logat."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    device_id: int | None = None
    device_name: str | None = None
    ip: str | None = None
    user_agent: str | None = None
    created_at: datetime
    last_seen_at: datetime
    expires_at: datetime
    # Numele locatiei dispozitivului, cand e inregistrat (devices -> locations).
    location_name: str | None = None
    is_current: bool = False


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    account_id: int
    username: str
    name: str
    email: str | None = None
    role: UserRole
    employee_id: int | None = None
    is_active: bool
    last_login_at: datetime | None = None
    created_at: datetime
    # Numarul de dispozitive pe care e logat acum + detaliile lor.
    active_sessions: int = 0
    sessions: list[SessionRead] = []


class UserCreate(BaseModel):
    username: str = Field(..., min_length=1, max_length=100)
    password: str = Field(..., min_length=PASSWORD_MIN, max_length=255)
    role: UserRole = UserRole.WORKER
    name: str = Field(..., min_length=1, max_length=200)
    email: EmailStr | None = Field(None, max_length=255)
    employee_id: int | None = None

    @field_validator("username")
    @classmethod
    def _clean_username(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Utilizatorul este obligatoriu.")
        if any(c.isspace() for c in v):
            raise ValueError("Utilizatorul nu poate conține spații.")
        return v


class UserUpdate(BaseModel):
    """Toate campurile sunt opuionale — trimitem doar ce se schimba.

    Parola NU se schimba de aici; are endpoint dedicat (`/password`), ca sa nu
    fie modificata accidental de un PATCH parual.
    """
    username: str | None = Field(None, min_length=1, max_length=100)
    name: str | None = Field(None, min_length=1, max_length=200)
    email: EmailStr | None = Field(None, max_length=255)
    role: UserRole | None = None
    employee_id: int | None = None
    is_active: bool | None = None

    @field_validator("username")
    @classmethod
    def _clean_username(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        if any(c.isspace() for c in v):
            raise ValueError("Utilizatorul nu poate conține spații.")
        return v


class UserSetPassword(BaseModel):
    new_password: str = Field(..., min_length=PASSWORD_MIN, max_length=255)


class MessageResponse(BaseModel):
    message: str
