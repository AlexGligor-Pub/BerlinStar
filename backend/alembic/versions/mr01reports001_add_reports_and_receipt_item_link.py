"""add reports tables + receipt_items.item_id and item_type (merge + new tables)

Revision ID: mr01reports001
Revises: cc3dd4ee5ff6, a2b3c4d5e6f7, b3c4d5e6f7a8, zz9ii0jj1kk2
Create Date: 2026-05-14 12:00:00.000000

Această migrare unifică cele 4 head-uri Alembic existente
(cc3dd4ee5ff6, a2b3c4d5e6f7, b3c4d5e6f7a8, zz9ii0jj1kk2) și adaugă
infrastructura pentru rapoarte: coloanele item_id/item_type pe receipt_items
plus tabelele report_receipts_daily, report_receipts_breakdown_daily,
report_employee_daily și report_runs.
"""
from __future__ import annotations
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "mr01reports001"
down_revision = ("cc3dd4ee5ff6", "a2b3c4d5e6f7", "b3c4d5e6f7a8", "zz9ii0jj1kk2")
branch_labels = None
depends_on = None


def _is_postgres() -> bool:
    return op.get_bind().dialect.name == "postgresql"


def upgrade() -> None:
    pg = _is_postgres()

    # 1. receipt_items: add item_id FK + item_type snapshot
    with op.batch_alter_table("receipt_items") as batch:
        batch.add_column(sa.Column("item_id", sa.Integer(), nullable=True))
        batch.create_foreign_key(
            "fk_receipt_items_item_id",
            "items",
            ["item_id"],
            ["id"],
            ondelete="SET NULL",
        )

    if pg:
        op.add_column(
            "receipt_items",
            sa.Column(
                "item_type",
                postgresql.ENUM(
                    "PRODUS", "SERVICE",
                    name="item_type",
                    create_type=False,
                ),
                nullable=True,
            ),
        )
    else:
        op.add_column(
            "receipt_items",
            sa.Column("item_type", sa.String(length=20), nullable=True),
        )

    op.create_index("ix_receipt_items_item_id", "receipt_items", ["item_id"])
    op.create_index("ix_receipt_items_item_type", "receipt_items", ["item_type"])

    # Backfill item_id + item_type pe match (account_id, name) cu items neșterse
    if pg:
        op.execute(
            """
            UPDATE receipt_items AS ri
            SET item_id = i.id, item_type = i.type
            FROM items AS i
            WHERE i.account_id = ri.account_id
              AND i.name = ri.name
              AND i.is_deleted = false
            """
        )
    else:
        op.execute(
            """
            UPDATE receipt_items SET
                item_id = (
                    SELECT i.id FROM items i
                    WHERE i.account_id = receipt_items.account_id
                      AND i.name = receipt_items.name
                      AND i.is_deleted = 0
                    LIMIT 1
                ),
                item_type = (
                    SELECT i.type FROM items i
                    WHERE i.account_id = receipt_items.account_id
                      AND i.name = receipt_items.name
                      AND i.is_deleted = 0
                    LIMIT 1
                )
            """
        )

    # 2. report_receipts_daily (Tabel 1A — pivot pe pay_method)
    op.create_table(
        "report_receipts_daily",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("report_date", sa.Date(), nullable=False),
        sa.Column("account_id", sa.Integer(), sa.ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("location_id", sa.Integer(), sa.ForeignKey("locations.id", ondelete="SET NULL"), nullable=True),
        sa.Column("count_total", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("count_card", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("count_cash", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("count_op", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("count_partial", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("count_neplatit", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("sum_total", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("sum_card", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("sum_cash", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("sum_op", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("sum_partial", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("sum_neplatit", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("sum_paid", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("sum_unpaid", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    # UNIQUE pe (report_date, account_id, COALESCE(location_id, 0)) — funcțional, suportă NULL
    if pg:
        op.execute(
            "CREATE UNIQUE INDEX uq_report_receipts_daily ON report_receipts_daily "
            "(report_date, account_id, COALESCE(location_id, 0))"
        )
    else:
        op.execute(
            "CREATE UNIQUE INDEX uq_report_receipts_daily ON report_receipts_daily "
            "(report_date, account_id, COALESCE(location_id, 0))"
        )
    op.create_index(
        "ix_report_receipts_daily_account_date",
        "report_receipts_daily",
        ["account_id", "report_date"],
    )

    # 3. report_receipts_breakdown_daily (Tabel 1B — long format pe item_type/categorie/departament)
    op.create_table(
        "report_receipts_breakdown_daily",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("report_date", sa.Date(), nullable=False),
        sa.Column("account_id", sa.Integer(), sa.ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("location_id", sa.Integer(), sa.ForeignKey("locations.id", ondelete="SET NULL"), nullable=True),
        sa.Column("dimension_type", sa.String(length=20), nullable=False),  # item_type | category | department
        sa.Column("dimension_id", sa.Integer(), nullable=True),
        sa.Column("dimension_value", sa.String(length=50), nullable=True),
        sa.Column("sum_amount", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("count_items", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.execute(
        "CREATE UNIQUE INDEX uq_report_receipts_breakdown_daily ON report_receipts_breakdown_daily "
        "(report_date, account_id, COALESCE(location_id, 0), dimension_type, "
        "COALESCE(dimension_id, 0), COALESCE(dimension_value, ''))"
    )
    op.create_index(
        "ix_report_receipts_breakdown_daily_account_date",
        "report_receipts_breakdown_daily",
        ["account_id", "report_date"],
    )

    # 4. report_employee_daily (Tabel 2)
    op.create_table(
        "report_employee_daily",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("report_date", sa.Date(), nullable=False),
        sa.Column("account_id", sa.Integer(), sa.ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("employee_id", sa.Integer(), sa.ForeignKey("employees.id", ondelete="SET NULL"), nullable=True),
        sa.Column("item_type", sa.String(length=20), nullable=True),
        sa.Column("category_id", sa.Integer(), sa.ForeignKey("categories.id", ondelete="SET NULL"), nullable=True),
        sa.Column("category_name", sa.String(length=200), nullable=True),
        sa.Column("department_id", sa.Integer(), sa.ForeignKey("departments.id", ondelete="SET NULL"), nullable=True),
        sa.Column("department_name", sa.String(length=200), nullable=True),
        sa.Column("sum_amount", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("count_items", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.execute(
        "CREATE UNIQUE INDEX uq_report_employee_daily ON report_employee_daily "
        "(report_date, account_id, COALESCE(employee_id, 0), COALESCE(item_type, ''), "
        "COALESCE(category_id, 0), COALESCE(department_id, 0))"
    )
    op.create_index(
        "ix_report_employee_daily_account_date",
        "report_employee_daily",
        ["account_id", "report_date"],
    )
    op.create_index(
        "ix_report_employee_daily_employee_date",
        "report_employee_daily",
        ["employee_id", "report_date"],
    )

    # 5. report_runs (centralizator + cooldown)
    op.create_table(
        "report_runs",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("report_type", sa.String(length=40), nullable=False, unique=True),
        sa.Column("last_run_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_period_start", sa.Date(), nullable=True),
        sa.Column("last_period_end", sa.Date(), nullable=True),
        sa.Column("last_triggered_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="idle"),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("last_duration_ms", sa.Integer(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # Seed initial: 2 rapoarte
    if pg:
        op.execute(
            "INSERT INTO report_runs (report_type, status, updated_at) "
            "VALUES ('receipts_daily', 'idle', NOW()), ('employee_daily', 'idle', NOW())"
        )
    else:
        op.execute(
            "INSERT INTO report_runs (report_type, status, updated_at) "
            "VALUES ('receipts_daily', 'idle', CURRENT_TIMESTAMP), "
            "('employee_daily', 'idle', CURRENT_TIMESTAMP)"
        )


def downgrade() -> None:
    op.drop_table("report_runs")
    op.drop_index("ix_report_employee_daily_employee_date", table_name="report_employee_daily")
    op.drop_index("ix_report_employee_daily_account_date", table_name="report_employee_daily")
    op.execute("DROP INDEX IF EXISTS uq_report_employee_daily")
    op.drop_table("report_employee_daily")
    op.drop_index("ix_report_receipts_breakdown_daily_account_date", table_name="report_receipts_breakdown_daily")
    op.execute("DROP INDEX IF EXISTS uq_report_receipts_breakdown_daily")
    op.drop_table("report_receipts_breakdown_daily")
    op.drop_index("ix_report_receipts_daily_account_date", table_name="report_receipts_daily")
    op.execute("DROP INDEX IF EXISTS uq_report_receipts_daily")
    op.drop_table("report_receipts_daily")

    op.drop_index("ix_receipt_items_item_type", table_name="receipt_items")
    op.drop_index("ix_receipt_items_item_id", table_name="receipt_items")
    with op.batch_alter_table("receipt_items") as batch:
        batch.drop_column("item_type")
        batch.drop_constraint("fk_receipt_items_item_id", type_="foreignkey")
        batch.drop_column("item_id")
