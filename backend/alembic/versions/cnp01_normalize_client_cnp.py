"""Normalizeaza CNP-ul clientilor fizici la 13 cifre.

CNP-ul e acum obligatoriu la scriere (ClientCreate). Randurile vechi au `cui`
NULL sau valori gunoi (CNP partial, telefon pus gresit acolo), care ar bloca
editarea oricarui alt camp al clientului. Le aducem la forma valida: separatorii
se curata, iar ce nu ramane 13 cifre devine placeholder-ul de e-Factura B2C.

Revision ID: cnp01norm
Revises: veh02link
"""
from alembic import op

revision = "cnp01norm"
down_revision = "veh02link"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        r"""
        UPDATE clienti
           SET cui = CASE
                       WHEN regexp_replace(COALESCE(cui, ''), '[\s.-]', '', 'g') ~ '^\d{13}$'
                       THEN regexp_replace(cui, '[\s.-]', '', 'g')
                       ELSE '0000000000000'
                     END
         WHERE tip = 'fizic'
        """
    )


def downgrade() -> None:
    op.execute("UPDATE clienti SET cui = NULL WHERE tip = 'fizic' AND cui = '0000000000000'")
