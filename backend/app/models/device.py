from __future__ import annotations
from datetime import datetime, timezone
from sqlalchemy import Integer, String, ForeignKey, Index, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base


class Device(Base):
    __tablename__ = "devices"
    __table_args__ = (
        Index("ix_devices_account_id_id", "account_id", "id"),
        Index("ix_devices_location_id", "location_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    account_id: Mapped[int] = mapped_column(Integer, ForeignKey("accounts.id"), nullable=False)
    location_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("locations.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )

    location: Mapped[Location | None] = relationship("Location", back_populates="devices")


from .location import Location  # noqa: E402
