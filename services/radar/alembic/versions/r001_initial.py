"""radar service: schema dedicata `radar` cu tabelele Radar + coada de job-uri

Revision ID: r001initial
Revises:
Create Date: 2026-09-07
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB


revision = "r001initial"
down_revision = None
branch_labels = None
depends_on = None

SCHEMA = "radar"
JSON_T = sa.JSON().with_variant(JSONB, "postgresql")
ACTIVE_SQL = "status IN ('queued', 'running')"


def upgrade() -> None:
    op.execute(f"CREATE SCHEMA IF NOT EXISTS {SCHEMA}")

    op.create_table(
        "radar_sources",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("account_id", sa.Integer(), nullable=False),
        sa.Column("kind", sa.String(20), nullable=False),
        sa.Column("label", sa.String(200), nullable=False, server_default=""),
        sa.Column("value", sa.String(500), nullable=False),
        sa.Column("meta", JSON_T, nullable=True),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("last_collected_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_error", sa.Text(), nullable=True),
        schema=SCHEMA,
    )
    op.create_index("ix_radar_sources_account_id", "radar_sources", ["account_id"], schema=SCHEMA)
    op.create_index("ix_radar_sources_account_kind", "radar_sources", ["account_id", "kind"], schema=SCHEMA)

    op.create_table(
        "radar_settings",
        sa.Column("account_id", sa.Integer(), primary_key=True),
        sa.Column("focus_prompt", sa.Text(), nullable=False, server_default=""),
        sa.Column("business_context", sa.Text(), nullable=False, server_default=""),
        sa.Column("schedule", sa.String(10), nullable=False, server_default="off"),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        schema=SCHEMA,
    )

    op.create_table(
        "radar_runs",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("account_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(10), nullable=False, server_default="queued"),
        sa.Column("trigger", sa.String(10), nullable=False, server_default="manual"),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("progress", JSON_T, nullable=True),
        sa.Column("tokens_in", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("tokens_out", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("cost_usd", sa.Numeric(12, 6), nullable=False, server_default="0"),
        sa.Column("title", sa.String(300), nullable=True),
        sa.Column("period_from", sa.Date(), nullable=True),
        sa.Column("period_to", sa.Date(), nullable=True),
        sa.Column("report", JSON_T, nullable=True),
        schema=SCHEMA,
    )
    op.create_index("ix_radar_runs_account_status", "radar_runs", ["account_id", "status"], schema=SCHEMA)

    op.create_table(
        "radar_snapshots",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("account_id", sa.Integer(), nullable=False),
        sa.Column(
            "source_id",
            sa.Integer(),
            sa.ForeignKey(f"{SCHEMA}.radar_sources.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "run_id",
            sa.Integer(),
            sa.ForeignKey(f"{SCHEMA}.radar_runs.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("kind", sa.String(20), nullable=False),
        sa.Column("external_id", sa.String(300), nullable=False),
        sa.Column("collected_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("payload", JSON_T, nullable=True),
        sa.Column("digest", JSON_T, nullable=True),
        sa.UniqueConstraint("source_id", "external_id", name="uq_radar_snapshot_source_external"),
        schema=SCHEMA,
    )
    op.create_index("ix_radar_snapshots_account", "radar_snapshots", ["account_id"], schema=SCHEMA)
    op.create_index("ix_radar_snapshots_run", "radar_snapshots", ["run_id"], schema=SCHEMA)

    op.create_table(
        "ai_usage",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("account_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("feature", sa.String(50), nullable=False),
        sa.Column("model", sa.String(80), nullable=False),
        sa.Column("tokens_in", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("tokens_out", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("cost_usd", sa.Numeric(12, 6), nullable=False, server_default="0"),
        sa.Column(
            "run_id",
            sa.Integer(),
            sa.ForeignKey(f"{SCHEMA}.radar_runs.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("meta", JSON_T, nullable=True),
        schema=SCHEMA,
    )
    op.create_index("ix_ai_usage_account_created", "ai_usage", ["account_id", "created_at"], schema=SCHEMA)

    op.create_table(
        "radar_discoveries",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("account_id", sa.Integer(), nullable=False),
        sa.Column("company_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(10), nullable=False, server_default="queued"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("progress", JSON_T, nullable=True),
        sa.Column("answers", JSON_T, nullable=True),
        sa.Column("profile", JSON_T, nullable=True),
        sa.Column("result", JSON_T, nullable=True),
        sa.Column("tokens_in", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("tokens_out", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("cost_usd", sa.Numeric(12, 6), nullable=False, server_default="0"),
        schema=SCHEMA,
    )
    op.create_index(
        "ix_radar_discoveries_account_created",
        "radar_discoveries",
        ["account_id", "created_at"],
        schema=SCHEMA,
    )

    op.create_table(
        "radar_jobs",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("kind", sa.String(30), nullable=False),
        sa.Column("account_id", sa.Integer(), nullable=False),
        sa.Column("target_id", sa.Integer(), nullable=True),
        sa.Column("idempotency_key", sa.String(200), nullable=False, unique=True),
        sa.Column("status", sa.String(10), nullable=False, server_default="queued"),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("max_attempts", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("payload", JSON_T, nullable=True),
        sa.Column("result", JSON_T, nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("lease_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("scheduled_for", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        schema=SCHEMA,
    )
    op.create_index("ix_radar_jobs_status_id", "radar_jobs", ["status", "id"], schema=SCHEMA)
    op.create_index("ix_radar_jobs_account_kind", "radar_jobs", ["account_id", "kind"], schema=SCHEMA)
    op.create_index(
        "uq_radar_jobs_active",
        "radar_jobs",
        ["account_id", "kind"],
        unique=True,
        schema=SCHEMA,
        postgresql_where=sa.text(ACTIVE_SQL),
        sqlite_where=sa.text(ACTIVE_SQL),
    )

    op.create_table(
        "radar_worker_heartbeat",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("heartbeat_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        schema=SCHEMA,
    )


def downgrade() -> None:
    for table in (
        "radar_worker_heartbeat",
        "radar_jobs",
        "radar_discoveries",
        "ai_usage",
        "radar_snapshots",
        "radar_runs",
        "radar_settings",
        "radar_sources",
    ):
        op.drop_table(table, schema=SCHEMA)
    op.execute(f"DROP SCHEMA IF EXISTS {SCHEMA} CASCADE")
