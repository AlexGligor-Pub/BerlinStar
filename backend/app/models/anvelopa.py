from __future__ import annotations
from datetime import datetime, timezone
import enum
from sqlalchemy import Integer, String, Text, Boolean, DateTime, Float, ForeignKey, Index, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base


class TipAnvelopa(str, enum.Enum):
    IARNA = "iarna"
    VARA = "vara"
    MS = "ms"
    ALTELE = "altele"


class Anvelopa(Base):
    __tablename__ = "anvelope"
    __table_args__ = (
        Index("ix_anvelope_account_id_is_deleted_id", "account_id", "is_deleted", "id"),
        Index("ix_anvelope_account_id_client_id", "account_id", "client_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    account_id: Mapped[int] = mapped_column(Integer, ForeignKey("accounts.id"), nullable=False)
    client_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("clienti.id", ondelete="SET NULL"), nullable=True
    )
    marca_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("marci_anvelope.id", ondelete="SET NULL"), nullable=True
    )
    dimensiune_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("dimensiuni_anvelope.id", ondelete="SET NULL"), nullable=True
    )
    profil_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("profiluri_anvelope.id", ondelete="SET NULL"), nullable=True
    )
    dot_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("coduri_dot_anvelope.id", ondelete="SET NULL"), nullable=True
    )
    tip: Mapped[TipAnvelopa] = mapped_column(
        SAEnum(TipAnvelopa, name="tip_anvelopa", values_callable=lambda obj: [e.value for e in obj]),
        nullable=False,
        default=TipAnvelopa.VARA,
    )
    adancime: Mapped[float | None] = mapped_column(Float, nullable=True)  # mm
    comments: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    marca: Mapped["MarcaAnvelopa | None"] = relationship("MarcaAnvelopa")  # type: ignore[name-defined]
    dimensiune: Mapped["DimensiuneAnvelopa | None"] = relationship("DimensiuneAnvelopa")  # type: ignore[name-defined]
    profil: Mapped["ProfilAnvelopa | None"] = relationship("ProfilAnvelopa")  # type: ignore[name-defined]
    dot: Mapped["CodDotAnvelopa | None"] = relationship("CodDotAnvelopa")  # type: ignore[name-defined]
