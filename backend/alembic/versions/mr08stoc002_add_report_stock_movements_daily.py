"""add report_stock_movements_daily

Revision ID: mr08stoc002
Revises: mr07stoc001
Create Date: 2026-05-16

Tabel pre-agregat zilnic pentru raportarea miscarilor de stoc, in acelasi
pattern cu report_receipts_daily / report_employee_daily / etc. Construit
de scheduler la 02:00 (Europe/Bucharest) si trigger manual din AdminV2 cu
cooldown 5min.

Granularitate rand: (report_date, account_id, location_id, item_id,
employee_id, movement_type). Tabelul e idempotent — builder-ul face
DELETE+INSERT pe perioada ceruta.
"""
from __future__ import annotations
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "mr08stoc002"
down_revision = "mr07stoc001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "report_stock_movements_daily",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("report_date", sa.Date(), nullable=False),
        sa.Column("account_id", sa.Integer(), sa.ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("location_id", sa.Integer(), sa.ForeignKey("locations.id", ondelete="SET NULL"), nullable=True),
        sa.Column("item_id", sa.Integer(), sa.ForeignKey("items.id", ondelete="SET NULL"), nullable=True),
        sa.Column("item_name", sa.String(200), nullable=False),
        sa.Column("employee_id", sa.Integer(), sa.ForeignKey("employees.id", ondelete="SET NULL"), nullable=True),
        sa.Column(
            "movement_type",
            postgresql.ENUM("SALE", "SALE_REVERSE", "PURCHASE", "ADJUSTMENT", name="stock_movement_type", create_type=False),
            nullable=False,
        ),
        sa.Column("qty_total", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("qty_delta_total", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("valoare_vanzare", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("valoare_cost", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("nr_movements", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index(
        "ix_report_stock_mov_daily_account_date",
        "report_stock_movements_daily",
        ["account_id", "report_date"],
    )
    op.create_index(
        "ix_report_stock_mov_daily_account_loc_date",
        "report_stock_movements_daily",
        ["account_id", "location_id", "report_date"],
    )
    op.create_index(
        "ix_report_stock_mov_daily_item_date",
        "report_stock_movements_daily",
        ["item_id", "report_date"],
    )
    op.create_index(
        "ix_report_stock_mov_daily_emp_date",
        "report_stock_movements_daily",
        ["employee_id", "report_date"],
    )


def downgrade() -> None:
    op.drop_index("ix_report_stock_mov_daily_emp_date", table_name="report_stock_movements_daily")
    op.drop_index("ix_report_stock_mov_daily_item_date", table_name="report_stock_movements_daily")
    op.drop_index("ix_report_stock_mov_daily_account_loc_date", table_name="report_stock_movements_daily")
    op.drop_index("ix_report_stock_mov_daily_account_date", table_name="report_stock_movements_daily")
    op.drop_table("report_stock_movements_daily")
