"""radar: descoperire concurenti (radar_discoveries)

Revision ID: rad02discovery
Revises: rad01radar
Create Date: 2026-09-05
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB


revision = "rad02discovery"
down_revision = "rad01radar"
branch_labels = None
depends_on = None

JSON_T = sa.JSON().with_variant(JSONB, "postgresql")


def upgrade() -> None:
    op.create_table(
        "radar_discoveries",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("account_id", sa.Integer(), sa.ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
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
    )
    op.create_index(
        "ix_radar_discoveries_account_created", "radar_discoveries", ["account_id", "created_at"]
    )


def downgrade() -> None:
    op.drop_index("ix_radar_discoveries_account_created", table_name="radar_discoveries")
    op.drop_table("radar_discoveries")
