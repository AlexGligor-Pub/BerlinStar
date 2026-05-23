"""add task_runs and scheduled_job_overrides

Revision ID: zza0jj1kk2ll3
Revises: mr_show_toggles_001
Create Date: 2026-05-23 00:00:00.000000

"""
from __future__ import annotations
from alembic import op
import sqlalchemy as sa


revision = "zza0jj1kk2ll3"
down_revision = "mr_show_toggles_001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "task_runs",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("job_id", sa.String(64), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(16), nullable=False, server_default="running"),
        sa.Column("duration_ms", sa.Integer(), nullable=True),
        sa.Column("items_processed", sa.Integer(), nullable=True),
        sa.Column("items_failed", sa.Integer(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("triggered_by", sa.String(32), nullable=False, server_default="schedule"),
    )
    op.create_index("ix_task_runs_job_id", "task_runs", ["job_id"])
    op.create_index("ix_task_runs_started_at", "task_runs", ["started_at"])
    op.create_index("ix_task_runs_status", "task_runs", ["status"])

    op.create_table(
        "scheduled_job_overrides",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("job_id", sa.String(64), nullable=False, unique=True),
        sa.Column("cron_expression", sa.String(128), nullable=True),
        sa.Column("trigger_type", sa.String(16), nullable=False, server_default="cron"),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )


def downgrade() -> None:
    op.drop_table("scheduled_job_overrides")
    op.drop_index("ix_task_runs_status", table_name="task_runs")
    op.drop_index("ix_task_runs_started_at", table_name="task_runs")
    op.drop_index("ix_task_runs_job_id", table_name="task_runs")
    op.drop_table("task_runs")
