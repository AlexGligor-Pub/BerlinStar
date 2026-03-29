"""add_programari

Revision ID: w4x5y6z0a1b2
Revises: v3w4x5y6z0a1
Create Date: 2026-03-30 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "w4x5y6z0a1b2"
down_revision: Union[str, None] = "v3w4x5y6z0a1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    programare_status = sa.Enum(
        "Programat", "In lucru", "Executat", "Anulat",
        name="programare_status",
    )
    programare_status.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "programari",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("account_id", sa.Integer(), sa.ForeignKey("accounts.id"), nullable=False),
        sa.Column("titlu", sa.String(200), nullable=False),
        sa.Column("notite", sa.Text(), nullable=True),
        sa.Column("client_id", sa.Integer(), sa.ForeignKey("clienti.id", ondelete="SET NULL"), nullable=True),
        sa.Column("location_id", sa.Integer(), sa.ForeignKey("locations.id"), nullable=False),
        sa.Column("department_id", sa.Integer(), sa.ForeignKey("departments.id", ondelete="SET NULL"), nullable=True),
        sa.Column("start_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", programare_status, nullable=False, server_default="Programat"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_programari_account_id_start_time", "programari", ["account_id", "start_time"])
    op.create_index("ix_programari_location_id", "programari", ["location_id"])

    op.add_column(
        "receipts",
        sa.Column(
            "programare_id",
            sa.Integer(),
            sa.ForeignKey("programari.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("receipts", "programare_id")
    op.drop_index("ix_programari_location_id", table_name="programari")
    op.drop_index("ix_programari_account_id_start_time", table_name="programari")
    op.drop_table("programari")
    sa.Enum(name="programare_status").drop(op.get_bind(), checkfirst=True)
