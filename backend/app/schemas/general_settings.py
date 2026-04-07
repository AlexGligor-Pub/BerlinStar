from __future__ import annotations
from pydantic import BaseModel, ConfigDict


class GeneralSettingsPatch(BaseModel):
    use_factura: bool | None = None
    use_aviz: bool | None = None
    afiseaza_tehnician_deviz: bool | None = None


class GeneralSettingsRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    account_id: int
    use_factura: bool
    use_aviz: bool
    afiseaza_tehnician_deviz: bool
