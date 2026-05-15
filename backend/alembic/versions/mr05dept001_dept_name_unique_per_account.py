"""dept name unique per account

Revision ID: mr05dept001
Revises: mr04clients001
Create Date: 2026-05-15

Inlocuieste constraint-ul global unique pe `departments.name` cu unul
compus `(account_id, name)`, ca sa permita conturilor diferite sa aiba
departamente cu acelasi nume. Constraint-ul original a fost mostenit de
la tabelul `themes` (vezi 4d5e6f7a8b9c_rename_themes_to_departments).
"""
from __future__ import annotations
from alembic import op


revision = "mr05dept001"
down_revision = "mr04clients001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Constraint-ul mostenit poate veni cu mai multe denumiri in functie de
    # cum a fost generat (themes_name_key auto-PG, departments_name_key, sau
    # uq_themes_name din convenita uq_<table>_<col> de pe `themes`).
    op.execute("ALTER TABLE departments DROP CONSTRAINT IF EXISTS themes_name_key")
    op.execute("ALTER TABLE departments DROP CONSTRAINT IF EXISTS departments_name_key")
    op.execute("ALTER TABLE departments DROP CONSTRAINT IF EXISTS uq_themes_name")
    op.execute(
        "ALTER TABLE departments ADD CONSTRAINT uq_departments_account_id_name "
        "UNIQUE (account_id, name)"
    )


def downgrade() -> None:
    op.drop_constraint("uq_departments_account_id_name", "departments", type_="unique")
    op.create_unique_constraint("departments_name_key", "departments", ["name"])
