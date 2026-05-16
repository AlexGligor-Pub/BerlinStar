"""add stocuri (cost_price, stoc_minim, stocks, stock_movements)

Revision ID: mr07stoc001
Revises: mr06merge001
Create Date: 2026-05-16

Adauga gestiunea de stoc per produs per locatie:
- items.cost_price (Numeric 10,2 nullable) si items.stoc_minim (Integer NOT NULL default 0)
- tabel `stocks` (qty per item x location, unique(item_id, location_id))
- tabel `stock_movements` (audit complet pentru vanzari, intrari, ajustari, storno)
- enum `stock_movement_type` cu SALE/SALE_REVERSE/PURCHASE/ADJUSTMENT
- backfill: pentru fiecare (account.id, produs.id, locatie_a_contului.id) INSERT Stock(qty=0)
"""
from __future__ import annotations
from alembic import op
import sqlalchemy as sa


revision = "mr07stoc001"
down_revision = "mr06merge001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "items",
        sa.Column("cost_price", sa.Numeric(10, 2), nullable=True),
    )
    op.add_column(
        "items",
        sa.Column("stoc_minim", sa.Integer(), nullable=False, server_default="0"),
    )

    op.create_table(
        "stocks",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("account_id", sa.Integer(), sa.ForeignKey("accounts.id"), nullable=False),
        sa.Column("item_id", sa.Integer(), sa.ForeignKey("items.id", ondelete="CASCADE"), nullable=False),
        sa.Column("location_id", sa.Integer(), sa.ForeignKey("locations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("qty", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("item_id", "location_id", name="uq_stocks_item_location"),
    )
    op.create_index(
        "ix_stocks_account_id_location_id_item_id",
        "stocks",
        ["account_id", "location_id", "item_id"],
    )

    op.create_table(
        "stock_movements",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("account_id", sa.Integer(), sa.ForeignKey("accounts.id"), nullable=False),
        sa.Column("item_id", sa.Integer(), sa.ForeignKey("items.id", ondelete="SET NULL"), nullable=True),
        sa.Column("item_name", sa.String(200), nullable=False),
        sa.Column("location_id", sa.Integer(), sa.ForeignKey("locations.id", ondelete="SET NULL"), nullable=True),
        sa.Column("employee_id", sa.Integer(), sa.ForeignKey("employees.id", ondelete="SET NULL"), nullable=True),
        sa.Column("receipt_id", sa.Integer(), sa.ForeignKey("receipts.id", ondelete="SET NULL"), nullable=True),
        sa.Column(
            "movement_type",
            sa.Enum("SALE", "SALE_REVERSE", "PURCHASE", "ADJUSTMENT", name="stock_movement_type"),
            nullable=False,
        ),
        sa.Column("qty_delta", sa.Integer(), nullable=False),
        sa.Column("unit_cost", sa.Numeric(10, 2), nullable=True),
        sa.Column("unit_price", sa.Numeric(10, 2), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("created_by_user", sa.String(120), nullable=True),
    )
    op.create_index("ix_stock_movements_account_id_created_at", "stock_movements", ["account_id", "created_at"])
    op.create_index("ix_stock_movements_location_id_created_at", "stock_movements", ["location_id", "created_at"])
    op.create_index("ix_stock_movements_item_id_created_at", "stock_movements", ["item_id", "created_at"])
    op.create_index("ix_stock_movements_receipt_id", "stock_movements", ["receipt_id"])

    # Backfill: pentru fiecare (item PRODUS, locatie care apartine aceluiasi account
    # via location_departments → categories.department_id → items.category_id) INSERT Stock(qty=0).
    # Simplificat: leg locatia direct de departamentul itemului prin lantul de tabele.
    op.execute(
        """
        INSERT INTO stocks (account_id, item_id, location_id, qty, updated_at)
        SELECT DISTINCT i.account_id, i.id, l.id, 0, NOW()
          FROM items i
          JOIN categories c ON c.id = i.category_id
          JOIN location_departments ld ON ld.department_id = c.department_id
          JOIN locations l ON l.id = ld.location_id
         WHERE i.type = 'PRODUS'
           AND i.is_deleted = false
           AND l.is_deleted = false
        ON CONFLICT (item_id, location_id) DO NOTHING
        """
    )


def downgrade() -> None:
    op.drop_index("ix_stock_movements_receipt_id", table_name="stock_movements")
    op.drop_index("ix_stock_movements_item_id_created_at", table_name="stock_movements")
    op.drop_index("ix_stock_movements_location_id_created_at", table_name="stock_movements")
    op.drop_index("ix_stock_movements_account_id_created_at", table_name="stock_movements")
    op.drop_table("stock_movements")
    sa.Enum(name="stock_movement_type").drop(op.get_bind(), checkfirst=True)
    op.drop_index("ix_stocks_account_id_location_id_item_id", table_name="stocks")
    op.drop_table("stocks")
    op.drop_column("items", "stoc_minim")
    op.drop_column("items", "cost_price")
