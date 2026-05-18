"""add reports_password to accounts

Revision ID: ef11accpwd
Revises: ef10gblbk
Create Date: 2026-05-18

Adauga o parola separata pentru accesul la pagina Rapoarte. Pagina contine
date sensibile (cifra de afaceri, target angajati, etc.), deci dam optiunea
proprietarului sa o protejeze cu o parola distincta fata de cea de login.

Coloana este nullable: daca e NULL, contul inca nu a setat o parola pentru
Rapoarte (gate-ul va cere setarea ei la primul acces).
"""
from __future__ import annotations
from alembic import op


revision = "ef11accpwd"
down_revision = "ef10gblbk"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE accounts ADD COLUMN IF NOT EXISTS reports_password VARCHAR(255)")


def downgrade() -> None:
    op.execute("ALTER TABLE accounts DROP COLUMN IF EXISTS reports_password")
