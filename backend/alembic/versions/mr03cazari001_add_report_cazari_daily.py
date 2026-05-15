"""add report_cazari_daily

Revision ID: mr03cazari001
Revises: mr02empdaily_loc
Create Date: 2026-05-15

Tabel agregat pentru rapoarte Hotel Anvelope: un rând per (report_date,
account_id, location_id, employee_id) cu contoare de intrări/ieșiri/
anvelope. Populat de builder-ul `build_cazari_daily` din
app.services.reports. Snapshot-ul „cazări active acum" se calculează live
direct din cazari_anvelope (data_checkout IS NULL), nu din acest tabel.
"""
from __future__ import annotations
from alembic import op
import sqlalchemy as sa


revision = "mr03cazari001"
down_revision = "mr02empdaily_loc"
branch_labels = None
depends_on = None


def _is_postgres() -> bool:
    return op.get_bind().dialect.name == "postgresql"


def upgrade() -> None:
    op.create_table(
        "report_cazari_daily",
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
            "employee_id",
            sa.Integer(),
            sa.ForeignKey("employees.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("count_checkins", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("count_checkouts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("count_checkouts_montate", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("count_anvelope_in", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("count_anvelope_out", sa.Integer(), nullable=False, server_default="0"),
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

    op.execute(
        "CREATE UNIQUE INDEX uq_report_cazari_daily ON report_cazari_daily "
        "(report_date, account_id, COALESCE(location_id, 0), COALESCE(employee_id, 0))"
    )
    op.create_index(
        "ix_report_cazari_daily_account_date",
        "report_cazari_daily",
        ["account_id", "report_date"],
    )
    op.create_index(
        "ix_report_cazari_daily_employee_date",
        "report_cazari_daily",
        ["employee_id", "report_date"],
    )
    op.create_index(
        "ix_report_cazari_daily_location_date",
        "report_cazari_daily",
        ["location_id", "report_date"],
    )

    if _is_postgres():
        op.execute(
            "INSERT INTO report_runs (report_type, status, updated_at) "
            "VALUES ('cazari_daily', 'idle', NOW())"
        )
    else:
        op.execute(
            "INSERT INTO report_runs (report_type, status, updated_at) "
            "VALUES ('cazari_daily', 'idle', CURRENT_TIMESTAMP)"
        )


def downgrade() -> None:
    op.execute("DELETE FROM report_runs WHERE report_type = 'cazari_daily'")
    op.drop_index("ix_report_cazari_daily_location_date", table_name="report_cazari_daily")
    op.drop_index("ix_report_cazari_daily_employee_date", table_name="report_cazari_daily")
    op.drop_index("ix_report_cazari_daily_account_date", table_name="report_cazari_daily")
    op.execute("DROP INDEX IF EXISTS uq_report_cazari_daily")
    op.drop_table("report_cazari_daily")
