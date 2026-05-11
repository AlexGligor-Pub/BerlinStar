from __future__ import annotations
from datetime import datetime
from pydantic import BaseModel

VALID_SCENARIOS = {"client_nou", "reminder_plata"}


class EmailTemplateRead(BaseModel):
    id: int
    scenario: str
    subject: str
    title: str
    body: str
    enabled: bool

    model_config = {"from_attributes": True}


class EmailTemplatePatch(BaseModel):
    subject: str | None = None
    title: str | None = None
    body: str | None = None
    enabled: bool | None = None


class EmailLogRead(BaseModel):
    id: int
    sent_at: datetime
    account_id: int | None
    to_address: str
    scenario: str | None
    subject: str
    status: str
    error_message: str | None
    body_html: str | None

    model_config = {"from_attributes": True}
