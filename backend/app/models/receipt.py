from __future__ import annotations
import enum
from datetime import date, datetime, timezone
from decimal import Decimal
from sqlalchemy import Date, Integer, String, Text, Boolean, DateTime, Numeric, ForeignKey, Index, Enum as SAEnum, text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base
from .item import ItemType


class PayMethod(str, enum.Enum):
    NEPLATIT = "Neplatit"
    CARD = "Platit cu cardul"
    CASH = "Platit cash"
    OP = "Platit prin OP"
    PARTIAL = "Platit Partial"


class Receipt(Base):
    __tablename__ = "receipts"
    __table_args__ = (
        Index("ix_receipts_account_id_is_deleted_id", "account_id", "is_deleted", "id"),
        Index("ix_receipts_account_id_created_at", "account_id", "created_at"),
        Index("ix_receipts_client_id", "client_id"),
        Index("ix_receipts_location_id", "location_id"),
        Index(
            "ix_receipts_parent_receipt_id", "parent_receipt_id",
            postgresql_where=text("parent_receipt_id IS NOT NULL"),
        ),
        Index(
            "ix_receipts_programare_id", "programare_id",
            postgresql_where=text("programare_id IS NOT NULL"),
        ),
        # Plasa de siguranta pentru numerotarea documentelor: un numar alocat nu poate
        # aparea pe doua bonuri din acelasi cont (0 = nealocat, exclus din index).
        Index(
            "uq_receipts_account_deviz_nr", "account_id", "deviz_serie", "deviz_nr", unique=True,
            postgresql_where=text("deviz_nr > 0"), sqlite_where=text("deviz_nr > 0"),
        ),
        Index(
            "uq_receipts_account_factura_nr", "account_id", "factura_serie", "factura_nr", unique=True,
            postgresql_where=text("factura_nr > 0"), sqlite_where=text("factura_nr > 0"),
        ),
        Index(
            "uq_receipts_account_chitanta_nr", "account_id", "chitanta_serie", "chitanta_nr", unique=True,
            postgresql_where=text("chitanta_nr > 0"), sqlite_where=text("chitanta_nr > 0"),
        ),
        Index(
            "ix_receipts_account_activity", "account_id",
            text("COALESCE(updated_at, created_at) DESC"), text("id DESC"),
            postgresql_where=text("is_deleted = false"),
        ),
        Index("ix_receipts_titlu_trgm", "titlu", postgresql_using="gin", postgresql_ops={"titlu": "gin_trgm_ops"}),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    account_id: Mapped[int] = mapped_column(Integer, ForeignKey("accounts.id"), nullable=False)
    titlu: Mapped[str] = mapped_column(String(200), nullable=False)
    descriere: Mapped[str | None] = mapped_column(Text, nullable=True)
    date_tehn: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    total: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    pay_method: Mapped[PayMethod] = mapped_column(
        SAEnum(PayMethod, name="pay_method"), nullable=False, default=PayMethod.NEPLATIT
    )
    partial_pay: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    client_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("clienti.id", ondelete="SET NULL"), nullable=True)
    deviz_serie: Mapped[str] = mapped_column(String(50), nullable=False, default="")
    deviz_nr: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    factura_serie: Mapped[str] = mapped_column(String(50), nullable=False, default="")
    factura_nr: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    chitanta_serie: Mapped[str] = mapped_column(String(50), nullable=False, default="")
    chitanta_nr: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    programare_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("programari.id", ondelete="SET NULL"), nullable=True
    )
    location_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("locations.id", ondelete="SET NULL"), nullable=True
    )

    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="RON")
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    invoice_type_code: Mapped[str] = mapped_column(String(5), nullable=False, default="380")
    tax_exclusive_total: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    tax_total: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    is_extern: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    parent_receipt_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("receipts.id", ondelete="SET NULL"), nullable=True
    )
    source: Mapped[str] = mapped_column(String(20), nullable=False, server_default="reception")

    # Câmpuri pentru source="fdl" (Fișă de Lucru) — populate doar pentru FDL,
    # ignorate pentru deviz normal. Convertirea FDL→deviz le păstrează ca istoric.
    constatari: Mapped[str | None] = mapped_column(Text, nullable=True)
    sugestii: Mapped[str | None] = mapped_column(Text, nullable=True)
    timp_estimat_ore: Mapped[Decimal | None] = mapped_column(Numeric(6, 2), nullable=True)
    # Marcaj de "finalizare" pentru FDL: dupa setare, FDL-ul iese din fereastra
    # "neplatit recent" (5 zile) si apare doar daca filtrul de data il prinde
    # explicit pe data crearii.
    fdl_finalized_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    receipt_items: Mapped[list[ReceiptItem]] = relationship(
        "ReceiptItem", back_populates="receipt", cascade="all, delete-orphan", lazy="selectin"
    )
    client: Mapped["Client | None"] = relationship("Client", lazy="selectin")
    vehicol: Mapped["Vehicol | None"] = relationship("Vehicol", back_populates="receipt", uselist=False, lazy="selectin")
    cazari_anvelope: Mapped[list["CazareAnvelope"]] = relationship(
        "CazareAnvelope", back_populates="receipt", lazy="noload"
    )


class ReceiptItem(Base):
    __tablename__ = "receipt_items"
    __table_args__ = (
        Index("ix_receipt_items_account_id", "account_id"),
        Index("ix_receipt_items_receipt_id", "receipt_id"),
        Index("ix_receipt_items_employee_id", "employee_id"),
        Index("ix_receipt_items_item_id", "item_id"),
        Index("ix_receipt_items_name_trgm", "name", postgresql_using="gin", postgresql_ops={"name": "gin_trgm_ops"}),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    receipt_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("receipts.id", ondelete="CASCADE"), nullable=False
    )
    account_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("accounts.id", ondelete="SET NULL"), nullable=True
    )
    employee_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("employees.id", ondelete="SET NULL"), nullable=True
    )
    item_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("items.id", ondelete="SET NULL"), nullable=True
    )
    item_type: Mapped["ItemType | None"] = mapped_column(
        SAEnum(ItemType, name="item_type", create_type=False),
        nullable=True,
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    # Pretul dinainte de reducere. NULL = linia nu are reducere aplicata.
    # Reducerea se scade direct din `price`, ca atribuirea pe angajat/produs si
    # TVA-ul pe linie sa fie corecte; `original_price` permite eliminarea sau
    # recalcularea ei fara sa se compuneze.
    original_price: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    qty: Mapped[int] = mapped_column(Integer, nullable=False)
    unit: Mapped[str] = mapped_column(String(50), nullable=False)
    vat_category: Mapped[str] = mapped_column(String(10), nullable=False, default="S")
    vat_percent: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    unit_code: Mapped[str | None] = mapped_column(String(10), nullable=True)
    tax_exemption_reason: Mapped[str | None] = mapped_column(String(50), nullable=True)

    receipt: Mapped[Receipt] = relationship("Receipt", back_populates="receipt_items")
    employee: Mapped[Employee | None] = relationship("Employee", back_populates="receipt_items")
    item: Mapped["Item | None"] = relationship("Item")


from app.models.employee import Employee  # noqa: E402
from app.models.client import Client  # noqa: E402
from app.models.vehicol import Vehicol  # noqa: E402
from app.models.cazare_anvelope import CazareAnvelope  # noqa: E402
from app.models.item import Item  # noqa: E402
