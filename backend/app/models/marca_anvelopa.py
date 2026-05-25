from __future__ import annotations
from datetime import datetime, timezone
from sqlalchemy import Integer, String, Boolean, DateTime, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column
from .base import Base


# Marcile de anvelope sunt GLOBALE (vizibile pentru toate conturile dupa aprobare).
# Userul propune marci noi via POST /api/marci-anvelope/propune (status='pending'),
# adminul global le aproba/respinge din AdminV2. Pana la aprobare marca nu apare
# in dropdown-uri pentru nimeni (nici pentru proprietarul propunerii).
class MarcaAnvelopa(Base):
    __tablename__ = "marci_anvelope"
    __table_args__ = (
        Index("ix_marci_anvelope_status_is_deleted", "status", "is_deleted", "nume"),
        Index("ix_marci_anvelope_proposed_by", "proposed_by_account_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    nume: Mapped[str] = mapped_column(String(200), nullable=False)
    # 'approved' | 'pending' | 'rejected'
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="approved")
    proposed_by_account_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("accounts.id", ondelete="SET NULL"), nullable=True
    )
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    rejected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
