from __future__ import annotations
from pydantic import BaseModel


class GlobalSettingsRead(BaseModel):
    hotel_cazare_image_path: str | None
    hotel_scoatere_image_path: str | None
    hotel_montare_image_path: str | None

    model_config = {"from_attributes": True}
