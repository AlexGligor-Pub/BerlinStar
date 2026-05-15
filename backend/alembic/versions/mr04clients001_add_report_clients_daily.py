"""add report_clients_daily

Revision ID: mr04clients001
Revises: mr03cazari001
Create Date: 2026-05-15

Tabel agregat pentru rapoartele CRM (secțiunea „Clienți"): un rând per
(report_date, account_id, location_id, client_id) cu sumele plătite,
total bonuri și flag is_first_visit (marca prima zi în care clientul
apare în receipts). Populat de builder-ul `build_clients_daily`.
"""
from __future__ import annotations
from alembic import op
import sqlalchemy as sa


revision = "mr04clients001"
down_revision = "mr03cazari001"
branch_labels = None
depends_on = None


def _is_postgres() -> bool:
    return op.get_bind().dialect.name == "postgresql"


def upgrade() -> None:
    op.create_table(
        "report_clients_daily",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("report_date", sa.Date(), nullable=False),
        sa.Column(
            "account_id",
            sa.Integer(),
            sa.ForeignKey("accounts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "location_id",
            sa.Integer(),
            sa.ForeignKey("locations.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "client_id",
            sa.Integer(),
            sa.ForeignKey("clienti.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("sum_paid", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("sum_total", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("count_receipts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_first_visit", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )

    op.create_index(
        "ix_report_clients_daily_account_date",
        "report_clients_daily",
        ["account_id", "report_date"],
    )
    op.create_index(
        "ix_report_clients_daily_client_date",
        "report_clients_daily",
        ["client_id", "report_date"],
    )
    op.create_index(
        "ix_report_clients_daily_location_date",
        "report_clients_daily",
        ["location_id", "report_date"],
    )

    if _is_postgres():
        op.execute(
            "INSERT INTO report_runs (report_type, status, updated_at) "
            "VALUES ('clients_daily', 'idle', NOW())"
        )
    else:
        op.execute(
            "INSERT INTO report_runs (report_type, status, updated_at) "
            "VALUES ('clients_daily', 'idle', CURRENT_TIMESTAMP)"
        )


def downgrade() -> None:
    op.execute("DELETE FROM report_runs WHERE report_type = 'clients_daily'")
    op.drop_index("ix_report_clients_daily_location_date", table_name="report_clients_daily")
    op.drop_index("ix_report_clients_daily_client_date", table_name="report_clients_daily")
    op.drop_index("ix_report_clients_daily_account_date", table_name="report_clients_daily")
    op.drop_table("report_clients_daily")
