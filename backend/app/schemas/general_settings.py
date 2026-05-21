from __future__ import annotations
from pydantic import BaseModel, ConfigDict


class GeneralSettingsPatch(BaseModel):
    use_factura: bool | None = None
    use_aviz: bool | None = None
    afiseaza_tehnician_deviz: bool | None = None
    dezactiveaza_hotel_anvelope: bool | None = None

    montare_roti_show_presiune: bool | None = None
    montare_roti_show_marca: bool | None = None
    montare_roti_show_profil: bool | None = None
    montare_roti_show_dimensiune: bool | None = None
    montare_roti_show_dot: bool | None = None
    montare_roti_show_tip: bool | None = None
    montare_roti_show_adancime: bool | None = None
    montare_roti_show_cuplu: bool | None = None

    hotel_anvelope_show_profil: bool | None = None
    hotel_anvelope_show_dot: bool | None = None
    hotel_anvelope_show_adancime: bool | None = None
    hotel_anvelope_show_tip: bool | None = None


class GeneralSettingsRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    account_id: int
    use_factura: bool
    use_aviz: bool
    afiseaza_tehnician_deviz: bool
    dezactiveaza_hotel_anvelope: bool

    montare_roti_show_presiune: bool
    montare_roti_show_marca: bool
    montare_roti_show_profil: bool
    montare_roti_show_dimensiune: bool
    montare_roti_show_dot: bool
    montare_roti_show_tip: bool
    montare_roti_show_adancime: bool
    montare_roti_show_cuplu: bool

    hotel_anvelope_show_profil: bool
    hotel_anvelope_show_dot: bool
    hotel_anvelope_show_adancime: bool
    hotel_anvelope_show_tip: bool
