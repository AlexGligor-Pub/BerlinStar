from __future__ import annotations
from datetime import datetime, timezone
import enum
from sqlalchemy import Integer, String, Text, Boolean, DateTime, Float, ForeignKey, Index, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column
from .base import Base
from .anvelopa import TipAnvelopa


class PozitieRoata(str, enum.Enum):
    DREAPTA_FATA = "dreapta_fata"
    STANGA_FATA = "stanga_fata"
    DREAPTA_SPATE = "dreapta_spate"
    STANGA_SPATE = "stanga_spate"
    REZERVA = "rezerva"
    NESPECIFICAT = "nespecificat"


class MontajRota(Base):
    __tablename__ = "montaj_roti"
    __table_args__ = (
        Index("ix_montaj_roti_account_id_is_deleted_id", "account_id", "is_deleted", "id"),
        Index("ix_montaj_roti_receipt_id", "receipt_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    account_id: Mapped[int] = mapped_column(Integer, ForeignKey("accounts.id"), nullable=False)
    receipt_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("receipts.id", ondelete="SET NULL"), nullable=True
    )
    pozitie: Mapped[PozitieRoata] = mapped_column(
        SAEnum(PozitieRoata, name="pozitie_roata", values_callable=lambda obj: [e.value for e in obj]),
        nullable=False,
        default=PozitieRoata.NESPECIFICAT,
    )
    presiune: Mapped[float | None] = mapped_column(Float, nullable=True)
    ordine: Mapped[int | None] = mapped_column(Integer, nullable=True)
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
    adancime: Mapped[float | None] = mapped_column(Float, nullable=True)
    cuplu_strangere: Mapped[float | None] = mapped_column(Float, nullable=True)
    indice_viteza: Mapped[str | None] = mapped_column(String(4), nullable=True)
    indice_sarcina: Mapped[int | None] = mapped_column(Integer, nullable=True)
    comments: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
