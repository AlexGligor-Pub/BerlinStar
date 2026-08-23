from __future__ import annotations
import enum
from datetime import datetime, timezone
from decimal import Decimal
from sqlalchemy import Boolean, DateTime, Enum as SAEnum, ForeignKey, Index, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base


class PaymentKind(str, enum.Enum):
    """Tipul mișcării de bani legata de un bon.

    Distinctia fata de liniile bonului e esentiala: liniile descriu CE s-a vandut
    (baza de TVA), iar aceste inregistrari descriu CAND si CUM au circulat banii.
    Un avans NU e o reducere — nu scade valoarea prestatiei, doar arata ca o parte
    din bani a fost deja incasata.
    """
    AVANS       = "avans"        # bani primiti inainte de finalizare (+)
    PLATA       = "plata"        # incasare obisnuita (+)
    RESTITUIRE  = "restituire"   # bani returnati clientului (-)


class PaymentMethod(str, enum.Enum):
    CASH = "Cash"
    CARD = "Card"
    OP   = "OP"
    ALTA = "Alta"


class ReceiptPayment(Base):
    """O mișcare de bani pe un bon: avans, plata sau restituire.

    Registrul e sursa de adevar pentru "cat s-a incasat"; `receipts.pay_method` si
    `receipts.partial_pay` se recalculeaza din el (vezi services/payments_service.py),
    ca tot codul existent (rapoarte, filtrul "neplatit", POS) sa functioneze neschimbat.
    """
    __tablename__ = "receipt_payments"
    __table_args__ = (
        Index("ix_receipt_payments_receipt_id_id", "receipt_id", "id"),
        Index("ix_receipt_payments_account_id_id", "account_id", "id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    receipt_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("receipts.id", ondelete="CASCADE"), nullable=False
    )
    account_id: Mapped[int] = mapped_column(Integer, ForeignKey("accounts.id"), nullable=False)
    kind: Mapped[PaymentKind] = mapped_column(
        SAEnum(PaymentKind, name="payment_kind", values_callable=lambda e: [m.value for m in e]),
        nullable=False,
    )
    # Suma e mereu POZITIVA; semnul rezulta din `kind` (restituire scade).
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    method: Mapped[PaymentMethod] = mapped_column(
        SAEnum(PaymentMethod, name="payment_method", values_callable=lambda e: [m.value for m in e]),
        nullable=False,
        default=PaymentMethod.CASH,
    )
    paid_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    employee_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("employees.id", ondelete="SET NULL"), nullable=True
    )
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    # Stergere logica: registrul de bani e document de audit, nu stergem fizic.
    is_deleted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    employee: Mapped["Employee | None"] = relationship("Employee")


from .employee import Employee  # noqa: E402
