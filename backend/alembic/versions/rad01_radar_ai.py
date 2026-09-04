"""radar ai: surse, setari, snapshots, rulari, consum tokeni + chei globale AI

Revision ID: rad01radar
Revises: sub02checkout
Create Date: 2026-09-05
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB


revision = "rad01radar"
down_revision = "sub02checkout"
branch_labels = None
depends_on = None

JSON_T = sa.JSON().with_variant(JSONB, "postgresql")


def upgrade() -> None:
    op.create_table(
        "radar_sources",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("account_id", sa.Integer(), sa.ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("kind", sa.String(20), nullable=False),
        sa.Column("label", sa.String(200), nullable=False, server_default=""),
        sa.Column("value", sa.String(500), nullable=False),
        sa.Column("meta", JSON_T, nullable=True),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("last_collected_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_error", sa.Text(), nullable=True),
    )
    op.create_index("ix_radar_sources_account_kind", "radar_sources", ["account_id", "kind"])

    op.create_table(
        "radar_settings",
        sa.Column("account_id", sa.Integer(), sa.ForeignKey("accounts.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("focus_prompt", sa.Text(), nullable=False, server_default=""),
        sa.Column("business_context", sa.Text(), nullable=False, server_default=""),
        sa.Column("schedule", sa.String(10), nullable=False, server_default="off"),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "radar_runs",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("account_id", sa.Integer(), sa.ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False),
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
    )
    op.create_index("ix_radar_runs_account_status", "radar_runs", ["account_id", "status"])

    op.create_table(
        "radar_snapshots",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("account_id", sa.Integer(), sa.ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("source_id", sa.Integer(), sa.ForeignKey("radar_sources.id", ondelete="CASCADE"), nullable=False),
        sa.Column("run_id", sa.Integer(), sa.ForeignKey("radar_runs.id", ondelete="SET NULL"), nullable=True),
        sa.Column("kind", sa.String(20), nullable=False),
        sa.Column("external_id", sa.String(300), nullable=False),
        sa.Column("collected_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("payload", JSON_T, nullable=True),
        sa.Column("digest", JSON_T, nullable=True),
        sa.UniqueConstraint("source_id", "external_id", name="uq_radar_snapshot_source_external"),
    )
    op.create_index("ix_radar_snapshots_account", "radar_snapshots", ["account_id"])
    op.create_index("ix_radar_snapshots_run", "radar_snapshots", ["run_id"])

    op.create_table(
        "ai_usage",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("account_id", sa.Integer(), sa.ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("feature", sa.String(50), nullable=False),
        sa.Column("model", sa.String(80), nullable=False),
        sa.Column("tokens_in", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("tokens_out", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("cost_usd", sa.Numeric(12, 6), nullable=False, server_default="0"),
        sa.Column("run_id", sa.Integer(), sa.ForeignKey("radar_runs.id", ondelete="SET NULL"), nullable=True),
        sa.Column("meta", JSON_T, nullable=True),
    )
    op.create_index("ix_ai_usage_account_created", "ai_usage", ["account_id", "created_at"])

    op.add_column("global_settings", sa.Column("anthropic_api_key_enc", sa.Text(), nullable=True))
    op.add_column("global_settings", sa.Column("google_places_api_key_enc", sa.Text(), nullable=True))
    op.add_column("global_settings", sa.Column("ai_model", sa.String(80), nullable=True))
    op.add_column("global_settings", sa.Column("ai_price_in_usd_mtok", sa.Numeric(10, 4), nullable=True))
    op.add_column("global_settings", sa.Column("ai_price_out_usd_mtok", sa.Numeric(10, 4), nullable=True))


def downgrade() -> None:
    op.drop_column("global_settings", "ai_price_out_usd_mtok")
    op.drop_column("global_settings", "ai_price_in_usd_mtok")
    op.drop_column("global_settings", "ai_model")
    op.drop_column("global_settings", "google_places_api_key_enc")
    op.drop_column("global_settings", "anthropic_api_key_enc")

    op.drop_index("ix_ai_usage_account_created", table_name="ai_usage")
    op.drop_table("ai_usage")
    op.drop_index("ix_radar_snapshots_run", table_name="radar_snapshots")
    op.drop_index("ix_radar_snapshots_account", table_name="radar_snapshots")
    op.drop_table("radar_snapshots")
    op.drop_index("ix_radar_runs_account_status", table_name="radar_runs")
    op.drop_table("radar_runs")
    op.drop_table("radar_settings")
    op.drop_index("ix_radar_sources_account_kind", table_name="radar_sources")
    op.drop_table("radar_sources")
