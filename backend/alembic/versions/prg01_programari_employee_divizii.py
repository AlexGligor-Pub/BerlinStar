"""programari.employee_id + departments.show_in_programari

Revision ID: prg01employee
Revises: sub02checkout
"""
from __future__ import annotations
from alembic import op
import sqlalchemy as sa

revision = "prg01employee"
down_revision = "sub02checkout"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("programari", sa.Column("employee_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_programari_employee_id_employees", "programari", "employees",
        ["employee_id"], ["id"], ondelete="SET NULL",
    )
    op.create_index("ix_programari_employee_id", "programari", ["employee_id"])
    op.add_column(
        "departments",
        sa.Column("show_in_programari", sa.Boolean(), nullable=False, server_default=sa.text("true")),
    )


def downgrade() -> None:
    op.drop_column("departments", "show_in_programari")
    op.drop_index("ix_programari_employee_id", table_name="programari")
    op.drop_constraint("fk_programari_employee_id_employees", "programari", type_="foreignkey")
    op.drop_column("programari", "employee_id")
