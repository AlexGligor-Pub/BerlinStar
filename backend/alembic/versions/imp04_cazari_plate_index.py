"""index pentru cautarea cazarii dupa numar de masina normalizat

Revision ID: imp04plate
Revises: imp03revert
Create Date: 2026-09-21 18:00:00.000000

Importul hotelului verifica, pentru fiecare cazare, daca exista deja una cu
acelasi numar si aceeasi data. Comparatia normalizeaza numarul in SQL
(`upper(replace(replace(...)))`), iar o functie pe coloana nu poate folosi un
index obisnuit — pe conturile cu zeci de mii de cazari fiecare rand rezolvat
insemna o scanare completa. Indexul de mai jos are exact forma expresiei.
"""
from alembic import op


revision = "imp04plate"
down_revision = "imp03revert"
branch_labels = None
depends_on = None

_INDEX = "ix_cazari_anvelope_plate_data"
_EXPR = "upper(replace(replace(numar_masina, ' ', ''), '-', ''))"


def upgrade() -> None:
    if op.get_bind().dialect.name == "postgresql":
        op.execute(
            f"CREATE INDEX IF NOT EXISTS {_INDEX} ON cazari_anvelope "
            f"(account_id, data_checkin, {_EXPR}) WHERE is_deleted = false"
        )


def downgrade() -> None:
    if op.get_bind().dialect.name == "postgresql":
        op.execute(f"DROP INDEX IF EXISTS {_INDEX}")
