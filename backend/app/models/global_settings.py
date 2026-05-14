from __future__ import annotations
from sqlalchemy import Boolean, Integer, String
from sqlalchemy.orm import Mapped, mapped_column
from .base import Base


class GlobalSettings(Base):
    __tablename__ = "global_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    hotel_cazare_image_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    hotel_scoatere_image_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    hotel_montare_image_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    # Imagini per pozitie pentru modalul "Montare Roti" din POS (afisate langa fiecare roata).
    montare_stanga_fata_image_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    montare_dreapta_fata_image_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    montare_stanga_spate_image_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    montare_dreapta_spate_image_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    montare_rezerva_image_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    montare_nespecificat_image_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    smtp_host: Mapped[str | None] = mapped_column(String(255), nullable=True)
    smtp_port: Mapped[int | None] = mapped_column(Integer, nullable=True)
    smtp_user: Mapped[str | None] = mapped_column(String(255), nullable=True)
    smtp_password: Mapped[str | None] = mapped_column(String(500), nullable=True)
    smtp_from_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    smtp_from_address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    smtp_use_tls: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="1")
    smtp_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="0")
