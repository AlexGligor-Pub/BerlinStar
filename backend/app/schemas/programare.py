from __future__ import annotations
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field
from app.models.programare import ProgramareStatus


class ProgramareCreate(BaseModel):
    titlu:         str = Field(..., max_length=200)
    notite:        str | None = None
    client_id:     int | None = None
    location_id:   int
    department_id: int | None = None
    start_time:    datetime
    end_time:      datetime
    status:        ProgramareStatus = ProgramareStatus.PROGRAMAT


class ProgramarePatch(BaseModel):
    titlu:         str | None = Field(None, max_length=200)
    notite:        str | None = None
    client_id:     int | None = None
    department_id: int | None = None
    start_time:    datetime | None = None
    end_time:      datetime | None = None
    status:        ProgramareStatus | None = None


class ProgramareRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id:              int
    account_id:      int
    titlu:           str
    notite:          str | None
    client_id:       int | None
    client_nume:     str | None = None
    location_id:     int
    department_id:   int | None
    department_name: str | None = None
    start_time:      datetime
    end_time:        datetime
    status:          ProgramareStatus
    created_at:      datetime
    updated_at:      datetime | None
    is_deleted:      bool
    deleted_at:      datetime | None
