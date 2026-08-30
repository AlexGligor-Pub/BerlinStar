"""username unic doar printre utilizatorii activi (index partial)

Revision ID: usr02uniq
Revises: dsc01disc
Create Date: 2026-08-23 10:00:00.000000

Problema pe care o rezolva: `uq_users_account_id_username` era o constrangere
unica simpla pe (account_id, username). Cum stergerea unui utilizator e logica
(is_deleted = true), randul rămâne in tabel si tine numele ocupat pentru
totdeauna — un „ion" concediat facea imposibila crearea unui alt „ion" peste doi
ani, fara nicio cale de iesire din UI.

Solutia standard: index unic PARTIAL, care ignora randurile sterse. Numele redevine
liber la stergere, dar coliziunile intre utilizatorii activi rămân imposibile la
nivel de baza de date (nu doar in cod).

SQLite (fallback-ul de dev) suporta si el `CREATE UNIQUE INDEX ... WHERE`, deci
migrarea merge pe ambele dialecte. Diferenta e ca acolo constrangerea veche nu
poate fi stearsa cu ALTER TABLE; pe SQLite tabelul e oricum recreat de la zero in
dev, asa ca tratam doar cazul Postgres.
"""
import sqlalchemy as sa
from alembic import op


revision = "usr02uniq"
down_revision = "dsc01disc"
branch_labels = None
depends_on = None

_INDEX = "uq_users_account_id_username"


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        # Numele constrangerii si al indexului nou coincid intentionat: pastram
        # aceeasi eticheta in erorile de integritate.
        op.execute(sa.text(f'ALTER TABLE users DROP CONSTRAINT IF EXISTS "{_INDEX}"'))
        op.execute(sa.text(f'DROP INDEX IF EXISTS "{_INDEX}"'))
    else:
        op.execute(sa.text(f'DROP INDEX IF EXISTS "{_INDEX}"'))

    # Duplicatele nu pot exista inca (constrangerea veche era mai stricta decat
    # cea noua), deci crearea indexului nu are cum sa esueze pe date existente.
    op.create_index(
        _INDEX,
        "users",
        ["account_id", "username"],
        unique=True,
        postgresql_where=sa.text("is_deleted = false"),
        sqlite_where=sa.text("is_deleted = 0"),
    )


def downgrade() -> None:
    op.drop_index(_INDEX, table_name="users")
    # Revenirea la constrangerea totala poate esua daca intre timp au aparut
    # doua conturi cu acelasi username (unul sters, unul activ) — exact scenariul
    # pe care migrarea il permite. Dezambiguizam randurile sterse inainte.
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute(sa.text("""
            UPDATE users u SET username = u.username || '#' || u.id
            WHERE u.is_deleted = true
              AND EXISTS (
                SELECT 1 FROM users o
                WHERE o.account_id = u.account_id
                  AND o.username = u.username
                  AND o.id <> u.id
              )
        """))
    op.create_unique_constraint(_INDEX, "users", ["account_id", "username"])
