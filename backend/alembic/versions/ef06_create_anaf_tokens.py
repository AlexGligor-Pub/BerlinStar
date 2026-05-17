"""create anaf_tokens table (per-company OAuth tokens, encrypted)

Revision ID: ef06ant001
Revises: ef05ans001
Create Date: 2026-05-16 14:25:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "ef06ant001"
down_revision = "ef05ans001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "anaf_tokens",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "company_id",
            sa.Integer(),
            sa.ForeignKey("companies.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("cui", sa.String(20), nullable=False),
        sa.Column("access_token_enc", sa.Text(), nullable=False),
        sa.Column("refresh_token_enc", sa.Text(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("token_type", sa.String(50), nullable=False, server_default="Bearer"),
        sa.Column("scope", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("anaf_tokens")
