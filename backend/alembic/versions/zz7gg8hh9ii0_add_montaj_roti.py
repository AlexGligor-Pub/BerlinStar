"""add montaj_roti

Revision ID: zz7gg8hh9ii0
Revises: zz6ff7gg8hh9
Create Date: 2026-05-12 00:00:00.000000

"""
from __future__ import annotations
from alembic import op
import sqlalchemy as sa


revision = "zz7gg8hh9ii0"
down_revision = "zz6ff7gg8hh9"
branch_labels = None
depends_on = None


_POZITIE_VALUES = (
    "dreapta_fata", "stanga_fata", "dreapta_spate", "stanga_spate", "rezerva", "nespecificat",
)


def upgrade() -> None:
    op.create_table(
        "montaj_roti",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("account_id", sa.Integer(), sa.ForeignKey("accounts.id"), nullable=False),
        sa.Column(
            "receipt_id",
            sa.Integer(),
            sa.ForeignKey("receipts.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "pozitie",
            sa.Enum(*_POZITIE_VALUES, name="pozitie_roata"),
            nullable=False,
            server_default="nespecificat",
        ),
        sa.Column("presiune", sa.Float(), nullable=True),
        sa.Column("ordine", sa.Integer(), nullable=True),
        sa.Column(
            "marca_id",
            sa.Integer(),
            sa.ForeignKey("marci_anvelope.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "dimensiune_id",
            sa.Integer(),
            sa.ForeignKey("dimensiuni_anvelope.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "profil_id",
            sa.Integer(),
            sa.ForeignKey("profiluri_anvelope.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "tip",
            sa.dialects.postgresql.ENUM(
                "iarna", "vara", "ms", "altele",
                name="tip_anvelopa",
                create_type=False,
            ),
            nullable=False,
            server_default="vara",
        ),
        sa.Column("adancime", sa.Float(), nullable=True),
        sa.Column("comments", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_index(
        "ix_montaj_roti_account_id_is_deleted_id",
        "montaj_roti",
        ["account_id", "is_deleted", "id"],
    )
    op.create_index("ix_montaj_roti_receipt_id", "montaj_roti", ["receipt_id"])


def downgrade() -> None:
    op.drop_index("ix_montaj_roti_receipt_id", table_name="montaj_roti")
    op.drop_index("ix_montaj_roti_account_id_is_deleted_id", table_name="montaj_roti")
    op.drop_table("montaj_roti")

    bind = op.get_bind()
    sa.Enum(name="pozitie_roata").drop(bind, checkfirst=True)
