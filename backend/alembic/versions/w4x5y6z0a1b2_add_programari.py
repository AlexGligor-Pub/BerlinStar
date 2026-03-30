"""add_programari

Revision ID: w4x5y6z0a1b2
Revises: v3w4x5y6z0a1
Create Date: 2026-03-30 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "w4x5y6z0a1b2"
down_revision: Union[str, None] = "v3w4x5y6z0a1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # CREATE TYPE — idempotent (ignora daca exista deja)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE programare_status AS ENUM ('Programat', 'In lucru', 'Executat', 'Anulat');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$
    """)

    # CREATE TABLE — idempotent
    op.execute("""
        CREATE TABLE IF NOT EXISTS programari (
            id            SERIAL PRIMARY KEY,
            account_id    INTEGER NOT NULL REFERENCES accounts(id),
            titlu         VARCHAR(200) NOT NULL,
            notite        TEXT,
            client_id     INTEGER REFERENCES clienti(id) ON DELETE SET NULL,
            location_id   INTEGER NOT NULL REFERENCES locations(id),
            department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
            start_time    TIMESTAMPTZ NOT NULL,
            end_time      TIMESTAMPTZ NOT NULL,
            status        programare_status NOT NULL DEFAULT 'Programat',
            created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at    TIMESTAMPTZ,
            is_deleted    BOOLEAN NOT NULL DEFAULT false,
            deleted_at    TIMESTAMPTZ
        )
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_programari_account_id_start_time ON programari (account_id, start_time)
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_programari_location_id ON programari (location_id)
    """)

    # ADD COLUMN pe receipts — idempotent
    op.execute("""
        ALTER TABLE receipts
        ADD COLUMN IF NOT EXISTS programare_id INTEGER REFERENCES programari(id) ON DELETE SET NULL
    """)


def downgrade() -> None:
    op.execute("ALTER TABLE receipts DROP COLUMN IF EXISTS programare_id")
    op.execute("DROP INDEX IF EXISTS ix_programari_location_id")
    op.execute("DROP INDEX IF EXISTS ix_programari_account_id_start_time")
    op.execute("DROP TABLE IF EXISTS programari")
    op.execute("DROP TYPE IF EXISTS programare_status")
