"""adauga an_fabricatie pe vehicole si client_vehicole

Revision ID: veh01anfab
Revises: ef17rawresp
Create Date: 2026-06-28 12:00:00.000000

Adauga campul "Anul Fabricatiei" (an_fabricatie, int nullable) la obiectul vehicul,
atat pe vehiculul legat de bon (tabel `vehicole`) cat si pe vehiculul clientului
(tabel `client_vehicole`).

down_revision = ef17rawresp = head-ul unic curent al lantului (leavehrs_001 e parintele
lui ef17rawresp, nu un head separat).
"""
import sqlalchemy as sa
from alembic import op


revision = "veh01anfab"
down_revision = "ef17rawresp"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("vehicole", sa.Column("an_fabricatie", sa.Integer(), nullable=True))
    op.add_column("client_vehicole", sa.Column("an_fabricatie", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("client_vehicole", "an_fabricatie")
    op.drop_column("vehicole", "an_fabricatie")
