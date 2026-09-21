"""punctul de lucru al unei sesiuni de import

Revision ID: imp05loc
Revises: imp04plate
Create Date: 2026-09-21 20:30:00.000000

Cazarile de anvelope apartin unui punct de lucru, iar pagina Hotel arata doar
cazarile locatiei statiei curente. Importul nu punea nimic acolo, asa ca tot ce
intra pe usa raminea invizibil in aplicatie. Sesiunea retine de acum locatia
aleasa la incarcarea fisierului, iar cazarile create o primesc.
"""
from alembic import op
import sqlalchemy as sa


revision = "imp05loc"
down_revision = "imp04plate"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("import_sessions", sa.Column("location_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_import_sessions_location_id_locations", "import_sessions", "locations",
        ["location_id"], ["id"], ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_import_sessions_location_id_locations", "import_sessions", type_="foreignkey")
    op.drop_column("import_sessions", "location_id")
