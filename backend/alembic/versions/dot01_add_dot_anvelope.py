"""add coduri_dot_anvelope + dot_id on anvelope/montaj_roti

Revision ID: dot01_anvelope
Revises: mrg01_ef16_fr01
Create Date: 2026-05-20 10:00:00.000000

"""
from __future__ import annotations
from alembic import op
import sqlalchemy as sa


revision = "dot01_anvelope"
down_revision = "mrg01_ef16_fr01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "coduri_dot_anvelope",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("account_id", sa.Integer(), sa.ForeignKey("accounts.id"), nullable=False),
        sa.Column("valoare", sa.String(50), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_coduri_dot_anvelope_account_id_is_deleted_id",
        "coduri_dot_anvelope",
        ["account_id", "is_deleted", "id"],
    )

    op.add_column(
        "anvelope",
        sa.Column(
            "dot_id",
            sa.Integer(),
            sa.ForeignKey("coduri_dot_anvelope.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.add_column(
        "montaj_roti",
        sa.Column(
            "dot_id",
            sa.Integer(),
            sa.ForeignKey("coduri_dot_anvelope.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("montaj_roti", "dot_id")
    op.drop_column("anvelope", "dot_id")
    op.drop_index(
        "ix_coduri_dot_anvelope_account_id_is_deleted_id",
        table_name="coduri_dot_anvelope",
    )
    op.drop_table("coduri_dot_anvelope")
