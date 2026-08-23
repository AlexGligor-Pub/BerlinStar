"""Pretul de lista al liniei, pastrat cand se aplica o reducere.

De ce: reducerea se aplica PE FIECARE LINIE (scazand pretul), nu ca o linie
negativa separata — altfel atribuirea pe angajat si pe produs ramane la valoarea
neredusa, iar rapoartele de target si de profitabilitate ies umflate.

Scazand pretul in loc, pierdeam insa pretul initial: nu mai puteam nici sa
eliminam reducerea, nici sa o recalculam fara sa se compuneze. `original_price`
pastreaza pretul dinainte de reducere; NULL = linia nu are reducere.

Revision ID: dsc01disc
Revises: pay01pay
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "dsc01disc"
down_revision = "pay01pay"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "receipt_items",
        sa.Column("original_price", sa.Numeric(10, 2), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("receipt_items", "original_price")
