from __future__ import annotations
from sqlalchemy import Integer, Boolean, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from .base import Base


class GeneralSettings(Base):
    __tablename__ = "general_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    account_id: Mapped[int] = mapped_column(Integer, ForeignKey("accounts.id"), nullable=False, unique=True)
    use_factura: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    use_aviz: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    afiseaza_tehnician_deviz: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    dezactiveaza_hotel_anvelope: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    montare_roti_show_presiune: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    montare_roti_show_marca: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    montare_roti_show_profil: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    montare_roti_show_dimensiune: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    montare_roti_show_dot: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    montare_roti_show_tip: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    montare_roti_show_adancime: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    montare_roti_show_cuplu: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    hotel_anvelope_show_profil: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    hotel_anvelope_show_dot: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    hotel_anvelope_show_adancime: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    hotel_anvelope_show_tip: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
