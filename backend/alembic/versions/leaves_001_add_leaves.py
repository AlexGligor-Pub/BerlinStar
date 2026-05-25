"""add leaves table + annual_vacation_days column

Revision ID: leaves_001
Revises: iv_is_001
Create Date: 2026-05-25 00:00:00.000000

"""
from __future__ import annotations
from alembic import op


revision = "leaves_001"
down_revision = "iv_is_001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE leave_type AS ENUM (
                'Concediu de odihna',
                'Concediu medical',
                'Business Trip',
                'Concediu fara plata'
            );
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$
    """)

    op.execute("""
        DO $$ BEGIN
            CREATE TYPE leave_status AS ENUM ('Pending', 'Approved', 'Rejected');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$
    """)

    op.execute("""
        ALTER TABLE employees
        ADD COLUMN IF NOT EXISTS annual_vacation_days INTEGER NOT NULL DEFAULT 21
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS leaves (
            id            SERIAL PRIMARY KEY,
            account_id    INTEGER NOT NULL REFERENCES accounts(id),
            employee_id   INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
            location_id   INTEGER REFERENCES locations(id) ON DELETE SET NULL,
            type          leave_type NOT NULL,
            status        leave_status NOT NULL DEFAULT 'Pending',
            start_date    DATE NOT NULL,
            end_date      DATE NOT NULL,
            working_days  INTEGER NOT NULL DEFAULT 0,
            notes         TEXT,
            approved_by   INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
            approved_at   TIMESTAMPTZ,
            created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at    TIMESTAMPTZ,
            is_deleted    BOOLEAN NOT NULL DEFAULT false,
            deleted_at    TIMESTAMPTZ
        )
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_leaves_account_id_start_date ON leaves (account_id, start_date)
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_leaves_employee_id_start_date ON leaves (employee_id, start_date)
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_leaves_location_id ON leaves (location_id)
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_leaves_location_id")
    op.execute("DROP INDEX IF EXISTS ix_leaves_employee_id_start_date")
    op.execute("DROP INDEX IF EXISTS ix_leaves_account_id_start_date")
    op.execute("DROP TABLE IF EXISTS leaves")
    op.execute("ALTER TABLE employees DROP COLUMN IF EXISTS annual_vacation_days")
    op.execute("DROP TYPE IF EXISTS leave_status")
    op.execute("DROP TYPE IF EXISTS leave_type")
