"""add report_programari_daily

Revision ID: mr05programari001
Revises: mr04clients001
Create Date: 2026-05-15

Tabel agregat pentru raportul „Programări" (Ops): un rând per
(report_date, account_id, location_id, hour_slot) cu pivot pe status,
suma lead-time (zile) și nr. programări legate de bon. Populat de
`build_programari_daily`.
"""
from __future__ import annotations
from alembic import op
import sqlalchemy as sa


revision = "mr05programari001"
down_revision = "mr04clients001"
branch_labels = None
depends_on = None


def _is_postgres() -> bool:
    return op.get_bind().dialect.name == "postgresql"


def upgrade() -> None:
    op.create_table(
        "report_programari_daily",
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
        sa.Column("hour_slot", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("count_total", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("count_programat", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("count_in_lucru", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("count_executat", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("count_anulat", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("count_with_receipt", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("sum_lead_time_days", sa.Integer(), nullable=False, server_default="0"),
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
        "ix_report_programari_daily_account_date",
        "report_programari_daily",
        ["account_id", "report_date"],
    )
    op.create_index(
        "ix_report_programari_daily_location_date",
        "report_programari_daily",
        ["location_id", "report_date"],
    )

    if _is_postgres():
        op.execute(
            "INSERT INTO report_runs (report_type, status, updated_at) "
            "VALUES ('programari_daily', 'idle', NOW())"
        )
    else:
        op.execute(
            "INSERT INTO report_runs (report_type, status, updated_at) "
            "VALUES ('programari_daily', 'idle', CURRENT_TIMESTAMP)"
        )


def downgrade() -> None:
    op.execute("DELETE FROM report_runs WHERE report_type = 'programari_daily'")
    op.drop_index("ix_report_programari_daily_location_date", table_name="report_programari_daily")
    op.drop_index("ix_report_programari_daily_account_date", table_name="report_programari_daily")
    op.drop_table("report_programari_daily")
