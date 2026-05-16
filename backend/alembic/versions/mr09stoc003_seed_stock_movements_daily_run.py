"""seed report_runs cu stock_movements_daily

Revision ID: mr09stoc003
Revises: mr08stoc002
Create Date: 2026-05-16

Adauga randul pentru noul raport `stock_movements_daily` in tabela
`report_runs`, ca sa apara imediat ca un card disponibil in AdminV2 →
Rapoarte (altfel ar aparea doar dupa prima rulare automata din scheduler).
Idempotent prin ON CONFLICT DO NOTHING.
"""
from __future__ import annotations
from alembic import op


revision = "mr09stoc003"
down_revision = "mr08stoc002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        INSERT INTO report_runs (report_type, status, updated_at)
        VALUES ('stock_movements_daily', 'idle', NOW())
        ON CONFLICT (report_type) DO NOTHING
        """
    )


def downgrade() -> None:
    op.execute(
        "DELETE FROM report_runs WHERE report_type = 'stock_movements_daily'"
    )
