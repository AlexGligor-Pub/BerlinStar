"""legatura explicita intre vehiculul de pe bon si masina clientului

Revision ID: veh02link
Revises: usr02uniq
Create Date: 2026-08-24 09:00:00.000000

Problema: `vehicole` (snapshotul de pe bon) si `client_vehicole` (garajul
clientului) erau legate doar prin numarul de inmatriculare, comparat ca sir exact.
Cand operatorul edita numarul pe un deviz deja salvat — corectura de tipar sau
doar alt mod de a-l scrie — potrivirea nu mai gasea nimic si se insera o MASINA
NOUA in garajul clientului, in loc sa fie actualizata cea existenta.

`client_vehicol_id` face legatura explicita, deci supravietuieste oricarei
editari a numarului.

Backfill: legam randurile existente dupa numarul normalizat (majuscule, fara
spatii si cratime), prin clientul bonului. Unde exista deja duplicate din bug-ul
de mai sus, alegem cel mai vechi rand — e cel pe care il vede si restul aplicatiei,
fiindca listele sunt ordonate dupa id.
"""
import sqlalchemy as sa
from alembic import op


revision = "veh02link"
down_revision = "usr02uniq"
branch_labels = None
depends_on = None

_NORM = "UPPER(REPLACE(REPLACE({col}, ' ', ''), '-', ''))"


def upgrade() -> None:
    op.add_column("vehicole", sa.Column("client_vehicol_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_vehicole_client_vehicol_id_client_vehicole",
        "vehicole", "client_vehicole",
        ["client_vehicol_id"], ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_vehicole_client_vehicol_id", "vehicole", ["client_vehicol_id"])

    op.execute(sa.text(f"""
        UPDATE vehicole v
        SET client_vehicol_id = (
            SELECT MIN(cv.id)
            FROM client_vehicole cv
            JOIN receipts r ON r.id = v.receipt_id
            WHERE cv.account_id = v.account_id
              AND cv.client_id = r.client_id
              AND cv.is_deleted = false
              AND {_NORM.format(col='cv.numar_masina')} = {_NORM.format(col='v.numar_masina')}
        )
        WHERE v.is_deleted = false
    """))


def downgrade() -> None:
    op.drop_index("ix_vehicole_client_vehicol_id", table_name="vehicole")
    op.drop_constraint(
        "fk_vehicole_client_vehicol_id_client_vehicole", "vehicole", type_="foreignkey"
    )
    op.drop_column("vehicole", "client_vehicol_id")
