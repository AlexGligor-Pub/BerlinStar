from __future__ import annotations
from pydantic import BaseModel


class GlobalSettingsRead(BaseModel):
    hotel_cazare_image_path: str | None
    hotel_scoatere_image_path: str | None
    hotel_montare_image_path: str | None

    model_config = {"from_attributes": True}


class SmtpSettingsRead(BaseModel):
    smtp_host: str | None
    smtp_port: int | None
    smtp_user: str | None
    smtp_password: str
    smtp_from_name: str | None
    smtp_from_address: str | None
    smtp_use_tls: bool
    smtp_enabled: bool

    model_config = {"from_attributes": True}


class SmtpSettingsPatch(BaseModel):
    smtp_host: str | None = None
    smtp_port: int | None = None
    smtp_user: str | None = None
    smtp_password: str | None = None
    smtp_from_name: str | None = None
    smtp_from_address: str | None = None
    smtp_use_tls: bool | None = None
    smtp_enabled: bool | None = None
