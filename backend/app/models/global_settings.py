from __future__ import annotations
from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column
from .base import Base


class GlobalSettings(Base):
    __tablename__ = "global_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    hotel_cazare_image_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    hotel_scoatere_image_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    hotel_montare_image_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
